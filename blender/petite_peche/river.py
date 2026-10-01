"""Niveau river_01 : une longue rivière sinueuse au fond d'un vallon boisé. D'amont
en aval : la cascade et sa fosse profonde, des blocs de rocher, un radier,
une île de graviers au milieu du courant, le vieux pont de bois en arche (où
Moustache s'installe), un banc de graviers, des roselières, un second
chaos de rochers et un grand calme profond tout en bas.

Suit docs/BLENDER_CONVENTIONS.md, plus `water_flow` (courant) et `fx_mist_*`
(embruns de la cascade). L'eau coule vers -X (l'aval) ; l'amont et la
cascade sont vers +X. Unités : mètres, Z vers le haut, l'avant d'un objet
regarde -Y.
"""

import math
import random

from mathutils import Matrix, Vector

from .common import (Ground, MeshBuilder, build_grid_terrain, circle_points, empty, flat_polygon_object, grid_coords, new_collection, new_scene,
                     palette_material, rgba, smoothstep)
from .flora import Spot, build_flora
from .level import ROCK_GREY, WOOD, WOOD_DARK, WOOD_LIGHT, add_shore_rock_at, add_tree, build_campfire, lamp_post, tree_base

SCENE_NAME = "river_01"

# Terrain : rectangle allongé le long de la rivière ; grille fine autour de l'eau, large sur les versants
HALF_X, HALF_Y = 180.0, 110.0
FINE_HALF_Y = 50.0
TERRAIN_CELL, TERRAIN_FAR_CELL = 2.5, 6.0
# Abscisses (m) : fin de la rivière jouable en aval, pied de la cascade, sommet de la cascade
DOWNSTREAM_END = -140.0
FALL_FOOT, FALL_TOP = 115.0, 118.0
FALL_HEIGHT = 4.6
BRIDGE_X = -10.0
BRIDGE_TOP, BRIDGE_END = 5.4, 1.2
FLOW_SPEED = 0.6
# D'amont en aval : fosse de la cascade, blocs, radier, île, banc de graviers, anse à roseaux, second chaos, grand calme
POOL_X, BOULDERS_X, RIFFLE_X, ISLE_X, BAR_X, BAY_X, BOULDERS2_X, CALM_X = 92.0, 66.0, 44.0, 20.0, -42.0, -72.0, -96.0, -120.0
REEDS2_X = 54.0
# Île de graviers : demi-longueur et demi-largeur à fleur d'eau, hauteur
ISLE_LENGTH, ISLE_WIDTH, ISLE_HEIGHT = 10.0, 2.8, 0.9
SPAWN_X = -30.0

GRASS = [rgba(0x9dc27b), rgba(0x96bd74), rgba(0xa3c683)]
GRAVEL = [rgba(0xb8b09a), rgba(0xaca590)]
RIVERBED = rgba(0x8f8a6e)
HILL = rgba(0x86ab70)
FALL_COLORS = [rgba(0xeaf6fb), rgba(0xbfe3ee), rgba(0xd8eff5)]
UPPER_WATER = rgba(0x5fa6b8)


# --- Tracé de la rivière et relief ------------------------------------------------------------

def bump(x, where, spread):
    """Cloche centrée en `where`, large de `spread` : 1 au centre, 0 au loin."""
    return math.exp(-((x - where) / spread) ** 2)


def center(x):
    """Ordonnée du milieu de la rivière : de larges méandres."""
    return 13 * math.sin(x * 0.03) + 5 * math.sin(x * 0.075 + 1.0)


def half_width(x):
    """Demi-largeur de l'eau ; elle s'élargit dans la fosse de la cascade, autour de l'île et dans le grand calme."""
    return 11 + 2.5 * math.sin(x * 0.045 + 0.5) + 5 * bump(x, POOL_X, 14) + 5 * bump(x, ISLE_X, 13) + 6 * bump(x, CALM_X, 16)


