"""Niveau cove_01 : une crique au bord de la mer. Plage de sable au fond, falaises
couvertes de pins sur les caps, un vieux phare sur le cap ouest, un petit
ponton pour Moustache, un herbier marin, des blocs de rocher, et une ligne de
bouées qui ferme la crique au large (le jeu y met une collision).

Suit docs/BLENDER_CONVENTIONS.md. La mer est au nord (+Y), la plage au sud.
Unités : mètres, Z vers le haut, l'avant d'un objet regarde -Y.
"""

import math
import random

from mathutils import Matrix, Vector

from .common import Ground, MeshBuilder, circle_points, emissive_material, empty, flat_polygon_object, new_collection, new_scene, palette_material, rgba, smoothstep
from .level import ROCK_GREY, WOOD, WOOD_DARK, WOOD_LIGHT, add_tree, tree_base

SCENE_NAME = "cove_01"

TERRAIN_HALF_SIZE = 100.0
TERRAIN_CELL = 2.0
BUOYS_Y = 30.0
LIGHTHOUSE_X = -36.0
PIER_X = 10.0
# Cap de départ : la barque regarde la falaise et le phare, le large à droite
SPAWN_HEADING = -1.9
ROCKS_X, SEAGRASS_X = 30.0, -12.0

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
    """Ordonnée du rivage : au fond de la crique (y = -30) au centre, les caps vers y = +12 sur les côtés."""
    return -30 + 42 * (1 - math.exp(-((x / 26) ** 4))) + 1.5 * math.sin(x * 0.3)


def headland(x):
    """0 au milieu de la plage, 1 sur les caps (falaises)."""
    return smoothstep(14, 30, abs(x))


def terrain_height(x, y):
    d = y - coast(x)
    if d > 0:
        depth = 0.4 + min(d, 70) * 0.09 + 1.5 * headland(x) * smoothstep(0, 6, d)
        return -depth
    land = -d
    beach = 1.4 * smoothstep(0, 10, land) + 0.3 * math.sin(x * 0.2) * smoothstep(4, 12, land)
    cliff = (9 + 3 * math.sin(x * 0.07 + y * 0.05)) * smoothstep(0, 5, land) * headland(x)
    return max(beach, cliff) + 6 * smoothstep(20, 60, land)


def terrain_color(height, slope, rng):
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
    ground = Ground(build_terrain(groups["Terrain"], material, rng))
    build_water(groups["Eau"], material)
    rocks = build_rocks(groups["Decor"], material, rng)
    build_seagrass(groups["Decor"], material, rng)
    build_lighthouse(groups["Decor"], material, ground)
    build_pier(groups["Decor"], material)
    build_hut_and_driftwood(groups["Decor"], material)
    build_buoys(groups["Decor"], material)
    build_trees(groups["Decor"], material, rng, ground)
    build_colliders(groups["Collisions"], material, rocks)
    build_zones(groups["Zones"])
    build_markers(groups["Reperes"])
    return scene


def build_terrain(collection, material, rng):
    """Grille triangulée : fonds marins, plage, falaises des caps et collines."""
    builder = MeshBuilder()
    count = int(2 * TERRAIN_HALF_SIZE / TERRAIN_CELL)
    coord = lambda i: -TERRAIN_HALF_SIZE + i * TERRAIN_CELL
    points = [[Vector((coord(i), coord(j), terrain_height(coord(i), coord(j)))) for j in range(count + 1)] for i in range(count + 1)]
    for i in range(count):
        for j in range(count):
            a, b, c, d = points[i][j], points[i + 1][j], points[i][j + 1], points[i + 1][j + 1]
            triangles = [(a, b, d), (a, d, c)] if (i + j) % 2 == 0 else [(a, b, c), (b, d, c)]
            for triangle in triangles:
                normal = (triangle[1] - triangle[0]).cross(triangle[2] - triangle[0]).normalized()
                height = sum(p.z for p in triangle) / 3
                builder.polygon(triangle, terrain_color(height, 1 - normal.z, rng))
    return builder.to_object("deco_terrain", material, collection)


