"""Niveau lake_01 : un lac aux rives irrégulières, une île, un ponton, une cabane,
des roseaux, des rochers et une forêt de sapins et de feuillus.

Suit docs/BLENDER_CONVENTIONS.md : `water`, `spawn_boat`, `cam_default`,
`zone_<type>_<n>`, `*_col`, `deco_*`. Unités : mètres, Z vers le haut,
l'avant d'un objet regarde -Y.
"""

import math
import random

from mathutils import Matrix, Vector

from .common import (Ground, patchy, emissive_material, emissive_object, MeshBuilder, circle_points, empty, flat_polygon_object, new_collection, new_scene,
                     oriented_quad, palette_material, rgba, smoothstep)
from .flora import Spot, build_flora, far_from

SCENE_NAME = "lake_01"

# Terrain : grille carrée centrée sur le lac
TERRAIN_HALF_SIZE = 100.0
TERRAIN_CELL = 2.5
LAKE_BOTTOM = 4.5
ISLAND_CENTER = Vector((9.0, 8.0))

GRASS = [rgba(0x9dc27b), rgba(0x96bd74), rgba(0xa3c683)]
SAND = [rgba(0xd8c59a), rgba(0xd2bf92)]
LAKEBED = rgba(0xb9a97e)
DRY_GRASS = rgba(0xbcc58a)
HILL = rgba(0x86ab70)
ROCK_GREY = [rgba(0xa9aaa4), rgba(0x9b9d97), rgba(0xb4b3ac)]
WOOD = rgba(0x9a6b47)
WOOD_LIGHT = rgba(0xb98a5c)
WOOD_DARK = rgba(0x6f4a32)
ROOF = rgba(0xa0503c)


# --- Forme du lac et relief ---------------------------------------------------------------------

def shore_radius(theta):
    """Distance du centre à la rive selon l'angle : un lac aux contours irréguliers."""
    return 34 + 5 * math.sin(2 * theta + 0.6) + 3 * math.sin(3 * theta - 1.1) + 1.5 * math.sin(5 * theta + 2.0)


def lake_distance(x, y):
    """Distance à la rive : positive dans l'eau, négative à terre."""
    return shore_radius(math.atan2(y, x)) - math.hypot(x, y)


def point_from_shore(theta, inward):
    """Point à `inward` mètres de la rive vers le centre (négatif = à terre)."""
    radius = shore_radius(theta) - inward
    return Vector((math.cos(theta) * radius, math.sin(theta) * radius))


def hills(x, y):
    return 2.5 + 2.5 * math.sin(x * 0.055 + 1.3) * math.cos(y * 0.047 - 0.4) + 1.2 * math.sin(x * 0.13 - y * 0.09)


def terrain_height(x, y):
    distance = lake_distance(x, y)
    if distance > 0:
        height = -LAKE_BOTTOM * smoothstep(0, 14, distance)
    else:
        land = -distance
        height = 0.9 * smoothstep(0, 5, land) + hills(x, y) * smoothstep(10, 40, land)
        # Collines qui ferment l'horizon au bord du terrain
        height += 14 * smoothstep(68, 98, max(abs(x), abs(y)))
    island = 1.25 - 0.55 * (Vector((x, y)) - ISLAND_CENTER).length
    return max(height, island)


def terrain_color(height, slope, rng):
    if height < -0.6:
        return LAKEBED
    if height < 0.45:
        return rng.choice(SAND)
    if height < 0.75:
        return DRY_GRASS
    if slope > 0.5:
        return rng.choice(ROCK_GREY)
    if height > 9:
        return HILL
    return rng.choice(GRASS)


# --- Construction ---------------------------------------------------------------------

def build():
    rng = random.Random(7)
    scene = new_scene(SCENE_NAME)
    material = palette_material()
    groups = {name: new_collection(scene, name) for name in ("Terrain", "Eau", "Decor", "Collisions", "Zones", "Reperes")}
    south = shore_radius(-math.pi / 2)

    ground = Ground(build_terrain(groups["Terrain"], material, rng))
    build_water(groups["Eau"], material)
    rock_spots = build_rocks(groups["Decor"], material, rng)
    reed_spots = build_reeds(groups["Decor"], material, rng)
    cabin = Vector((9.5, -(south + 10)))
    jetty = build_jetty(groups["Decor"], material, south)
    build_cabin(groups["Decor"], material, cabin)
    pen = build_fish_pen(groups["Decor"], groups["Reperes"], material, Vector((2.4, -(south + 5.6))))
    avoid = [(cabin, 7.0), (jetty, 6.0), (pen, 3.5)]
    build_trees(groups["Decor"], material, rng, ground, avoid=avoid)
    build_flora(groups["Decor"], material, ground, seed=107, half_size=70, spots=lake_flora(ground, avoid))
    build_colliders(groups["Collisions"], material, rock_spots, south)
    build_zones(groups["Zones"], rock_spots, reed_spots, south)
    build_markers(groups["Reperes"], south)
    return scene