def depth(x, y):
    """Profondeur au milieu du lit : fosses, radier (peu profond), banc de graviers."""
    base = 2.3 + 2.4 * bump(x, POOL_X, 11) + 2.2 * bump(x, CALM_X, 13) - 1.1 * bump(x, RIFFLE_X, 8)
    bar = 1.5 * bump(x, BAR_X, 9) * smoothstep(-2, 6, y - center(x))
    return max(0.6, base - bar)


def isle_height(x, y):
    """Île de graviers au milieu du courant (ellipse allongée) ; négatif hors de l'île."""
    reach = math.hypot((x - ISLE_X) / ISLE_LENGTH, (y - center(ISLE_X)) / ISLE_WIDTH)
    return ISLE_HEIGHT * (1 - reach ** 2) if reach < 1.6 else -10.0


def fall_rise(x):
    """Marche de la cascade : tout le relief s'élève en amont."""
    return FALL_HEIGHT * smoothstep(FALL_FOOT, FALL_TOP, x)


def terrain_height(x, y):
    across = abs(y - center(x))
    width = half_width(x)
    if across < width:
        height = -depth(x, y) * (1 - (across / width) ** 2) ** 0.8 - 0.05
        height = max(height, isle_height(x, y))
    else:
        land = across - width
        meadow = 1.2 + 1.0 * math.sin(x * 0.06 + 1.1) * math.cos(y * 0.05)
        height = 0.7 * smoothstep(0, 4, land) + meadow * smoothstep(4, 20, land) + 12 * smoothstep(24, 70, land)
    return height + fall_rise(x)


def terrain_color(height, slope, x, _y, rng):
    base = height - fall_rise(x)
    if base < -0.4:
        return RIVERBED
    if base < 0.45:
        return rng.choice(GRAVEL)
    if slope > 0.5:
        return rng.choice(ROCK_GREY)
    if base > 9:
        return HILL
    return rng.choice(GRASS)


def bank_point(x, offset):
    """Point à `offset` mètres du milieu de la rivière (positif = rive gauche, +Y)."""
    return Vector((x, center(x) + offset, 0))


# --- Construction ---------------------------------------------------------------------------------

def build():
    rng = random.Random(11)
    scene = new_scene(SCENE_NAME)
    material = palette_material()
    groups = {name: new_collection(scene, name) for name in ("Terrain", "Eau", "Decor", "Collisions", "Zones", "Reperes")}
    decor, markers = groups["Decor"], groups["Reperes"]
    ground = Ground(build_terrain(groups["Terrain"], material, rng))
    build_water(groups["Eau"], material)
    build_waterfall(decor, markers, material, rng)
    boulders = build_boulders(decor, material, rng, ground)
    build_reeds(decor, material, rng, ground)
    build_bridge(decor, material)
    campfire = build_campfire(decor, markers, material, rng, ground, camp_spot())
    build_trees(decor, material, rng, ground, campfire)
    build_flora(decor, material, ground, seed=211, half_size=(HALF_X - 30, 70), spots=river_flora(ground, campfire))
    build_colliders(groups["Collisions"], material, boulders)
    build_zones(groups["Zones"])
    build_markers(markers)
    return scene


def build_terrain(collection, material, rng):
    """Grille triangulée : lit de la rivière, graviers, prairies, versants boisés et marche de la cascade."""
    xs = grid_coords(HALF_X, HALF_X, TERRAIN_CELL, TERRAIN_FAR_CELL)
    ys = grid_coords(HALF_Y, FINE_HALF_Y, TERRAIN_CELL, TERRAIN_FAR_CELL)
    return build_grid_terrain(collection, material, rng, xs, ys, terrain_height, terrain_color)


def camp_spot():
    """Bivouac sur la rive gauche, un peu en aval du pont, face au départ de la barque."""
    x = SPAWN_X + 6
    return bank_point(x, half_width(x) + 5.5).to_2d()


