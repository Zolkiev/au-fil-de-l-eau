"""Niveau cove_01 : une grande crique au bord de la mer. Plage de sable au fond,
falaises couvertes de pins sur les caps, un vieux phare sur le cap ouest, un
petit ponton pour Moustache, une cabane de plage et son feu de camp, deux
herbiers marins, des blocs de rocher au pied du cap est, un îlot rocheux au
milieu de la baie, et une ligne de bouées qui ferme la crique au large (le
jeu y met une collision).

Suit docs/BLENDER_CONVENTIONS.md. La mer est au nord (+Y), la plage au sud.
Unités : mètres, Z vers le haut, l'avant d'un objet regarde -Y.
"""

import math
import random

from mathutils import Matrix, Vector

from .common import (Ground, MeshBuilder, build_grid_terrain, circle_points, emissive_object, emissive_material, empty, flat_polygon_object,
                     grid_coords, new_collection, new_scene, palette_material, rgba, smoothstep)
from .flora import Spot, build_flora, far_from
from .level import ROCK_GREY, WOOD, WOOD_DARK, WOOD_LIGHT, add_tree, build_campfire, lamp_post, tree_base, window_material

SCENE_NAME = "cove_01"

# Terrain : grille carrée, fine sur la crique et ses abords, large au loin
TERRAIN_HALF_SIZE = 160.0
TERRAIN_FINE_HALF = 100.0
TERRAIN_CELL, TERRAIN_FAR_CELL = 2.5, 6.0
# Fond de la crique (y de la plage au milieu), avancée des caps vers le large, demi-largeur de la baie
BAY_Y, CAPE_REACH, BAY_HALF_WIDTH = -46.0, 64.0, 52.0
BUOYS_Y = 50.0
# Les bouées et la zone jouable s'arrêtent à cette distance de part et d'autre
SIDE_LIMIT = 132.0
LIGHTHOUSE_X = -74.0
PIER_X = 14.0
HUT_X = -8.0
# Cap de départ : la barque regarde la falaise et le phare, le large à droite
SPAWN_HEADING = -1.9
ROCKS_X, SEAGRASS_X, SEAGRASS2_X = 60.0, -20.0, 30.0
# Îlot rocheux au milieu de la baie : centre, hauteur du sommet, pente
ISLET = (Vector((12.0, 4.0)), 1.3, 0.4)

SAND = [rgba(0xe6d3a3), rgba(0xdcc896)]
WET_SAND = rgba(0xcdbb8a)
SEABED = rgba(0xa89c78)
DEEP_SEABED = rgba(0x7f8a7a)
GRASS = [rgba(0x9cb870), rgba(0x93b068), rgba(0xa6be7a)]
HILL = rgba(0x86a86c)
WHITE = rgba(0xf4f1ea)
RED = rgba(0xc8463a)


# --- Côte et relief -----------------------------------------------------------------------------

def coast(x):
    """Ordonnée du rivage : au fond de la crique (y = BAY_Y) au centre, les caps vers y = +18 sur les côtés."""
    return BAY_Y + CAPE_REACH * (1 - math.exp(-((x / BAY_HALF_WIDTH) ** 4))) + 2.0 * math.sin(x * 0.2)


def headland(x):
    """0 au milieu de la plage, 1 sur les caps (falaises)."""
    return smoothstep(30, 58, abs(x))


def terrain_height(x, y):
    d = y - coast(x)
    if d > 0:
        depth = 0.4 + min(d, 70) * 0.085 + 1.5 * headland(x) * smoothstep(0, 6, d)
        center, peak, slope = ISLET
        return max(-depth, peak - slope * (Vector((x, y)) - center).length)
    land = -d
    beach = 1.4 * smoothstep(0, 10, land) + 0.3 * math.sin(x * 0.2) * smoothstep(4, 12, land)
    cliff = (9 + 3 * math.sin(x * 0.07 + y * 0.05)) * smoothstep(0, 5, land) * headland(x)
    return max(beach, cliff) + 6 * smoothstep(20, 60, land)


def terrain_color(height, slope, _x, _y, rng):
    if height < -1.5:
        return DEEP_SEABED
    if height < -0.3:
        return SEABED
    if height < 0.25:
        return WET_SAND
    if slope > 0.5:
        return rng.choice(ROCK_GREY)
    if height < 1.6:
        return rng.choice(SAND)
    if height > 12:
        return HILL
    return rng.choice(GRASS)


