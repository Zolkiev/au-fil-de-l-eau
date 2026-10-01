"""Niveau lake_01 : un grand lac aux rives découpées, une île boisée et un îlot
de rochers, un ponton et la cabane de Moustache au sud (avec le vivier et un
feu de camp), un hangar à barques et son appontement au nord, des roseaux,
des rochers et une forêt de sapins, de feuillus et de bouleaux.

Suit docs/BLENDER_CONVENTIONS.md : `water`, `spawn_boat`, `cam_default`,
`zone_<type>_<n>`, `*_col`, `deco_*`, `fx_*`. Unités : mètres, Z vers le
haut, l'avant d'un objet regarde -Y.
"""

import math
import random

from mathutils import Matrix, Vector

from .common import (Ground, build_grid_terrain, emissive_material, emissive_object, MeshBuilder, circle_points, empty, find_spots,
                     flat_polygon_object, grid_coords, new_collection, new_scene, oriented_quad, palette_material, rgba, smoothstep)
from .flora import Spot, build_flora, far_from

SCENE_NAME = "lake_01"

# Terrain : grille carrée centrée sur le lac, fine sur le lac et ses berges, large sur les collines du fond
TERRAIN_HALF_SIZE = 150.0
TERRAIN_FINE_HALF = 92.5
TERRAIN_CELL = 2.5
TERRAIN_FAR_CELL = 6.0
LAKE_BOTTOM = 5.0
# Îles : centre, hauteur du sommet (m) et pente (m par m). Rayon à fleur d'eau = sommet / pente.
ISLAND = (Vector((14.0, 2.0)), 1.7, 0.34)
ISLET = (Vector((-24.0, 10.0)), 1.0, 0.42)
ISLAND_CENTER = ISLAND[0]

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
ASH = rgba(0x4a4541)


# --- Forme du lac et relief ---------------------------------------------------------------------

def shore_radius(theta):
    """Distance du centre à la rive selon l'angle : un lac aux contours découpés (baies et pointes)."""
    return 56 + 8 * math.sin(2 * theta + 0.6) + 5 * math.sin(3 * theta - 1.1) + 3 * math.sin(5 * theta + 2.0)


def lake_distance(x, y):
    """Distance à la rive : positive dans l'eau, négative à terre."""
    return shore_radius(math.atan2(y, x)) - math.hypot(x, y)


def point_from_shore(theta, inward):
    """Point à `inward` mètres de la rive vers le centre (négatif = à terre)."""
    radius = shore_radius(theta) - inward
    return Vector((math.cos(theta) * radius, math.sin(theta) * radius))


def shore_y(x, side):
    """Ordonnée de la rive à l'abscisse `x` : rive nord (side = 1) ou sud (side = -1)."""
    inside, outside = 0.0, 100.0
    for _ in range(40):
        middle = (inside + outside) / 2
        if lake_distance(x, side * middle) > 0:
            inside = middle
        else:
            outside = middle
    return side * inside


def hills(x, y):
    return max(0.3, 2.5 + 2.5 * math.sin(x * 0.055 + 1.3) * math.cos(y * 0.047 - 0.4) + 1.2 * math.sin(x * 0.13 - y * 0.09))


def terrain_height(x, y):
    distance = lake_distance(x, y)
    if distance > 0:
        height = -LAKE_BOTTOM * smoothstep(0, 16, distance)
    else:
        land = -distance
        height = 0.9 * smoothstep(0, 5, land) + hills(x, y) * smoothstep(10, 40, land)
        # Collines qui ferment l'horizon au bord du terrain
        height += 16 * smoothstep(104, 146, max(abs(x), abs(y)))
    for center, peak, slope in (ISLAND, ISLET):
        height = max(height, peak - slope * (Vector((x, y)) - center).length)
    return height