def build_water(collection, material):
    """Emprise de l'eau jouable, de l'aval jusqu'au pied de la cascade (le jeu recrée la surface)."""
    xs = [x for x in range(-int(HALF_X), int(FALL_FOOT) + 3, 2)]
    left = [bank_point(x, half_width(x) + 0.8) for x in xs]
    right = [bank_point(x, -(half_width(x) + 0.8)) for x in reversed(xs)]
    builder = MeshBuilder()
    builder.polygon(left + right, rgba(0x4f9fb3))
    builder.to_object("water", material, collection)


def build_waterfall(collection, markers, material, rng):
    """Cascade : l'eau d'en haut (plate), le rideau qui tombe, l'écume au pied et des rochers autour. Embruns : `fx_mist_1`."""
    builder = MeshBuilder()
    xs = [x for x in range(int(FALL_TOP), int(HALF_X) + 1, 3)]
    upper = [bank_point(x, half_width(x) * 0.8) for x in xs] + [bank_point(x, -half_width(x) * 0.8) for x in reversed(xs)]
    builder.polygon([p + Vector((0, 0, FALL_HEIGHT - 0.1)) for p in upper], UPPER_WATER)
    width = half_width(FALL_TOP) * 0.8
    steps = 12
    for k in range(steps):
        y0 = center(FALL_TOP) - width + 2 * width * k / steps
        y1 = center(FALL_TOP) - width + 2 * width * (k + 1) / steps
        top = [Vector((FALL_TOP, y0, FALL_HEIGHT - 0.1)), Vector((FALL_TOP, y1, FALL_HEIGHT - 0.1))]
        bottom = [Vector((FALL_FOOT + 0.8, y1, 0.05)), Vector((FALL_FOOT + 0.8, y0, 0.05))]
        face = builder.polygon(top + bottom, FALL_COLORS[k % len(FALL_COLORS)])
        if face.normal.x > 0:
            face.normal_flip()
    for k in range(10):
        y = center(FALL_FOOT) - width + 2 * width * (k + 0.5) / 10
        builder.blob((FALL_FOOT + rng.uniform(-0.5, 0.6), y, 0.05), rng.uniform(0.5, 0.9), rgba(0xf4fbff), scale=(1.3, 1.0, 0.35), jitter=0.2, rng=rng)
    for side in (-1, 1):
        for k in range(4):
            y = center(FALL_TOP) + side * (width + 0.5 + k * 1.3)
            builder.blob((FALL_TOP - 1 + rng.uniform(-1, 1), y, FALL_HEIGHT * rng.uniform(0.3, 0.9)), rng.uniform(1.2, 2.0),
                         rng.choice(ROCK_GREY), scale=(1.1, 1.0, 1.2), jitter=0.2, rng=rng)
    builder.to_object("deco_waterfall", material, collection)
    # Nuage d'embruns au pied de la chute : l'avant de l'Empty regarde l'aval (-X), son échelle est la demi-largeur du nuage
    empty("fx_mist_1", markers, location=(FALL_FOOT - 0.5, center(FALL_FOOT), 0.6), rotation=(0, 0, -math.pi / 2), scale=width * 0.9,
          display='SINGLE_ARROW')