def shore_point(x, offset):
    """Point à `offset` mètres du rivage vers le large (négatif = à terre)."""
    return Vector((x, coast(x) + offset, 0))


# --- Construction ---------------------------------------------------------------------------------

def build():
    rng = random.Random(23)
    scene = new_scene(SCENE_NAME)
    material = palette_material()
    groups = {name: new_collection(scene, name) for name in ("Terrain", "Eau", "Decor", "Collisions", "Zones", "Reperes")}
    decor, markers = groups["Decor"], groups["Reperes"]
    ground = Ground(build_terrain(groups["Terrain"], material, rng))
    build_water(groups["Eau"], material)
    rocks = build_rocks(decor, material, rng, ground)
    build_seagrass(decor, material, rng)
    build_lighthouse(decor, markers, material, ground)
    build_pier(decor, material)
    build_hut_and_driftwood(decor, material, ground)
    campfire = build_campfire(decor, markers, material, rng, ground, Vector((HUT_X + 6.5, coast(HUT_X + 6.5) - 7.5)))
    build_buoys(decor, material)
    build_trees(decor, material, rng, ground)
    build_flora(decor, material, ground, seed=331, half_size=105, spots=cove_flora(ground, campfire))
    build_colliders(groups["Collisions"], material, rocks)
    build_zones(groups["Zones"])
    build_markers(markers)
    return scene


def build_terrain(collection, material, rng):
    """Grille triangulée : fonds marins, plage, falaises des caps, collines et îlot."""
    coords = grid_coords(TERRAIN_HALF_SIZE, TERRAIN_FINE_HALF, TERRAIN_CELL, TERRAIN_FAR_CELL)
    return build_grid_terrain(collection, material, rng, coords, coords, terrain_height, terrain_color)


def build_water(collection, material):
    """La mer : tout ce qui est au nord du rivage (le jeu recrée la surface)."""
    edge = int(TERRAIN_HALF_SIZE)
    xs = [x for x in range(-edge, edge + 1, 2)]
    ring = [shore_point(x, -1) for x in xs] + [Vector((edge, edge, 0)), Vector((-edge, edge, 0))]
    builder = MeshBuilder()
    builder.polygon(ring, rgba(0x3fb8b8))
    builder.to_object("water", material, collection)


def build_rocks(collection, material, rng, ground):
    """Blocs au pied du cap est (zone de rochers), rochers de l'îlot, et quelques-uns au pied des deux caps."""
    builder = MeshBuilder()
    spots = []
    base = shore_point(ROCKS_X, 6)
    for offset, size in [((0, 0), 1.8), ((3.2, 1.5), 1.3), ((-2.8, 2.4), 1.1), ((1.0, -2.4), 1.4), ((4.5, -1.2), 0.9)]:
        position = Vector((base.x + offset[0], base.y + offset[1]))
        builder.blob((position.x, position.y, -0.6), size, rng.choice(ROCK_GREY), scale=(1.2, 1.0, 1.0), jitter=0.2, rng=rng)
        spots.append((position, size * 1.05))
    for low, high in ((-92, -60), (66, 100)):
        for _ in range(9):
            x = rng.uniform(low, high)
            spot = shore_point(x, rng.uniform(0.5, 2.5))
            builder.blob((spot.x, spot.y, -0.3), rng.uniform(0.6, 1.2), rng.choice(ROCK_GREY), scale=(1.2, 1.0, 0.9), jitter=0.2, rng=rng)
    # L'îlot : un gros rocher et deux plus petits, posés sur son sommet
    for offset, size in [((0, 0), 1.3), ((1.3, 0.8), 0.8), ((-1.1, 0.9), 0.7)]:
        x, y = ISLET[0].x + offset[0], ISLET[0].y + offset[1]
        builder.blob((x, y, ground.lowest_under(x, y, size * 0.8) + 0.25 * size), size, rng.choice(ROCK_GREY),
                     scale=(1.1, 1.0, 0.95), jitter=0.2, rng=rng)
    builder.to_object("deco_rocks", material, collection)
    return spots