def terrain_color(height, slope, _x, _y, rng):
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
    decor, markers = groups["Decor"], groups["Reperes"]
    # Rive sud au droit du ponton, rive nord au droit de l'appontement
    south, north = -shore_y(JETTY_X, -1), shore_y(DOCK_X, 1)

    ground = Ground(build_terrain(groups["Terrain"], material, rng))
    build_water(groups["Eau"], material)
    rocks = build_rocks(decor, material, rng, ground)
    reeds = build_reeds(decor, material, rng, ground)
    cabin = Vector((9.5, -(south + 10)))
    jetty = build_jetty(decor, material, south)
    build_cabin(decor, markers, material, ground, cabin)
    pen = build_fish_pen(decor, markers, material, Vector((2.4, -(south + 5.6))))
    campfire = build_campfire(decor, markers, material, rng, ground, Vector((16.0, -(south + 5.5))))
    boathouse = build_boathouse(decor, markers, material, ground, north)
    avoid = [(cabin, 7.0), (jetty, 6.0), (pen, 3.5), (campfire, 4.0), (boathouse, 7.5), (Vector((DOCK_X, north)), 5.0)]
    build_trees(decor, material, rng, ground, avoid=avoid)
    build_flora(decor, material, ground, seed=107, half_size=105, spots=lake_flora(ground, avoid))
    build_colliders(groups["Collisions"], material, rocks, south, north)
    build_zones(groups["Zones"], rocks, reeds)
    build_markers(markers, south)
    build_finds(markers, rocks)
    return scene


def build_terrain(collection, material, rng):
    """Grille triangulée : fond du lac, plage, prairie et collines, îles comprises."""
    coords = grid_coords(TERRAIN_HALF_SIZE, TERRAIN_FINE_HALF, TERRAIN_CELL, TERRAIN_FAR_CELL)
    return build_grid_terrain(collection, material, rng, coords, coords, terrain_height, terrain_color)


def build_water(collection, material):
    """Plan d'eau : il suit la rive, un peu au-delà (seule son emprise compte : le jeu recrée sa propre surface)."""
    builder = MeshBuilder()
    segments = 96
    ring = [point_from_shore(2 * math.pi * i / segments, -3.0).to_3d() for i in range(segments)]
    builder.polygon(ring, rgba(0x4f9fb3))
    builder.to_object("water", material, collection)


# Amas de rochers dans l'eau : angle de la rive, distance à la rive
ROCK_CLUSTERS = [(2.5, 7.0), (5.75, 8.0)]


def build_rocks(collection, material, rng, ground):
    """Deux amas de rochers dans l'eau (nord-ouest et sud-est), des blocs sur les berges et sur l'îlot."""
    builder = MeshBuilder()
    clusters = []
    for theta, inward in ROCK_CLUSTERS:
        center = point_from_shore(theta, inward)
        spots = []
        for offset, size in [((0, 0), 2.0), ((2.6, 1.8), 1.4), ((-2.2, 2.0), 1.1), ((1.2, -2.6), 1.6)]:
            position = center + Vector(offset)
            builder.blob((position.x, position.y, -0.7), size, rng.choice(ROCK_GREY), scale=(1.2, 1.0, 0.95), jitter=0.18, rng=rng)
            spots.append((position, size * 1.05))
        clusters.append({"center": center, "spots": spots})
        for _ in range(7):
            add_shore_rock(builder, rng, ground, theta + rng.uniform(-0.2, 0.2), rng.uniform(2, 7), rng.uniform(0.5, 1.1))
    # Blocs épars tout autour du lac
    for k in range(18):
        add_shore_rock(builder, rng, ground, 2 * math.pi * (k + rng.random()) / 18, rng.uniform(1.5, 9), rng.uniform(0.4, 1.3))
    # L'îlot : trois rochers serrés
    for offset, size in [((0, 0), 1.1), ((1.0, 0.7), 0.7), ((-0.8, 0.9), 0.6)]:
        x, y = ISLET[0].x + offset[0], ISLET[0].y + offset[1]
        builder.blob((x, y, ground.lowest_under(x, y, size * 0.8) + 0.25 * size), size, rng.choice(ROCK_GREY),
                     scale=(1.1, 1.0, 0.9), jitter=0.2, rng=rng)
    builder.to_object("deco_rocks", material, collection)
    return clusters


def add_shore_rock(builder, rng, ground, theta, land, size):
    """Rocher posé sur la berge du lac, à `land` mètres de l'eau."""
    spot = point_from_shore(theta, -land)
    add_shore_rock_at(builder, rng, ground, spot.x, spot.y, size)


def add_shore_rock_at(builder, rng, ground, x, y, size):
    """Rocher posé au sol en (x, y), à moitié enfoncé (jamais en l'air sur une pente)."""
    builder.blob((x, y, ground.lowest_under(x, y, 1.2 * size)), size, rng.choice(ROCK_GREY), scale=(1.2, 1.0, 0.7), jitter=0.2, rng=rng)


# Roselières : angle de la rive, distance à la rive
REED_BEDS = [(0.35, 4.5), (1.9, 4.5), (3.6, 4.0), (4.2, 4.5)]