def build_boulders(collection, material, rng, ground):
    """Deux chaos de blocs dans le courant (zones de rochers) et des pierres sur les berges."""
    builder = MeshBuilder()
    spots = []
    for where, layout in ((BOULDERS_X, [(0, 0.3, 1.6), (3.5, -2.2, 1.2), (-3, -3.5, 1.0), (5.5, 3.0, 0.9)]),
                          (BOULDERS2_X, [(0, -1.5, 1.4), (-3.2, 2.4, 1.1), (3.4, 3.2, 1.2)])):
        for offset, across, size in layout:
            x = where + offset
            position = Vector((x, center(x) + across * 1.2))
            builder.blob((position.x, position.y, -0.6), size, rng.choice(ROCK_GREY), scale=(1.25, 1.0, 1.0), jitter=0.18, rng=rng)
            spots.append((position, size * 1.05))
    # Deux pierres sur l'île de graviers
    for dx, size in ((-3.5, 0.6), (4.5, 0.45)):
        add_shore_rock_at(builder, rng, ground, ISLE_X + dx, center(ISLE_X) + 0.4, size)
    for _ in range(34):
        x = rng.uniform(DOWNSTREAM_END - 10, FALL_FOOT - 6)
        side = rng.choice((-1, 1))
        spot = bank_point(x, side * (half_width(x) + rng.uniform(0.5, 4)))
        size, color = rng.uniform(0.4, 1.0), rng.choice(ROCK_GREY)
        # Posée au plus bas du sol sous elle : sur une berge en pente, elle ne flotte pas côté rivière
        builder.blob((spot.x, spot.y, ground.lowest_under(spot.x, spot.y, 1.2 * size)), size, color,
                     scale=(1.2, 1.0, 0.7), jitter=0.2, rng=rng)
    builder.to_object("deco_rocks", material, collection)
    return spots


def reed_beds():
    """Roselières : une anse calme côté rive droite en aval, une autre côté rive gauche en amont."""
    return [bank_point(BAY_X, -(half_width(BAY_X) - 2.5)), bank_point(REEDS2_X, half_width(REEDS2_X) - 2.5)]


def build_reeds(collection, material, rng, ground):
    """Roseaux des deux roselières."""
    builder = MeshBuilder()
    greens = [rgba(0xb9c56d), rgba(0x9fb45a), rgba(0xc8c779)]
    for spot in reed_beds():
        for _ in range(55):
            angle, distance = rng.uniform(0, 2 * math.pi), math.sqrt(rng.random()) * 3.5
            x, y = spot.x + math.cos(angle) * distance, spot.y + math.sin(angle) * distance
            base = ground.lowest_under(x, y, 0.06) - 0.05
            height = max(0.0, -base) + rng.uniform(1.1, 2.1)
            tilt = Matrix.Rotation(rng.uniform(-0.12, 0.12), 4, 'X') @ Matrix.Rotation(rng.uniform(-0.12, 0.12), 4, 'Y')
            builder.cone((x, y, base + height / 2), 0.05, 0.01, height, 4, rng.choice(greens), rotation=tilt)
            if rng.random() < 0.3:
                builder.cone((x, y, base + height - 0.3), 0.07, 0.07, 0.3, 5, rgba(0x7a5536))
    builder.to_object("deco_reeds_sway", material, collection)


def bridge_height(t):
    """Hauteur du tablier le long du pont (t de 0 à 1 d'une rive à l'autre) : une arche."""
    return BRIDGE_END + (BRIDGE_TOP - BRIDGE_END) * math.sin(math.pi * t)


def bridge_span():
    """Extrémités du pont (y), posées sur les berges."""
    reach = half_width(BRIDGE_X) + 4.5
    return center(BRIDGE_X) - reach, center(BRIDGE_X) + reach