def build_terrain(collection, material, rng):
    """Grille triangulée : fond du lac, plage, prairie et collines, île comprise."""
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
                middle = sum(triangle, Vector()) / 3
                builder.polygon(triangle, patchy(terrain_color(height, 1 - normal.z, rng), middle.x, middle.y))
    return builder.to_object("deco_terrain", material, collection)


def build_water(collection, material):
    """Plan d'eau (seule son emprise compte : le jeu recrée sa propre surface)."""
    builder = MeshBuilder()
    builder.polygon(circle_points((0, 0), 50, 64), rgba(0x4f9fb3))
    builder.to_object("water", material, collection)


def build_rocks(collection, material, rng):
    """Amas de rochers près de la rive nord-ouest (dans l'eau) et quelques-uns sur la berge."""
    builder = MeshBuilder()
    center = point_from_shore(2.5, 6.0)
    spots = []
    for offset, size in [((0, 0), 2.0), ((2.6, 1.8), 1.4), ((-2.2, 2.0), 1.1), ((1.2, -2.6), 1.6)]:
        position = center + Vector(offset)
        builder.blob((position.x, position.y, -0.7), size, rng.choice(ROCK_GREY), scale=(1.2, 1.0, 0.95), jitter=0.18, rng=rng)
        spots.append((position, size * 1.05))
    for _ in range(7):
        spot = point_from_shore(2.5 + rng.uniform(-0.25, 0.25), -rng.uniform(2, 7))
        size = rng.uniform(0.5, 1.1)
        builder.blob((spot.x, spot.y, terrain_height(spot.x, spot.y)), size, rng.choice(ROCK_GREY), scale=(1.2, 1.0, 0.7), jitter=0.2, rng=rng)
    builder.to_object("deco_rocks", material, collection)
    return {"center": center, "spots": spots}


def build_reeds(collection, material, rng):
    """Deux touffes de roseaux (certains avec une massette brune) dans l'eau peu profonde."""
    builder = MeshBuilder()
    centers = [point_from_shore(0.35, 4.5), point_from_shore(3.9, 4.0)]
    greens = [rgba(0xb9c56d), rgba(0x9fb45a), rgba(0xc8c779)]
    for center in centers:
        for _ in range(45):
            angle, distance = rng.uniform(0, 2 * math.pi), math.sqrt(rng.random()) * 3.2
            x, y = center.x + math.cos(angle) * distance, center.y + math.sin(angle) * distance
            base = terrain_height(x, y)
            height = -base + rng.uniform(1.1, 2.1)
            tilt = Matrix.Rotation(rng.uniform(-0.12, 0.12), 4, 'X') @ Matrix.Rotation(rng.uniform(-0.12, 0.12), 4, 'Y')
            builder.cone((x, y, base + height / 2), 0.05, 0.01, height, 4, rng.choice(greens), rotation=tilt)
            if rng.random() < 0.3:
                builder.cone((x, y, base + height - 0.3), 0.07, 0.07, 0.3, 5, rgba(0x7a5536))
    builder.to_object("deco_reeds_sway", material, collection)
    return centers


def lamp_glass_material():
    """Verre des lanternes : ambré le jour, lueur chaude la nuit (le jeu règle l'intensité)."""
    return emissive_material("LampGlass", 0xfff0c8, 0xffb35c, 1.0)


def window_material():
    """Vitre des cabanes : gris-bleu le jour, éclairée de l'intérieur la nuit."""
    return emissive_material("WindowGlow", 0x8fa9b4, 0xffc27a, 1.0)


def lamp_post(builder, collection, name, x, y, base, height=1.5):
    """
    Poteau de bois surmonté d'une lanterne. Le poteau et le petit toit vont
    dans `builder` (le ponton, le quai…) ; le verre est un objet émissif à
    part (`name`), qui s'allume la nuit.
    """
    builder.box((x, y, base + height / 2), (0.1, 0.1, height), WOOD_DARK)
    builder.box((x, y, base + height + 0.3), (0.26, 0.26, 0.04), WOOD_DARK)
    glass = MeshBuilder()
    glass.box((x, y, base + height + 0.13), (0.18, 0.18, 0.28), rgba(0xfff0c8))
    return emissive_object(glass, name, lamp_glass_material(), collection)