def seagrass_beds():
    """Herbiers : l'un près de la plage côté ouest, l'autre côté est, entre le ponton et les rochers."""
    return [shore_point(SEAGRASS_X, 7), shore_point(SEAGRASS2_X, 8)]


def build_seagrass(collection, material, rng):
    """Herbiers marins : de courtes feuilles vert sombre qui affleurent (elles ondulent)."""
    builder = MeshBuilder()
    greens = [rgba(0x4f6a3a), rgba(0x5f7a42), rgba(0x6a6a3a)]
    for spot in seagrass_beds():
        for _ in range(70):
            angle, distance = rng.uniform(0, 2 * math.pi), math.sqrt(rng.random()) * 4.5
            x, y = spot.x + math.cos(angle) * distance, spot.y + math.sin(angle) * distance
            base = terrain_height(x, y)
            height = -base + rng.uniform(0.15, 0.55)
            tilt = Matrix.Rotation(rng.uniform(-0.25, 0.25), 4, 'X') @ Matrix.Rotation(rng.uniform(-0.25, 0.25), 4, 'Y')
            builder.cone((x, y, base + height / 2), 0.07, 0.015, height, 3, rng.choice(greens), rotation=tilt)
    builder.to_object("deco_seagrass_sway", material, collection)


def build_lighthouse(collection, markers, material, ground):
    """Vieux phare rayé rouge et blanc sur le cap ouest ; sa lanterne brille (objet émissif à part)."""
    builder = MeshBuilder()
    x, y = LIGHTHOUSE_X, coast(LIGHTHOUSE_X) - 6
    z = terrain_height(x, y) - 0.3
    # Socle de pierre : il descend jusqu'au point le plus bas du sol sous lui (le cap est en pente)
    low = ground.lowest_under(x, y, 1.9) - 0.2
    builder.cone((x, y, (low + z + 1.0) / 2), 1.9, 1.9, z + 1.0 - low, 12, rgba(0x9b9d97))
    bands = 5
    for k in range(bands):
        r0, r1 = 1.5 - 0.4 * k / bands, 1.5 - 0.4 * (k + 1) / bands
        builder.cone((x, y, z + 1.0 + 1.8 * (k + 0.5)), r0, r1, 1.8, 12, RED if k % 2 else WHITE)
    top = z + 1.0 + 1.8 * bands
    builder.cone((x, y, top + 0.08), 1.6, 1.6, 0.16, 12, WOOD_DARK)
    builder.cone((x, y, top + 1.7), 1.0, 0.05, 1.0, 12, RED)
    builder.to_object("deco_lighthouse", material, collection)
    glass = MeshBuilder()
    glass.cone((x, y, top + 0.75), 0.8, 0.8, 1.2, 10, rgba(0xfff1c0))
    emissive_object(glass, "deco_lighthouse_lamp", emissive_material("LighthouseGlass", 0xfff1c0, 0xffd27a, 2.0), collection)
    # Repère du faisceau tournant, au centre de la lanterne
    empty("beacon", markers, location=(x, y, top + 0.75), display='SPHERE', size=0.5)


def pier_span():
    """Début (à terre) et bout (dans l'eau) du petit ponton de la plage."""
    return coast(PIER_X) - 3, coast(PIER_X) + 7


def build_pier(collection, material):
    """Petit ponton de bois qui avance dans l'eau depuis la plage."""
    builder = MeshBuilder()
    start, end = pier_span()
    y, plank = start, 0
    while y < end:
        builder.box((PIER_X, y + 0.15, 0.85), (1.8, 0.27, 0.06), WOOD_LIGHT if plank % 2 else WOOD)
        y += 0.3
        plank += 1
    y = start + 0.6
    while y < end:
        for side in (-0.8, 0.8):
            bottom = terrain_height(PIER_X + side, y) - 0.3
            builder.box((PIER_X + side, y, (0.85 + bottom) / 2), (0.14, 0.14, 0.85 - bottom), WOOD_DARK)
        y += 1.8
    # Lanterne au bout du quai, sur le côté (Moustache est au milieu)
    lamp_post(builder, collection, "deco_pier_lamp", PIER_X - 0.8, end - 0.3, 0.88)
    builder.to_object("deco_pier", material, collection)


def hut_spot():
    return Vector((HUT_X, coast(HUT_X) - 11))