def build_bridge(collection, material):
    """Pont de bois en arche au-dessus de la rivière : tablier, garde-corps, culées de pierre."""
    builder = MeshBuilder()
    start, end = bridge_span()
    segments = 21
    for k in range(segments):
        t0, t1 = k / segments, (k + 1) / segments
        y0, y1 = start + (end - start) * t0, start + (end - start) * t1
        z0, z1 = bridge_height(t0), bridge_height(t1)
        slope = Matrix.Rotation(math.atan2(z1 - z0, y1 - y0), 4, 'X')
        length = math.hypot(y1 - y0, z1 - z0) + 0.05
        # Les tronçons se chevauchent : largeurs alternées pour que leurs flancs ne soient pas dans le même plan
        wider = 0.02 * (k % 2)
        builder.box((BRIDGE_X, (y0 + y1) / 2, (z0 + z1) / 2), (2.4 + wider, length, 0.18), WOOD_LIGHT if k % 2 else WOOD, rotation=slope)
        for side in (-1, 1):
            builder.box((BRIDGE_X + side * 1.1, (y0 + y1) / 2, (z0 + z1) / 2 + 0.85), (0.08 + wider, length, 0.08 + wider), WOOD_DARK, rotation=slope)
            if k % 3 == 0:
                # Poteaux plus larges que la rambarde (10 cm au plus) : pas de flancs confondus
                builder.box((BRIDGE_X + side * 1.1, y0, z0 + 0.45), (0.12, 0.12, 0.9), WOOD_DARK)
    for y in (start, end):
        builder.box((BRIDGE_X, y, BRIDGE_END - 0.6), (3.2, 1.8, 1.4), rgba(0x9b9d97))
        # Lanterne sur chaque culée, côté aval (-X), face à la barque
        lamp_post(builder, collection, "deco_bridge_lamp", BRIDGE_X - 1.4, y, BRIDGE_END + 0.1)
    builder.to_object("deco_bridge", material, collection)


def river_flora(ground, campfire):
    """Où pousse la flore de la rivière : sur les berges, loin du pont, du bivouac et de la cascade ; galets au bord de l'eau et sur l'île."""
    bridge = Vector((BRIDGE_X, center(BRIDGE_X)))

    def land(x, y):
        return abs(y - center(x)) - half_width(x)

    def bank(x, y, near, far):
        return (near < land(x, y) < far and ground.height(x, y) - fall_rise(x) > 0.5 and ground.slope(x, y) < 0.4
                and (Vector((x, y)) - bridge).length > 6 and (Vector((x, y)) - campfire).length > 3.5 and abs(x - FALL_TOP) > 5)

    def isle(x, y):
        return isle_height(x, y) > 0.25

    def shingle(x, y):
        return -0.5 < land(x, y) < 2.5 and ground.height(x, y) - fall_rise(x) > 0.05 and abs(x - FALL_TOP) > 5

    return {
        "grass": Spot(560, lambda x, y: bank(x, y, 1.5, 26) or isle_height(x, y) > 0.5),
        "flowers": Spot(140, lambda x, y: bank(x, y, 2, 26)),
        "bushes": Spot(95, lambda x, y: bank(x, y, 3, 25)),
        "pebbles": Spot(170, lambda x, y: shingle(x, y) or isle(x, y)),
    }


def build_trees(collection, material, rng, ground, campfire):
    """Forêt sur les versants, à distance de l'eau, du pont, du bivouac et de la cascade ; un bouleau et un arbuste sur l'île."""
    builder = MeshBuilder()
    placed = 0
    bridge = Vector((BRIDGE_X, center(BRIDGE_X)))
    while placed < 290:
        x, y = rng.uniform(-(HALF_X - 8), HALF_X - 8), rng.uniform(-(HALF_Y - 8), HALF_Y - 8)
        land = abs(y - center(x)) - half_width(x)
        if land < 5 or (Vector((x, y)) - bridge).length < 16 or (Vector((x, y)) - campfire).length < 5 or abs(x - FALL_TOP) < 5:
            continue
        # Forêt plus dense près de la rivière, clairsemée sur les hauteurs
        if land > 40 and rng.random() < 0.5:
            continue
        scale = rng.uniform(0.8, 1.5)
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale)
        placed += 1
    for dx, scale, kind in ((-1.5, 0.75, 'birch'), (3.0, 0.5, 'leafy')):
        x, y = ISLE_X + dx, center(ISLE_X)
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale, kind=kind)
    builder.to_object("deco_trees_sway", material, collection)