def build_reeds(collection, material, rng, ground):
    """Quatre roselières (certains roseaux avec une massette brune) dans l'eau peu profonde."""
    builder = MeshBuilder()
    centers = [point_from_shore(theta, inward) for theta, inward in REED_BEDS]
    greens = [rgba(0xb9c56d), rgba(0x9fb45a), rgba(0xc8c779)]
    for center in centers:
        for _ in range(45):
            angle, distance = rng.uniform(0, 2 * math.pi), math.sqrt(rng.random()) * 3.4
            x, y = center.x + math.cos(angle) * distance, center.y + math.sin(angle) * distance
            base = ground.lowest_under(x, y, 0.06) - 0.05
            height = max(0.0, -base) + rng.uniform(1.1, 2.1)
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


JETTY_X, DOCK_X = 5.5, -4.0
DECK = 0.55


def build_planks(builder, x, start, end, deck=DECK, width=1.9):
    """Tablier de planches de y = start à y = end (start < end), sur des pieux plantés dans le fond."""
    y, plank = start, 0
    while y < end:
        builder.box((x, y + 0.15, deck), (width, 0.27, 0.06), WOOD_LIGHT if plank % 2 else WOOD)
        y += 0.3
        plank += 1
    y = start + 0.8
    while y < end:
        for side in (-(width / 2 - 0.1), width / 2 - 0.1):
            bottom = terrain_height(x + side, y) - 0.3
            builder.box((x + side, y, (deck + bottom) / 2), (0.14, 0.14, deck - bottom), WOOD_DARK)
        y += 1.8


def build_jetty(collection, material, south):
    """Ponton en bois qui s'avance dans l'eau, au sud, près du départ de la barque."""
    builder = MeshBuilder()
    start, end = -(south + 4), -(south - 5)
    build_planks(builder, JETTY_X, start, end)
    # Lanterne au bout du ponton, du côté du départ de la barque (Moustache est au milieu)
    lamp_post(builder, collection, "deco_jetty_lamp", JETTY_X - 0.85, end - 0.3, DECK + 0.03)
    builder.to_object("deco_jetty", material, collection)
    return Vector((JETTY_X, (start + end) / 2))


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


def build_hut(builder, collection, x, y, z, lake, window_name):
    """
    Cabane de planches : murs, toit à deux pentes, porte et petite fenêtre côté
    terre, cheminée. `lake` : +1 si le lac est vers +Y, -1 s'il est vers -Y.
    La fenêtre côté lac est un objet émissif à part (`window_name`), allumé la
    nuit. Retourne le sommet de la cheminée.
    """
    builder.box((x, y, z + 1.2), (4.0, 3.2, 2.4), WOOD)
    for side in (-1, 1):
        roof = Matrix.Rotation(side * 0.55, 4, 'Y')
        # Pans de longueurs un peu différentes : leurs bouts ne sont pas dans le même plan (sinon ils clignotent au faîtage)
        builder.box((x + side * 1.05, y, z + 2.95), (2.5, 3.7 if side < 0 else 3.74, 0.14), ROOF, rotation=roof)
    builder.box((x - 0.8, y - lake * 1.62, z + 0.95), (0.8, 0.06, 1.8), WOOD_DARK)
    builder.box((x + 0.9, y - lake * 1.62, z + 1.4), (0.9, 0.06, 0.7), rgba(0xcfe3ea))
    builder.box((x + 1.2, y + lake * 0.8, z + 3.4), (0.4, 0.4, 1.2), rgba(0x8a8a84))
    window = MeshBuilder()
    window.box((x - 0.7, y + lake * 1.62, z + 1.4), (0.9, 0.06, 0.7), rgba(0x8fa9b4))
    emissive_object(window, window_name, window_material(), collection)
    return Vector((x + 1.2, y + lake * 0.8, z + 4.0))


def build_cabin(collection, markers, material, ground, position):
    """Cabane de Moustache, au sud : sa cheminée fume (Empty `fx_smoke_1`)."""
    builder = MeshBuilder()
    x, y = position
    z = ground.lowest_under(x, y, 2.6) - 0.05
    chimney = build_hut(builder, collection, x, y, z, 1, "deco_cabin_window")
    builder.to_object("deco_cabin", material, collection)
    empty("fx_smoke_1", markers, location=chimney + Vector((0, 0, 0.05)), display='SPHERE', size=0.3)