def build_water(collection, material):
    """La mer : tout ce qui est au nord du rivage (le jeu recrée la surface)."""
    xs = [x for x in range(-100, 101, 2)]
    ring = [shore_point(x, -1) for x in xs] + [Vector((100, 100, 0)), Vector((-100, 100, 0))]
    builder = MeshBuilder()
    builder.polygon(ring, rgba(0x3fb8b8))
    builder.to_object("water", material, collection)


def build_rocks(collection, material, rng):
    """Blocs au pied du cap est (zone de rochers) et quelques-uns au pied du cap ouest."""
    builder = MeshBuilder()
    spots = []
    base = shore_point(ROCKS_X, 5)
    for offset, size in [((0, 0), 1.8), ((3.2, 1.5), 1.3), ((-2.8, 2.4), 1.1), ((1.0, -2.4), 1.4), ((4.5, -1.2), 0.9)]:
        position = Vector((base.x + offset[0], base.y + offset[1]))
        builder.blob((position.x, position.y, -0.6), size, rng.choice(ROCK_GREY), scale=(1.2, 1.0, 1.0), jitter=0.2, rng=rng)
        spots.append((position, size * 1.05))
    for _ in range(8):
        x = rng.uniform(-44, -28)
        spot = shore_point(x, rng.uniform(0.5, 2.5))
        builder.blob((spot.x, spot.y, -0.3), rng.uniform(0.6, 1.2), rng.choice(ROCK_GREY), scale=(1.2, 1.0, 0.9), jitter=0.2, rng=rng)
    builder.to_object("deco_rocks", material, collection)
    return spots


def seagrass_center():
    return shore_point(SEAGRASS_X, 6)


def build_seagrass(collection, material, rng):
    """Herbier marin : de courtes feuilles vert sombre qui affleurent (elles ondulent)."""
    builder = MeshBuilder()
    greens = [rgba(0x4f6a3a), rgba(0x5f7a42), rgba(0x6a6a3a)]
    spot = seagrass_center()
    for _ in range(70):
        angle, distance = rng.uniform(0, 2 * math.pi), math.sqrt(rng.random()) * 4.5
        x, y = spot.x + math.cos(angle) * distance, spot.y + math.sin(angle) * distance
        base = terrain_height(x, y)
        height = -base + rng.uniform(0.15, 0.55)
        tilt = Matrix.Rotation(rng.uniform(-0.25, 0.25), 4, 'X') @ Matrix.Rotation(rng.uniform(-0.25, 0.25), 4, 'Y')
        builder.cone((x, y, base + height / 2), 0.07, 0.015, height, 3, rng.choice(greens), rotation=tilt)
    builder.to_object("deco_seagrass_sway", material, collection)


def build_lighthouse(collection, material, ground):
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
    lamp = glass.to_object("deco_lighthouse_lamp", emissive_material("LighthouseGlass", 0xfff1c0, 0xffd27a, 2.0), collection)
    lamp.data.color_attributes.remove(lamp.data.color_attributes["Col"])


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
    builder.to_object("deco_pier", material, collection)


