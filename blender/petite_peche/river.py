"""Niveau river_01 : une rivière sinueuse au fond d'un vallon boisé, avec une
cascade en amont, une fosse profonde, un banc de graviers, des blocs de
rocher, une anse à roseaux et un vieux pont de bois en arche (où Moustache
s'installe).

Suit docs/BLENDER_CONVENTIONS.md, plus `water_flow` (courant). L'eau coule
vers -X (l'aval) ; l'amont et la cascade sont vers +X. Unités : mètres, Z
vers le haut, l'avant d'un objet regarde -Y.
"""

import math
import random

from mathutils import Matrix, Vector

from .common import Ground, MeshBuilder, circle_points, empty, flat_polygon_object, new_collection, new_scene, palette_material, rgba, smoothstep
from .level import ROCK_GREY, WOOD, WOOD_DARK, WOOD_LIGHT, add_tree, tree_base

SCENE_NAME = "river_01"

TERRAIN_HALF_SIZE = 100.0
TERRAIN_CELL = 2.0
# Abscisses (m) : fin de la rivière jouable en aval, pied de la cascade, sommet de la cascade
DOWNSTREAM_END = -68.0
FALL_FOOT, FALL_TOP = 55.0, 58.0
FALL_HEIGHT = 4.4
BRIDGE_X = -5.0
BRIDGE_TOP, BRIDGE_END = 5.2, 1.2
FLOW_SPEED = 0.6
POOL_X, BAR_X, RIFFLE_X, BOULDERS_X, BAY_X = 35.0, -32.0, 12.0, 22.0, -50.0

GRASS = [rgba(0x9dc27b), rgba(0x96bd74), rgba(0xa3c683)]
GRAVEL = [rgba(0xb8b09a), rgba(0xaca590)]
RIVERBED = rgba(0x8f8a6e)
HILL = rgba(0x86ab70)
FALL_COLORS = [rgba(0xeaf6fb), rgba(0xbfe3ee), rgba(0xd8eff5)]
UPPER_WATER = rgba(0x5fa6b8)


# --- Tracé de la rivière et relief ------------------------------------------------------------

def center(x):
    """Ordonnée du milieu de la rivière : des méandres doux."""
    return 9 * math.sin(x * 0.035) + 4 * math.sin(x * 0.08 + 1.0)


def half_width(x):
    """Demi-largeur de l'eau ; elle s'élargit dans la fosse sous la cascade."""
    return 9 + 2.5 * math.sin(x * 0.05 + 0.5) + 4 * math.exp(-((x - POOL_X) / 12) ** 2)


def depth(x, y):
    """Profondeur au milieu du lit : fosse, radier (peu profond), banc de graviers."""
    base = 2.2 + 2.3 * math.exp(-((x - POOL_X) / 9) ** 2) - 1.0 * math.exp(-((x - RIFFLE_X) / 7) ** 2)
    bar = 1.4 * math.exp(-((x - BAR_X) / 8) ** 2) * smoothstep(-2, 6, y - center(x))
    return max(0.6, base - bar)


def fall_rise(x):
    """Marche de la cascade : tout le relief s'élève en amont."""
    return FALL_HEIGHT * smoothstep(FALL_FOOT, FALL_TOP, x)


def terrain_height(x, y):
    across = abs(y - center(x))
    width = half_width(x)
    if across < width:
        height = -depth(x, y) * (1 - (across / width) ** 2) ** 0.8 - 0.05
    else:
        land = across - width
        meadow = 1.2 + 1.0 * math.sin(x * 0.06 + 1.1) * math.cos(y * 0.05)
        height = 0.7 * smoothstep(0, 4, land) + meadow * smoothstep(4, 20, land) + 12 * smoothstep(24, 70, land)
    return height + fall_rise(x)


def terrain_color(height, slope, x, rng):
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
    ground = Ground(build_terrain(groups["Terrain"], material, rng))
    build_water(groups["Eau"], material)
    build_waterfall(groups["Decor"], material, rng)
    boulders = build_boulders(groups["Decor"], material, rng, ground)
    build_reeds(groups["Decor"], material, rng, ground)
    build_bridge(groups["Decor"], material)
    build_trees(groups["Decor"], material, rng, ground)
    build_colliders(groups["Collisions"], material, boulders)
    build_zones(groups["Zones"])
    build_markers(groups["Reperes"])
    return scene


def build_terrain(collection, material, rng):
    """Grille triangulée : lit de la rivière, graviers, prairies, versants boisés et marche de la cascade."""
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
                x = sum(p.x for p in triangle) / 3
                builder.polygon(triangle, terrain_color(height, 1 - normal.z, x, rng))
    return builder.to_object("deco_terrain", material, collection)


def build_water(collection, material):
    """Emprise de l'eau jouable, de l'aval jusqu'au pied de la cascade (le jeu recrée la surface)."""
    xs = [x for x in range(-100, int(FALL_FOOT) + 3, 2)]
    left = [bank_point(x, half_width(x) + 0.8) for x in xs]
    right = [bank_point(x, -(half_width(x) + 0.8)) for x in reversed(xs)]
    builder = MeshBuilder()
    builder.polygon(left + right, rgba(0x4f9fb3))
    builder.to_object("water", material, collection)


def build_waterfall(collection, material, rng):
    """Cascade : l'eau d'en haut (plate), le rideau qui tombe, l'écume au pied et des rochers autour."""
    builder = MeshBuilder()
    xs = [x for x in range(int(FALL_TOP), 101, 3)]
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