def build_boathouse(collection, markers, material, ground, north):
    """
    Rive nord : un hangar à barques (fenêtre allumée la nuit, cheminée qui
    fume) et un appontement à lanterne qui avance dans l'eau. Retourne la
    position du hangar.
    """
    builder = MeshBuilder()
    x, y = DOCK_X - 4.2, north + 6.5
    z = ground.lowest_under(x, y, 2.6) - 0.05
    chimney = build_hut(builder, collection, x, y, z, -1, "deco_boathouse_window")
    builder.to_object("deco_boathouse", material, collection)
    empty("fx_smoke_2", markers, location=chimney + Vector((0, 0, 0.05)), display='SPHERE', size=0.3)
    dock = MeshBuilder()
    start, end = north - 7, north + 4
    build_planks(dock, DOCK_X, start, end)
    lamp_post(dock, collection, "deco_dock_lamp", DOCK_X + 0.85, start + 0.3, DECK + 0.03)
    dock.to_object("deco_dock", material, collection)
    return Vector((x, y))


def build_campfire(collection, markers, material, rng, ground, position, index=1):
    """
    Feu de camp : cercle de pierres, cendres, bûches en faisceau et deux
    rondins pour s'asseoir. Le jeu y allume des flammes (Empty `fx_fire_<n>`).
    Retourne sa position.
    """
    builder = MeshBuilder()
    x, y = position
    base = ground.lowest_under(x, y, 0.8)
    builder.blob((x, y, base + 0.02), 0.42, ASH, scale=(1.0, 1.0, 0.22), jitter=0.1, rng=rng)
    for k in range(8):
        angle = 2 * math.pi * (k + rng.uniform(-0.2, 0.2)) / 8
        px, py = x + math.cos(angle) * 0.62, y + math.sin(angle) * 0.62
        builder.blob((px, py, ground.lowest_under(px, py, 0.2) + 0.04), rng.uniform(0.15, 0.21), rng.choice(ROCK_GREY),
                     scale=(1.1, 1.0, 0.75), jitter=0.15, rng=rng, rotation=Matrix.Rotation(angle, 4, 'Z'))
    for k in range(4):
        angle = 2 * math.pi * k / 4 + 0.4
        foot = Vector((x + math.cos(angle) * 0.4, y + math.sin(angle) * 0.4, base - 0.04))
        tip = Vector((x + math.cos(angle + 0.5) * 0.05, y + math.sin(angle + 0.5) * 0.05, base + 0.5 + 0.03 * k))
        add_log(builder, foot, tip, 0.06, rgba(0x5a4030))
    for side, angle in ((-1, 0.35), (1, -0.5)):
        px, py = x + side * 1.55, y - 0.3
        along = Vector((math.sin(angle), math.cos(angle), 0)) * 0.7
        middle = Vector((px, py, ground.lowest_under(px, py, 0.75) + 0.15))
        add_log(builder, middle - along, middle + along, 0.2, WOOD_DARK)
    builder.to_object("deco_campfire" if index == 1 else f"deco_campfire_{index}", material, collection)
    empty(f"fx_fire_{index}", markers, location=(x, y, base + 0.14), display='SPHERE', size=0.3)
    return Vector((x, y))


def add_log(builder, start, end, radius, color, segments=6):
    """Rondin (cylindre) d'un point à un autre."""
    axis = end - start
    rotation = axis.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    builder.cone((start + end) / 2, radius, radius * 0.9, axis.length, segments, color, rotation=rotation)


def lake_flora(ground, avoid):
    """Où pousse la flore du lac : sur la berge, près de l'eau, loin des constructions."""
    clear = far_from([((center.x, center.y), radius) for center, radius in avoid])

    def meadow(x, y):
        land = -lake_distance(x, y)
        return 1.5 < land < 24 and ground.height(x, y) > 0.75 and ground.slope(x, y) < 0.4 and clear(x, y)

    def island(x, y):
        return (Vector((x, y)) - ISLAND_CENTER).length < 3.2 and ground.height(x, y) > 0.55

    def beach(x, y):
        return 0 < -lake_distance(x, y) < 4 and 0.1 < ground.height(x, y) < 0.5 and clear(x, y)

    return {
        "grass": Spot(520, lambda x, y: meadow(x, y) or island(x, y)),
        "flowers": Spot(130, meadow),
        "bushes": Spot(90, lambda x, y: meadow(x, y) and -lake_distance(x, y) > 3),
        "pebbles": Spot(110, beach),
    }