def build_jetty(collection, material, south):
    """Ponton en bois qui s'avance dans l'eau, au sud, près du départ de la barque."""
    builder = MeshBuilder()
    x, start, end = 5.5, -(south + 4), -(south - 5)
    y = start
    plank = 0
    while y < end:
        builder.box((x, y + 0.15, 0.55), (1.9, 0.27, 0.06), WOOD_LIGHT if plank % 2 else WOOD)
        y += 0.3
        plank += 1
    y = start + 0.8
    while y < end:
        for side in (-0.85, 0.85):
            bottom = terrain_height(x + side, y) - 0.3
            builder.box((x + side, y, (0.55 + bottom) / 2), (0.14, 0.14, 0.55 - bottom), WOOD_DARK)
        y += 1.8
    # Lanterne au bout du ponton, du côté du départ de la barque (Moustache est au milieu)
    lamp_post(builder, collection, "deco_jetty_lamp", x - 0.85, end - 0.3, 0.58)
    builder.to_object("deco_jetty", material, collection)
    return Vector((x, (start + end) / 2))


PEN_SIDES = 16
PEN_OUTER, PEN_INNER, PEN_DEPTH = 1.25, 1.17, 0.6
METAL = rgba(0x5d6468)


def build_fish_pen(decor, markers, material, center):
    """Vivier : grand bac en bois cerclé, posé sur la plage près du ponton.

    Le bac (`deco_fish_pen`) est ouvert en haut ; le jeu y ajoute l'eau et les
    poissons gardés, d'après l'Empty `fish_pen` (centre de la surface de
    l'eau, rayon = échelle). `cam_fish_pen` donne le point de vue rapproché.
    """
    heights = [terrain_height(center.x + dx, center.y + dy) for dx in (-1.3, 0, 1.3) for dy in (-1.3, 0, 1.3)]
    base, floor = min(heights) - 0.05, max(heights) + 0.03
    top = floor + PEN_DEPTH
    builder = MeshBuilder()
    build_pen_walls(builder, center, base, top)
    ring = [pen_point(center, PEN_INNER, i, floor) for i in range(PEN_SIDES)]
    oriented_quad(builder, ring, WOOD_DARK, Vector((center.x, center.y, floor + 1)), away=False)
    builder.to_object("deco_fish_pen", material, decor)
    water = top - 0.08
    empty("fish_pen", markers, location=(center.x, center.y, water), rotation=(math.pi / 2, 0, 0),
          scale=PEN_INNER - 0.02, display='CIRCLE')
    empty("cam_fish_pen", markers, location=(center.x - 0.8, center.y - 2.4, water + 2.2), display='SINGLE_ARROW', size=0.5)
    return center


def build_pen_walls(builder, center, base, top):
    """Douelles (extérieur et intérieur), dessus du bord et deux cercles de métal."""
    axis = lambda z: Vector((center.x, center.y, z))
    for i in range(PEN_SIDES):
        mid = (base + top) / 2
        color = WOOD if i % 2 else WOOD_LIGHT
        outer = [pen_point(center, PEN_OUTER, i, base), pen_point(center, PEN_OUTER, i + 1, base),
                 pen_point(center, PEN_OUTER, i + 1, top), pen_point(center, PEN_OUTER, i, top)]
        oriented_quad(builder, outer, color, axis(mid))
        inner = [pen_point(center, PEN_INNER, i, base), pen_point(center, PEN_INNER, i + 1, base),
                 pen_point(center, PEN_INNER, i + 1, top), pen_point(center, PEN_INNER, i, top)]
        oriented_quad(builder, inner, WOOD_DARK, axis(mid), away=False)
        rim = [pen_point(center, PEN_INNER, i, top), pen_point(center, PEN_INNER, i + 1, top),
               pen_point(center, PEN_OUTER, i + 1, top), pen_point(center, PEN_OUTER, i, top)]
        oriented_quad(builder, rim, WOOD_LIGHT, axis(top - 1))
        for band in (base + 0.18, top - 0.1):
            hoop = [pen_point(center, PEN_OUTER + 0.015, i, band - 0.03), pen_point(center, PEN_OUTER + 0.015, i + 1, band - 0.03),
                    pen_point(center, PEN_OUTER + 0.015, i + 1, band + 0.03), pen_point(center, PEN_OUTER + 0.015, i, band + 0.03)]
            oriented_quad(builder, hoop, METAL, axis(band))