def build_boulders(collection, material, rng, ground):
    """Blocs dans le courant (zone de rochers) et quelques pierres sur les berges."""
    builder = MeshBuilder()
    spots = []
    for offset, across, size in [(0, 0.3, 1.6), (3.5, -2.2, 1.2), (-3, -3.5, 1.0), (5.5, 3.0, 0.9)]:
        x = BOULDERS_X + offset
        position = Vector((x, center(x) + across * 1.2))
        builder.blob((position.x, position.y, -0.6), size, rng.choice(ROCK_GREY), scale=(1.25, 1.0, 1.0), jitter=0.18, rng=rng)
        spots.append((position, size * 1.05))
    for _ in range(18):
        x = rng.uniform(-80, 50)
        side = rng.choice((-1, 1))
        spot = bank_point(x, side * (half_width(x) + rng.uniform(0.5, 4)))
        size, color = rng.uniform(0.4, 1.0), rng.choice(ROCK_GREY)
        # Posée au plus bas du sol sous elle : sur une berge en pente, elle ne flotte pas côté rivière
        builder.blob((spot.x, spot.y, ground.lowest_under(spot.x, spot.y, 1.2 * size)), size, color,
                     scale=(1.2, 1.0, 0.7), jitter=0.2, rng=rng)
    builder.to_object("deco_rocks", material, collection)
    return spots


def reeds_center():
    return bank_point(BAY_X, -(half_width(BAY_X) - 2.5))


def build_reeds(collection, material, rng, ground):
    """Roseaux dans une anse calme, côté rive droite."""
    builder = MeshBuilder()
    greens = [rgba(0xb9c56d), rgba(0x9fb45a), rgba(0xc8c779)]
    spot = reeds_center()
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
    segments = 18
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
    builder.to_object("deco_bridge", material, collection)


def build_trees(collection, material, rng, ground):
    """Forêt sur les versants, à distance de l'eau, du pont et de la cascade."""
    builder = MeshBuilder()
    placed = 0
    bridge = Vector((BRIDGE_X, center(BRIDGE_X)))
    while placed < 120:
        x, y = rng.uniform(-92, 92), rng.uniform(-92, 92)
        land = abs(y - center(x)) - half_width(x)
        if land < 5 or (Vector((x, y)) - bridge).length < 16 or abs(x - FALL_TOP) < 5:
            continue
        scale = rng.uniform(0.8, 1.5)
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale)
        placed += 1
    builder.to_object("deco_trees_sway", material, collection)


def build_colliders(collection, material, boulders):
    """Collisions : les deux berges (bandes le long de l'eau), l'aval, le pied de la cascade, les blocs."""
    xs = [x for x in range(-100, 101, 2)]
    margin = 1.2
    left = [bank_point(x, half_width(x) - margin) for x in xs]
    flat_polygon_object("bank_left_col", collection, [left + [Vector((100, 130, 0)), Vector((-100, 130, 0))]], material)
    right = [bank_point(x, -(half_width(x) - margin)) for x in xs]
    flat_polygon_object("bank_right_col", collection, [list(reversed(right)) + [Vector((-100, -130, 0)), Vector((100, -130, 0))]], material)
    for name, x0, x1 in (("downstream_col", -100, DOWNSTREAM_END), ("waterfall_col", FALL_FOOT - 2.5, 100)):
        flat_polygon_object(name, collection, [[Vector((x0, -60, 0)), Vector((x1, -60, 0)), Vector((x1, 60, 0)), Vector((x0, 60, 0))]], material)
    for index, (position, radius) in enumerate(boulders, start=1):
        flat_polygon_object(f"rock_{index:02d}_col", collection, [circle_points(position, radius, 12)], material)


def build_zones(collection):
    """Zones de pêche : Empties « cercle » couchés à plat (le rayon est leur échelle)."""
    flat = (math.pi / 2, 0, 0)
    bar = bank_point(BAR_X, 4.0)
    zones = [
        ("zone_deep_1", bank_point(POOL_X, 0), 9),
        ("zone_deep_2", bank_point(FALL_FOOT - 5, 0), 5),
        ("zone_shallow_1", bar, 6),
        ("zone_shallow_2", bank_point(RIFFLE_X, 0), 6),
        ("zone_rocks_1", bank_point(BOULDERS_X + 1, 0), 7),
        ("zone_reeds_1", reeds_center(), 5.5),
    ]
    for name, position, radius in zones:
        empty(name, collection, location=(position.x, position.y, 0), rotation=flat, scale=radius, display='CIRCLE')


def build_markers(collection):
    """Départ en aval du pont, face à l'amont (+X) ; caméra 7 m derrière ; Moustache sur le pont ; courant vers l'aval."""
    spawn_x = -22.0
    spawn = empty("spawn_boat", collection, location=(spawn_x, center(spawn_x), 0), rotation=(0, 0, math.pi / 2), display='ARROWS', size=1.5)
    camera_position = Matrix.Translation(spawn.location) @ Matrix.Rotation(math.pi / 2, 4, 'Z') @ Vector((0, 7, 3.2))
    empty("cam_default", collection, location=camera_position, display='SINGLE_ARROW', size=1.0)
    cat = Vector((BRIDGE_X, center(BRIDGE_X) + 0.6, BRIDGE_TOP + 0.09))
    toward = spawn.location - cat
    empty("npc_cat", collection, location=cat, rotation=(0, 0, math.atan2(toward.x, -toward.y)), display='ARROWS', size=0.5)
    # L'avant d'un Empty regarde -Y : tourné de -90°, il regarde -X, vers l'aval. Échelle = vitesse (m/s).
    empty("water_flow", collection, location=(0, center(0), 1.0), rotation=(0, 0, -math.pi / 2), scale=FLOW_SPEED,
          display='SINGLE_ARROW', size=3.0)