def build_trees(collection, material, rng, ground, avoid):
    """Forêt autour du lac (sapins surtout, des feuillus et des bouleaux) et trois arbres sur l'île."""
    builder = MeshBuilder()
    placed = 0
    while placed < 270:
        x, y = rng.uniform(-138, 138), rng.uniform(-138, 138)
        land = -lake_distance(x, y)
        if land < 4 or any((Vector((x, y)) - center).length < radius for center, radius in avoid):
            continue
        # Forêt plus dense près du lac (là où on la voit le mieux), clairsemée sur les collines du fond
        if land > 45 and rng.random() < 0.55:
            continue
        scale = rng.uniform(0.8, 1.5)
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale)
        placed += 1
    for dx, dy, scale, kind in [(0.0, 0.0, 1.15, 'fir'), (1.9, -1.1, 0.65, 'leafy'), (-1.6, 1.5, 0.8, 'birch')]:
        x, y = ISLAND_CENTER.x + dx, ISLAND_CENTER.y + dy
        add_tree(builder, rng, x, y, tree_base(ground, x, y, scale), scale, kind=kind)
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


def add_tree(builder, rng, x, y, z, scale, kind=None):
    """Arbre : sapin ('fir'), feuillu ('leafy') ou bouleau ('birch') ; tiré au hasard si `kind` est None."""
    if kind is None:
        kind = rng.choices(('fir', 'leafy', 'birch'), weights=(62, 26, 12))[0]
    trunk = rgba(0x8a6a4f)
    # Chaque arbre tourné à sa façon (angle tiré de sa position, sans toucher au tirage aléatoire) :
    # la forêt paraît moins uniforme, et deux arbres voisins n'ont pas de faces confondues
    spin = Matrix.Rotation((x * 12.9898 + y * 78.233) % (2 * math.pi), 4, 'Z')
    if kind == 'fir':
        green = rng.choice([rgba(0x5f9e6e), rgba(0x71ad73), rgba(0x4f8a67)])
        builder.cone((x, y, z + 0.7 * scale), 0.22 * scale, 0.18 * scale, 1.4 * scale, 6, trunk, rotation=spin)
        for height, radius, depth in [(1.9, 1.7, 2.4), (3.0, 1.3, 2.0), (4.0, 0.85, 1.6)]:
            builder.cone((x, y, z + height * scale), radius * scale, 0.0, depth * scale, 7, green, rotation=spin)
    elif kind == 'leafy':
        green = rng.choice([rgba(0x8fbf6a), rgba(0x7fb068), rgba(0xa7c96e)])
        builder.cone((x, y, z + 0.9 * scale), 0.2 * scale, 0.15 * scale, 1.8 * scale, 6, trunk, rotation=spin)
        builder.blob((x, y, z + 2.6 * scale), 1.5 * scale, green, scale=(1.0, 1.0, 0.85), jitter=0.12, rng=rng, rotation=spin)
    else:
        # Bouleau : tronc clair et élancé, deux houppes de feuillage léger
        green = rng.choice([rgba(0xa9cf6f), rgba(0xbcd470), rgba(0x9cc86a)])
        builder.cone((x, y, z + 1.6 * scale), 0.12 * scale, 0.07 * scale, 3.2 * scale, 6, rgba(0xe6e2d6), rotation=spin)
        lean = spin @ Vector((0.35 * scale, 0, 0))
        builder.blob((x + lean.x, y + lean.y, z + 2.7 * scale), 0.95 * scale, green, scale=(1.0, 1.0, 1.1), jitter=0.14, rng=rng, rotation=spin)
        builder.blob((x - lean.x * 0.6, y - lean.y * 0.6, z + 3.5 * scale), 0.75 * scale, green, scale=(1.0, 1.0, 1.15), jitter=0.14, rng=rng,
                     rotation=spin)


def island_radius(island, margin=0.6):
    """Rayon de la collision d'une île : sa rive, plus une marge."""
    _center, peak, slope = island
    return peak / slope + margin