def build_colliders(collection, material, boulders):
    """Collisions : les deux berges (bandes le long de l'eau), l'aval, le pied de la cascade, l'île, les blocs."""
    edge, far = int(HALF_X), HALF_Y + 30
    xs = [x for x in range(-edge, edge + 1, 2)]
    margin = 1.2
    left = [bank_point(x, half_width(x) - margin) for x in xs]
    flat_polygon_object("bank_left_col", collection, [left + [Vector((edge, far, 0)), Vector((-edge, far, 0))]], material)
    right = [bank_point(x, -(half_width(x) - margin)) for x in xs]
    flat_polygon_object("bank_right_col", collection, [list(reversed(right)) + [Vector((-edge, -far, 0)), Vector((edge, -far, 0))]], material)
    for name, x0, x1 in (("downstream_col", -edge, DOWNSTREAM_END), ("waterfall_col", FALL_FOOT - 2.5, edge)):
        flat_polygon_object(name, collection, [[Vector((x0, -80, 0)), Vector((x1, -80, 0)), Vector((x1, 80, 0)), Vector((x0, 80, 0))]], material)
    isle = [Vector((ISLE_X + math.cos(a) * (ISLE_LENGTH + 0.5), center(ISLE_X) + math.sin(a) * (ISLE_WIDTH + 0.5), 0))
            for a in (2 * math.pi * k / 20 for k in range(20))]
    flat_polygon_object("isle_col", collection, [isle], material)
    for index, (position, radius) in enumerate(boulders, start=1):
        flat_polygon_object(f"rock_{index:02d}_col", collection, [circle_points(position, radius, 12)], material)


def build_zones(collection):
    """Zones de pêche : Empties « cercle » couchés à plat (le rayon est leur échelle)."""
    flat = (math.pi / 2, 0, 0)
    bar = bank_point(BAR_X, 4.5)
    reeds = reed_beds()
    zones = [
        ("zone_deep_1", bank_point(POOL_X, 0), 10),
        ("zone_deep_2", bank_point(FALL_FOOT - 6, 0), 6),
        ("zone_deep_3", bank_point(CALM_X, 0), 11),
        ("zone_shallow_1", bar, 7),
        ("zone_shallow_2", bank_point(RIFFLE_X, 0), 7),
        ("zone_shallow_3", bank_point(ISLE_X, 0), 9),
        ("zone_rocks_1", bank_point(BOULDERS_X + 1, 0), 7.5),
        ("zone_rocks_2", bank_point(BOULDERS2_X, 0.5), 7),
        ("zone_reeds_1", reeds[0], 6),
        ("zone_reeds_2", reeds[1], 6),
    ]
    for name, position, radius in zones:
        empty(name, collection, location=(position.x, position.y, 0), rotation=flat, scale=radius, display='CIRCLE')


def build_markers(collection):
    """Départ en aval du pont, face à l'amont (+X) ; caméra 7 m derrière ; Moustache sur le pont ; courant vers l'aval."""
    spawn = empty("spawn_boat", collection, location=(SPAWN_X, center(SPAWN_X), 0), rotation=(0, 0, math.pi / 2), display='ARROWS', size=1.5)
    camera_position = Matrix.Translation(spawn.location) @ Matrix.Rotation(math.pi / 2, 4, 'Z') @ Vector((0, 7, 3.2))
    empty("cam_default", collection, location=camera_position, display='SINGLE_ARROW', size=1.0)
    cat = Vector((BRIDGE_X, center(BRIDGE_X) + 0.6, BRIDGE_TOP + 0.09))
    toward = spawn.location - cat
    empty("npc_cat", collection, location=cat, rotation=(0, 0, math.atan2(toward.x, -toward.y)), display='ARROWS', size=0.5)
    # L'avant d'un Empty regarde -Y : tourné de -90°, il regarde -X, vers l'aval. Échelle = vitesse (m/s).
    empty("water_flow", collection, location=(0, center(0), 1.0), rotation=(0, 0, -math.pi / 2), scale=FLOW_SPEED,
          display='SINGLE_ARROW', size=3.0)