def build_hut_and_driftwood(collection, material, ground):
    """Cabane de plage en planches et quelques bois flottés échoués sur le sable."""
    builder = MeshBuilder()
    x, y = hut_spot()
    z = ground.lowest_under(x, y, 2.2) - 0.05
    builder.box((x, y, z + 1.1), (3.2, 2.6, 2.2), rgba(0x7fa8b8))
    for side in (-1, 1):
        # Pans de longueurs un peu différentes : leurs bouts ne sont pas dans le même plan (sinon ils clignotent au faîtage)
        builder.box((x + side * 0.85, y, z + 2.6), (2.0, 3.0 if side < 0 else 3.04, 0.12), WHITE, rotation=Matrix.Rotation(side * 0.5, 4, 'Y'))
    builder.box((x, y + 1.32, z + 0.9), (0.8, 0.06, 1.7), WOOD_DARK)
    # Fenêtre côté mer, à droite de la porte : allumée la nuit
    window = MeshBuilder()
    window.box((x + 0.95, y + 1.32, z + 1.25), (0.7, 0.06, 0.5), rgba(0x8fa9b4))
    emissive_object(window, "deco_hut_window", window_material(), collection)
    for dx, dy, angle, length in [(-6, -4, 0.3, 2.4), (-13, -5, -0.6, 1.8), (14, -6, 1.2, 2.0), (27, -4.5, 0.9, 2.2), (-16, -3.5, -0.3, 1.7)]:
        px, py = x + dx, coast(x + dx) + dy
        lying = Matrix.Rotation(angle, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        builder.cone((px, py, ground.lowest_under(px, py, length / 2) + 0.1), 0.14, 0.11, length, 6, rgba(0xb8a88a), rotation=lying)
    builder.to_object("deco_hut", material, collection)


def build_buoys(collection, material):
    """
    Bouées rouges et blanches, reliées par une corde : une ligne ferme la
    crique au large, et deux autres la referment sur les côtés, de la côte
    jusqu'au large.
    """
    builder = MeshBuilder()
    limit = int(SIDE_LIMIT)
    line = [Vector((x, BUOYS_Y)) for x in range(-limit, limit + 1, 6)]
    sides = [[Vector((side * limit, y)) for y in range(int(coast(side * limit)) + 5, int(BUOYS_Y) - 3, 6)] for side in (-1, 1)]
    index = 0
    for points in (line, *sides):
        for point in points:
            builder.blob((point.x, point.y, 0.12), 0.35, RED if index % 2 else WHITE, scale=(1.0, 1.0, 0.85))
            index += 1
        # Cordes : une par tronçon, dans l'axe de la ligne (un peu plus épaisses à la verticale : pas de faces confondues aux angles)
        for a, b in zip(points, points[1:]):
            size = (abs(b.x - a.x), 0.04, 0.04) if a.y == b.y else (0.04, abs(b.y - a.y), 0.05)
            builder.box(((a.x + b.x) / 2, (a.y + b.y) / 2, 0.08), size, rgba(0xd8c8a0))
    builder.to_object("deco_buoys", material, collection)


def cove_flora(ground, campfire):
    """Où pousse la flore de la crique : prairies au-dessus de la plage ; galets sur le sable."""
    hut = hut_spot()
    clear = far_from([((LIGHTHOUSE_X, coast(LIGHTHOUSE_X) - 6), 5.0), ((hut.x, hut.y), 4.5), ((PIER_X, coast(PIER_X)), 4.0),
                      ((campfire.x, campfire.y), 3.5)])

    def meadow(x, y):
        return 2 < coast(x) - y < 36 and ground.height(x, y) > 1.8 and ground.slope(x, y) < 0.4 and clear(x, y)

    def beach(x, y):
        return 0.5 < coast(x) - y < 14 and 0.25 < ground.height(x, y) < 1.5 and clear(x, y)

    return {
        "grass": Spot(440, meadow),
        "flowers": Spot(105, meadow),
        "bushes": Spot(70, meadow),
        "pebbles": Spot(240, beach),
    }


def build_trees(collection, material, rng, ground):
    """Pins sur les caps et les collines, à l'écart de la plage et du phare."""
    builder = MeshBuilder()
    placed = 0
    lighthouse = Vector((LIGHTHOUSE_X, coast(LIGHTHOUSE_X) - 6))
    while placed < 170:
        x, y = rng.uniform(-150, 150), rng.uniform(-150, 30)
        land = coast(x) - y
        if land < 6 or (abs(x) < 36 and land < 24) or (Vector((x, y)) - lighthouse).length < 7:
            continue
        scale = rng.uniform(0.9, 1.6)
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale, kind='fir' if rng.random() < 0.85 else 'leafy')
        placed += 1
    builder.to_object("deco_trees_sway", material, collection)