def pen_point(center, radius, index, z):
    angle = 2 * math.pi * index / PEN_SIDES
    return Vector((center.x + math.cos(angle) * radius, center.y + math.sin(angle) * radius, z))


def build_cabin(collection, material, position):
    """Petite cabane de pêcheur : murs en bois, toit à deux pentes, porte, fenêtre, cheminée."""
    builder = MeshBuilder()
    x, y = position
    z = terrain_height(x, y) - 0.1
    builder.box((x, y, z + 1.2), (4.0, 3.2, 2.4), WOOD)
    for side in (-1, 1):
        roof = Matrix.Rotation(side * 0.55, 4, 'Y')
        # Pans de longueurs un peu différentes : leurs bouts ne sont pas dans le même plan (sinon ils clignotent au faîtage)
        builder.box((x + side * 1.05, y, z + 2.95), (2.5, 3.7 if side < 0 else 3.74, 0.14), ROOF, rotation=roof)
    builder.box((x - 0.8, y - 1.62, z + 0.95), (0.8, 0.06, 1.8), WOOD_DARK)
    builder.box((x + 0.9, y - 1.62, z + 1.4), (0.9, 0.06, 0.7), rgba(0xcfe3ea))
    builder.box((x + 1.2, y + 0.8, z + 3.4), (0.4, 0.4, 1.2), rgba(0x8a8a84))
    builder.to_object("deco_cabin", material, collection)
    # Fenêtre côté lac : allumée la nuit
    window = MeshBuilder()
    window.box((x - 0.7, y + 1.62, z + 1.4), (0.9, 0.06, 0.7), rgba(0x8fa9b4))
    emissive_object(window, "deco_cabin_window", window_material(), collection)


def lake_flora(ground, avoid):
    """Où pousse la flore du lac : sur la berge, près de l'eau, loin de la cabane, du ponton et du vivier."""
    clear = far_from([((center.x, center.y), radius) for center, radius in avoid])

    def meadow(x, y):
        land = -lake_distance(x, y)
        return 1.5 < land < 35 and ground.height(x, y) > 0.75 and ground.slope(x, y) < 0.4 and clear(x, y)

    def island(x, y):
        return (Vector((x, y)) - ISLAND_CENTER).length < 2.3 and ground.height(x, y) > 0.55

    def beach(x, y):
        return 0 < -lake_distance(x, y) < 4 and 0.1 < ground.height(x, y) < 0.5 and clear(x, y)

    return {
        "grass": Spot(380, lambda x, y: meadow(x, y) or island(x, y)),
        "flowers": Spot(90, meadow),
        "bushes": Spot(60, lambda x, y: meadow(x, y) and -lake_distance(x, y) > 3),
        "pebbles": Spot(70, beach),
    }


def build_trees(collection, material, rng, ground, avoid):
    """Forêt autour du lac (sapins surtout, quelques feuillus) et deux arbres sur l'île."""
    builder = MeshBuilder()
    placed = 0
    while placed < 95:
        x, y = rng.uniform(-88, 88), rng.uniform(-88, 88)
        if lake_distance(x, y) > -4 or any((Vector((x, y)) - center).length < radius for center, radius in avoid):
            continue
        scale = rng.uniform(0.8, 1.5)
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale)
        placed += 1
    for dx, dy, scale, fir in [(0.0, 0.0, 1.1, True), (1.2, -0.8, 0.6, False)]:
        x, y = ISLAND_CENTER.x + dx, ISLAND_CENTER.y + dy
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale, fir=fir)
    builder.to_object("deco_trees_sway", material, collection)


# Les arbres sont enfoncés un peu sous le point le plus bas du sol autour du tronc
TREE_SINK = 0.08


def tree_base(ground, x, y, scale):
    """
    Pied d'un arbre : sous le point le plus bas du sol autour du tronc (jamais
    en l'air sur une pente). L'enfoncement varie de 0 à 2 cm d'un arbre à
    l'autre (d'après sa position) : deux arbres voisins n'ont jamais leurs
    étages de feuillage exactement à la même hauteur (faces confondues).
    """
    variation = 0.02 * ((x * 7.13 + y * 3.71) % 1.0)
    return ground.lowest_under(x, y, 0.25 * scale) - TREE_SINK - variation