def build_colliders(collection, material, rocks, south, north):
    """Collisions (vues de dessus) : berge, îles, rochers, ponton, appontement."""
    ring = []
    segments = 160
    for i in range(segments):
        a0, a1 = 2 * math.pi * i / segments, 2 * math.pi * (i + 1) / segments
        inner0, inner1 = shore_radius(a0) - 1.8, shore_radius(a1) - 1.8
        ring.append([Vector((math.cos(a0) * inner0, math.sin(a0) * inner0, 0)), Vector((math.cos(a0) * 200, math.sin(a0) * 200, 0)),
                     Vector((math.cos(a1) * 200, math.sin(a1) * 200, 0)), Vector((math.cos(a1) * inner1, math.sin(a1) * inner1, 0))])
    flat_polygon_object("shore_col", collection, ring, material)
    flat_polygon_object("island_col", collection, [circle_points(ISLAND[0], island_radius(ISLAND), 20)], material)
    flat_polygon_object("islet_col", collection, [circle_points(ISLET[0], island_radius(ISLET), 14)], material)
    spots = [spot for cluster in rocks for spot in cluster["spots"]]
    for index, (position, radius) in enumerate(spots, start=1):
        flat_polygon_object(f"rock_{index:02d}_col", collection, [circle_points(position, radius, 12)], material)
    for name, x, y0, y1 in (("jetty_col", JETTY_X, -(south + 1), -(south - 5.2)), ("dock_col", DOCK_X, north - 7.2, north + 1)):
        flat_polygon_object(name, collection, [[Vector((x - 1.1, y0, 0)), Vector((x + 1.1, y0, 0)),
                                                Vector((x + 1.1, y1, 0)), Vector((x - 1.1, y1, 0))]], material)


def build_zones(collection, rocks, reeds):
    """Zones de pêche : Empties « cercle » couchés à plat (le rayon est leur échelle)."""
    flat = (math.pi / 2, 0, 0)
    zones = [
        ("zone_shallow_1", point_from_shore(-math.pi / 2 + 0.5, 6), 8),
        ("zone_shallow_2", point_from_shore(1.1, 6), 8),
        ("zone_shallow_3", point_from_shore(3.0, 6), 8),
        ("zone_shallow_4", ISLET[0], 7),
        ("zone_deep_1", Vector((-8.0, -14.0)), 13),
        ("zone_deep_2", Vector((20.0, 30.0)), 12),
        *[(f"zone_reeds_{index}", center, 6.5) for index, center in enumerate(reeds, start=1)],
        *[(f"zone_rocks_{index}", cluster["center"], 7.5) for index, cluster in enumerate(rocks, start=1)],
    ]
    for name, position, radius in zones:
        empty(name, collection, location=(position.x, position.y, 0), rotation=flat, scale=radius, display='CIRCLE')


def build_markers(collection, south):
    """Départ de la barque (face au centre du lac, donc vers +Y), caméra 7 m derrière, et Moustache."""
    spawn = empty("spawn_boat", collection, location=(0, -(south - 9), 0), rotation=(0, 0, math.pi), display='ARROWS', size=1.5)
    camera_position = Matrix.Translation(spawn.location) @ Matrix.Rotation(math.pi, 4, 'Z') @ Vector((0, 7, 3.2))
    empty("cam_default", collection, location=camera_position, display='SINGLE_ARROW', size=1.0)
    build_cat_marker(collection, south, spawn.location)


# Trouvailles : (angle de la rive, distance à la rive), dans les baies et les recoins, loin du départ
FIND_SPOTS = [(0.1, 8), (0.9, 7), (1.35, 8), (2.2, 6), (2.85, 9), (3.3, 6), (3.95, 8), (5.2, 7), (5.95, 6)]


def build_finds(collection, rocks):
    """Coins à trouvailles (`find_<n>`) : le long des rives, derrière la grande île et près de l'îlot."""
    points = [point_from_shore(theta, inward) for theta, inward in FIND_SPOTS]
    points += [ISLAND[0] + Vector((0, 9.5)), ISLET[0] + Vector((-6.5, 3.0))]
    obstacles = [(ISLAND[0], island_radius(ISLAND)), (ISLET[0], island_radius(ISLET))]
    obstacles += [spot for cluster in rocks for spot in cluster["spots"]]

    def is_free(x, y):
        return lake_distance(x, y) > 4 and all((Vector((x, y)) - center).length > radius + 2.5 for center, radius in obstacles)

    find_spots(collection, points, is_free)


def build_cat_marker(collection, south, spawn):
    """`npc_cat` : Moustache assis au bout du ponton (sur le tablier), tourné vers la barque au départ."""
    position = Vector((JETTY_X, -(south - 5) - 0.8, DECK + 0.03))
    toward = spawn - position
    heading = math.atan2(toward.x, -toward.y)  # l'avant d'un objet regarde -Y
    empty("npc_cat", collection, location=position, rotation=(0, 0, heading), display='ARROWS', size=0.5)