def build_colliders(collection, material, rocks):
    """Collisions : la côte (avec une marge), le large derrière les bouées et au-delà de leurs extrémités, l'îlot, les blocs."""
    edge = int(TERRAIN_HALF_SIZE)
    xs = [x for x in range(-edge, edge + 1, 2)]
    shore = [shore_point(x, 1.2) for x in xs] + [Vector((edge, -edge - 10, 0)), Vector((-edge, -edge - 10, 0))]
    flat_polygon_object("shore_col", collection, [shore], material)
    far = edge + 10
    flat_polygon_object("open_sea_col", collection, [[Vector((-far, BUOYS_Y + 1, 0)), Vector((far, BUOYS_Y + 1, 0)),
                                                      Vector((far, far, 0)), Vector((-far, far, 0))]], material)
    for name, side in (("west_sea_col", -1), ("east_sea_col", 1)):
        x0, x1 = sorted((side * (SIDE_LIMIT + 1), side * far))
        flat_polygon_object(name, collection, [[Vector((x0, -20, 0)), Vector((x1, -20, 0)), Vector((x1, far, 0)), Vector((x0, far, 0))]], material)
    center, peak, slope = ISLET
    flat_polygon_object("islet_col", collection, [circle_points(center, peak / slope + 0.6, 16)], material)
    start, end = pier_span()
    flat_polygon_object("pier_col", collection, [[Vector((PIER_X - 1.1, start, 0)), Vector((PIER_X + 1.1, start, 0)),
                                                  Vector((PIER_X + 1.1, end + 0.3, 0)), Vector((PIER_X - 1.1, end + 0.3, 0))]], material)
    for index, (position, radius) in enumerate(rocks, start=1):
        flat_polygon_object(f"rock_{index:02d}_col", collection, [circle_points(position, radius, 12)], material)


def build_zones(collection):
    """Zones de pêche : Empties « cercle » couchés à plat (le rayon est leur échelle)."""
    flat = (math.pi / 2, 0, 0)
    seagrass = seagrass_beds()
    zones = [
        ("zone_shallow_1", shore_point(2, 8), 9),
        ("zone_shallow_2", shore_point(-40, 7), 8),
        ("zone_reeds_1", seagrass[0], 6.5),
        ("zone_reeds_2", seagrass[1], 6.5),
        ("zone_rocks_1", shore_point(ROCKS_X + 1, 6), 7.5),
        ("zone_rocks_2", ISLET[0], 8),
        ("zone_deep_1", Vector((-18, 24)), 12),
        ("zone_deep_2", Vector((38, 36)), 10),
        ("zone_deep_3", Vector((-100, 36)), 10),
    ]
    for name, position, radius in zones:
        empty(name, collection, location=(position.x, position.y, 0), rotation=flat, scale=radius, display='CIRCLE')


def build_markers(collection):
    """Départ au milieu de la crique, tourné vers le phare ; caméra 7 m derrière ; Moustache au bout du ponton."""
    spawn = empty("spawn_boat", collection, location=(0, coast(0) + 16, 0), rotation=(0, 0, SPAWN_HEADING), display='ARROWS', size=1.5)
    camera_position = Matrix.Translation(spawn.location) @ Matrix.Rotation(SPAWN_HEADING, 4, 'Z') @ Vector((0, 7, 3.2))
    empty("cam_default", collection, location=camera_position, display='SINGLE_ARROW', size=1.0)
    _, end = pier_span()
    cat = Vector((PIER_X, end - 0.7, 0.88))
    toward = spawn.location - cat
    empty("npc_cat", collection, location=cat, rotation=(0, 0, math.atan2(toward.x, -toward.y)), display='ARROWS', size=0.5)