def build_hut_and_driftwood(collection, material):
    """Cabane de plage en planches et quelques bois flottés échoués sur le sable."""
    builder = MeshBuilder()
    x, y = -6.0, coast(-6.0) - 11
    z = terrain_height(x, y) - 0.1
    builder.box((x, y, z + 1.1), (3.2, 2.6, 2.2), rgba(0x7fa8b8))
    for side in (-1, 1):
        # Pans de longueurs un peu différentes : leurs bouts ne sont pas dans le même plan (sinon ils clignotent au faîtage)
        builder.box((x + side * 0.85, y, z + 2.6), (2.0, 3.0 if side < 0 else 3.04, 0.12), WHITE, rotation=Matrix.Rotation(side * 0.5, 4, 'Y'))
    builder.box((x, y + 1.32, z + 0.9), (0.8, 0.06, 1.7), WOOD_DARK)
    for dx, dy, angle, length in [(4, -4, 0.3, 2.4), (-10, -5, -0.6, 1.8), (16, -6, 1.2, 2.0)]:
        px, py = x + dx, coast(x + dx) + dy
        lying = Matrix.Rotation(angle, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        builder.cone((px, py, terrain_height(px, py) + 0.12), 0.14, 0.11, length, 6, rgba(0xb8a88a), rotation=lying)
    builder.to_object("deco_hut", material, collection)


def build_buoys(collection, material):
    """Ligne de bouées rouges et blanches, reliées par une corde, qui ferme la crique au large."""
    builder = MeshBuilder()
    xs = [x for x in range(-44, 45, 4)]
    for index, x in enumerate(xs):
        builder.blob((x, BUOYS_Y, 0.12), 0.35, RED if index % 2 else WHITE, scale=(1.0, 1.0, 0.85))
    for x0, x1 in zip(xs, xs[1:]):
        builder.box(((x0 + x1) / 2, BUOYS_Y, 0.08), (x1 - x0, 0.04, 0.04), rgba(0xd8c8a0))
    builder.to_object("deco_buoys", material, collection)


def build_trees(collection, material, rng, ground):
    """Pins sur les caps et les collines, à l'écart de la plage et du phare."""
    builder = MeshBuilder()
    placed = 0
    lighthouse = Vector((LIGHTHOUSE_X, coast(LIGHTHOUSE_X) - 6))
    while placed < 80:
        x, y = rng.uniform(-92, 92), rng.uniform(-92, 20)
        land = coast(x) - y
        if land < 6 or (abs(x) < 16 and land < 22) or (Vector((x, y)) - lighthouse).length < 7:
            continue
        scale = rng.uniform(0.9, 1.6)
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale, fir=rng.random() < 0.85)
        placed += 1
    builder.to_object("deco_trees_sway", material, collection)


def build_colliders(collection, material, rocks):
    """Collisions : la côte (avec une marge), le large derrière les bouées, les blocs."""
    xs = [x for x in range(-100, 101, 2)]
    shore = [shore_point(x, 1.2) for x in xs] + [Vector((100, -110, 0)), Vector((-100, -110, 0))]
    flat_polygon_object("shore_col", collection, [shore], material)
    flat_polygon_object("open_sea_col", collection, [[Vector((-110, BUOYS_Y + 1, 0)), Vector((110, BUOYS_Y + 1, 0)),
                                                      Vector((110, 110, 0)), Vector((-110, 110, 0))]], material)
    start, end = pier_span()
    flat_polygon_object("pier_col", collection, [[Vector((PIER_X - 1.1, start, 0)), Vector((PIER_X + 1.1, start, 0)),
                                                  Vector((PIER_X + 1.1, end + 0.3, 0)), Vector((PIER_X - 1.1, end + 0.3, 0))]], material)
    for index, (position, radius) in enumerate(rocks, start=1):
        flat_polygon_object(f"rock_{index:02d}_col", collection, [circle_points(position, radius, 12)], material)


def build_zones(collection):
    """Zones de pêche : Empties « cercle » couchés à plat (le rayon est leur échelle)."""
    flat = (math.pi / 2, 0, 0)
    zones = [
        ("zone_shallow_1", shore_point(-2, 7), 8),
        ("zone_reeds_1", seagrass_center(), 6),
        ("zone_rocks_1", shore_point(ROCKS_X + 1, 5), 7),
        ("zone_deep_1", Vector((0, 16)), 11),
        ("zone_deep_2", Vector((20, 25)), 6),
    ]
    for name, position, radius in zones:
        empty(name, collection, location=(position.x, position.y, 0), rotation=flat, scale=radius, display='CIRCLE')


def build_markers(collection):
    """Départ au milieu de la crique, tourné vers le phare ; caméra 7 m derrière ; Moustache au bout du ponton."""
    spawn = empty("spawn_boat", collection, location=(0, coast(0) + 14, 0), rotation=(0, 0, SPAWN_HEADING), display='ARROWS', size=1.5)
    camera_position = Matrix.Translation(spawn.location) @ Matrix.Rotation(SPAWN_HEADING, 4, 'Z') @ Vector((0, 7, 3.2))
    empty("cam_default", collection, location=camera_position, display='SINGLE_ARROW', size=1.0)
    _, end = pier_span()
    cat = Vector((PIER_X, end - 0.7, 0.88))
    toward = spawn.location - cat
    empty("npc_cat", collection, location=cat, rotation=(0, 0, math.atan2(toward.x, -toward.y)), display='ARROWS', size=0.5)