def add_tree(builder, rng, x, y, z, scale, fir=None):
    fir = rng.random() < 0.7 if fir is None else fir
    trunk = rgba(0x8a6a4f)
    # Chaque arbre tourné à sa façon (angle tiré de sa position, sans toucher au tirage aléatoire) :
    # la forêt paraît moins uniforme, et deux arbres voisins n'ont pas de faces confondues
    spin = Matrix.Rotation((x * 12.9898 + y * 78.233) % (2 * math.pi), 4, 'Z')
    if fir:
        green = rng.choice([rgba(0x5f9e6e), rgba(0x71ad73), rgba(0x4f8a67)])
        builder.cone((x, y, z + 0.7 * scale), 0.22 * scale, 0.18 * scale, 1.4 * scale, 6, trunk, rotation=spin)
        for height, radius, depth in [(1.9, 1.7, 2.4), (3.0, 1.3, 2.0), (4.0, 0.85, 1.6)]:
            builder.cone((x, y, z + height * scale), radius * scale, 0.0, depth * scale, 7, green, rotation=spin)
    else:
        green = rng.choice([rgba(0x8fbf6a), rgba(0x7fb068), rgba(0xa7c96e)])
        builder.cone((x, y, z + 0.9 * scale), 0.2 * scale, 0.15 * scale, 1.8 * scale, 6, trunk, rotation=spin)
        builder.blob((x, y, z + 2.6 * scale), 1.5 * scale, green, scale=(1.0, 1.0, 0.85), jitter=0.12, rng=rng, rotation=spin)


def build_colliders(collection, material, rocks, south):
    """Collisions (vues de dessus) : berge, île, rochers, ponton."""
    ring = []
    segments = 128
    for i in range(segments):
        a0, a1 = 2 * math.pi * i / segments, 2 * math.pi * (i + 1) / segments
        inner0, inner1 = shore_radius(a0) - 1.8, shore_radius(a1) - 1.8
        ring.append([Vector((math.cos(a0) * inner0, math.sin(a0) * inner0, 0)), Vector((math.cos(a0) * 120, math.sin(a0) * 120, 0)),
                     Vector((math.cos(a1) * 120, math.sin(a1) * 120, 0)), Vector((math.cos(a1) * inner1, math.sin(a1) * inner1, 0))])
    flat_polygon_object("shore_col", collection, ring, material)
    flat_polygon_object("island_col", collection, [circle_points(ISLAND_CENTER, 2.9, 16)], material)
    for index, (position, radius) in enumerate(rocks["spots"], start=1):
        flat_polygon_object(f"rock_{index:02d}_col", collection, [circle_points(position, radius, 12)], material)
    x, start, end = 5.5, -(south + 1), -(south - 5.2)
    flat_polygon_object("jetty_col", collection, [[Vector((x - 1.1, start, 0)), Vector((x + 1.1, start, 0)),
                                                   Vector((x + 1.1, end, 0)), Vector((x - 1.1, end, 0))]], material)


def build_zones(collection, rocks, reeds, south):
    """Zones de pêche : Empties « cercle » couchés à plat (le rayon est leur échelle)."""
    flat = (math.pi / 2, 0, 0)
    zones = [
        ("zone_shallow_1", point_from_shore(-math.pi / 2 + 0.5, 5), 7),
        ("zone_shallow_2", point_from_shore(1.4, 5), 7),
        ("zone_deep_1", Vector((-3.0, 2.0)), 12),
        ("zone_reeds_1", reeds[0], 6.5),
        ("zone_reeds_2", reeds[1], 6.5),
        ("zone_rocks_1", rocks["center"], 7),
    ]
    for name, position, radius in zones:
        empty(name, collection, location=(position.x, position.y, 0), rotation=flat, scale=radius, display='CIRCLE')


def build_markers(collection, south):
    """Départ de la barque (face au centre du lac, donc vers +Y), caméra 7 m derrière, et Moustache."""
    spawn = empty("spawn_boat", collection, location=(0, -(south - 9), 0), rotation=(0, 0, math.pi), display='ARROWS', size=1.5)
    camera_position = Matrix.Translation(spawn.location) @ Matrix.Rotation(math.pi, 4, 'Z') @ Vector((0, 7, 3.2))
    empty("cam_default", collection, location=camera_position, display='SINGLE_ARROW', size=1.0)
    build_cat_marker(collection, south, spawn.location)


def build_cat_marker(collection, south, spawn):
    """`npc_cat` : Moustache assis au bout du ponton (sur le tablier), tourné vers la barque au départ."""
    position = Vector((5.5, -(south - 5) - 0.8, 0.58))
    toward = spawn - position
    heading = math.atan2(toward.x, -toward.y)  # l'avant d'un objet regarde -Y
    empty("npc_cat", collection, location=position, rotation=(0, 0, heading), display='ARROWS', size=0.5)
