"""Contrôle des assets, dans toutes les scènes de petite_peche.blend :

1. Faces superposées (« z-fighting ») : deux faces dans le même plan qui se
   recouvrent se disputent l'affichage et clignotent quand la caméra bouge.
   Deux faces qui regardent dans le même sens posent toujours problème ; dos à
   dos, seulement si le matériau est visible des deux côtés.
2. Décor qui flotte : chaque élément du décor (arbre, rocher, planche…) doit
   être soutenu en son milieu (par le sol, un autre élément ou l'eau), ou
   accroché à un autre élément (fenêtre contre un mur). S'il est posé sur le
   sol, il doit le toucher tout autour de sa base : un tronc en pente ne doit
   pas laisser de vide côté aval. Posé sur un autre élément, il peut déborder
   (toit du phare au-dessus de sa lanterne).

Ignorés : collisions (*_col), zones, water, water_mask (invisibles ou
remplacés par le jeu), et les formes au choix d'un même emplacement entre
elles (`skin_hull_*`… : une seule est montrée à la fois).

À lancer dans Blender (onglet Scripting) ou via le MCP Blender :
    runpy.run_path(".../blender/check_assets.py", run_name="__not_main__")["main"]()
"""

import math
from collections import defaultdict

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# Tolérances : deux faces sont « dans le même plan » à 1 mm près
PLANE_EPSILON = 0.001
# Les triangles sont réduits de 2 % avant le test : des faces voisines qui se
# touchent par un bord ne comptent pas
SHRINK = 0.02
CELL = 1.0
# Un élément du décor flotte s'il est à plus de 3 cm au-dessus de ce qu'il y a dessous
FLOAT_GAP = 0.03
# … sauf s'il est accroché à un autre élément (à moins de 3 cm de sa surface)
ATTACH_GAP = 0.03


def is_checked(obj):
    name = obj.name.split(".")[0]
    hidden = name.endswith("_col") or name.startswith("zone_") or name in ("water", "water_mask")
    return obj.type == 'MESH' and not hidden


def is_double_sided(obj):
    return any(slot.material and not slot.material.use_backface_culling for slot in obj.material_slots)


def world_triangles(obj):
    """Triangles de l'objet, en coordonnées monde : (objet, face, sommets)."""
    mesh = obj.data
    mesh.calc_loop_triangles()
    matrix = obj.matrix_world
    points = [matrix @ v.co for v in mesh.vertices]
    for tri in mesh.loop_triangles:
        yield obj.name, tri.polygon_index, [points[i] for i in tri.vertices]


def plane_key(a, b, c):
    """Plan du triangle, orienté de façon canonique (les faces dos à dos ont la même clé)."""
    normal = (b - a).cross(c - a)
    if normal.length < 1e-9:
        return None
    normal.normalize()
    for component in normal:
        if abs(component) > 1e-6:
            if component < 0:
                normal = -normal
            break
    distance = normal.dot(a)
    key = tuple(round(x / PLANE_EPSILON) for x in normal) + (round(distance / PLANE_EPSILON),)
    facing = 1 if (b - a).cross(c - a).dot(normal) > 0 else -1
    return key, normal, facing


def project(points, normal):
    """Projette sur le plan en retirant l'axe dominant de la normale."""
    axis = max(range(3), key=lambda i: abs(normal[i]))
    keep = [i for i in range(3) if i != axis]
    return [(p[keep[0]], p[keep[1]]) for p in points]


def shrink(tri):
    cx, cy = sum(p[0] for p in tri) / 3, sum(p[1] for p in tri) / 3
    return [(cx + (x - cx) * (1 - SHRINK), cy + (y - cy) * (1 - SHRINK)) for x, y in tri]


def overlap(t1, t2):
    """Deux triangles 2D se recouvrent-ils ? (axes séparateurs)"""
    for tri in (t1, t2):
        for i in range(3):
            (x1, y1), (x2, y2) = tri[i], tri[(i + 1) % 3]
            nx, ny = y1 - y2, x2 - x1
            p1 = [nx * x + ny * y for x, y in t1]
            p2 = [nx * x + ny * y for x, y in t2]
            if max(p1) <= min(p2) or max(p2) <= min(p1):
                return False
    return True


def rival_skins(name1, name2):
    """
    Deux formes au choix d'un même emplacement (`skin_<emplacement>_<forme>`,
    par exemple deux coques) : le jeu n'en montre qu'une à la fois, elles ne
    peuvent pas se disputer l'affichage.
    """
    first, second = name1.split(".")[0].split("_"), name2.split(".")[0].split("_")
    return first[0] == second[0] == "skin" and first[1:2] == second[1:2] and first[2:] != second[2:]


def overlapping_faces(scene):
    """Faces superposées visibles, regroupées par paire d'objets."""
    buckets = defaultdict(list)
    for obj in scene.objects:
        if not is_checked(obj):
            continue
        double = is_double_sided(obj)
        for name, face, points in world_triangles(obj):
            found = plane_key(*points)
            if found:
                key, normal, facing = found
                buckets[key].append((name, face, shrink(project(points, normal)), points, facing, double))
    problems = {}
    for triangles in buckets.values():
        if len(triangles) < 2:
            continue
        for first, second in candidate_pairs(triangles):
            name1, face1, tri1, points, facing1, double1 = first
            name2, face2, tri2, _, facing2, double2 = second
            visible = facing1 == facing2 or double1 or double2
            if (name1, face1) == (name2, face2) or rival_skins(name1, name2) or not visible or not overlap(tri1, tri2):
                continue
            pair = tuple(sorted((name1, name2)))
            center = sum(points, Vector()) / 3
            problems.setdefault(pair, []).append(tuple(round(c, 2) for c in center))
    return {f"{a} / {b}": {"triangles": len(spots), "exemple": spots[0]} for (a, b), spots in problems.items()}


# --- Décor qui flotte ------------------------------------------------------------

def water_level(scene):
    water = next((o for o in scene.objects if o.name.split(".")[0] == "water"), None)
    if not water:
        return None
    return max((water.matrix_world @ v.co).z for v in water.data.vertices)


def is_terrain(obj):
    return obj.name.split(".")[0].startswith("deco_terrain")


def ground_tree(scene, keep):
    """Surfaces sur lesquelles un élément peut reposer : les objets visibles choisis par `keep`."""
    points, polygons = [], []
    for obj in scene.objects:
        if not is_checked(obj) or not keep(obj):
            continue
        offset = len(points)
        points.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        polygons.extend([offset + i for i in poly.vertices] for poly in obj.data.polygons)
    return BVHTree.FromPolygons(points, polygons) if polygons else None


def pieces(obj):
    """Éléments d'un objet : groupes de morceaux qui se touchent (un tronc et son feuillage = un arbre)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    islands, seen = [], set()
    for vert in bm.verts:
        if vert.index in seen:
            continue
        stack, island = [vert], []
        seen.add(vert.index)
        while stack:
            current = stack.pop()
            island.append(current.co.copy())
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other.index not in seen:
                    seen.add(other.index)
                    stack.append(other)
        islands.append(island)
    bm.free()
    return merge_touching(islands)


def bounds(points, margin=0.02):
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points))) - Vector((margin,) * 3)
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points))) + Vector((margin,) * 3)
    return lo, hi


def merge_touching(islands):
    """Réunit les morceaux dont les boîtes se touchent (union-find)."""
    boxes = [bounds(island) for island in islands]
    parent = list(range(len(islands)))

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    order = sorted(range(len(islands)), key=lambda i: boxes[i][0].x)
    for a_index, a in enumerate(order):
        for b in order[a_index + 1:]:
            if boxes[b][0].x > boxes[a][1].x:
                break
            (alo, ahi), (blo, bhi) = boxes[a], boxes[b]
            if all(alo[k] <= bhi[k] and blo[k] <= ahi[k] for k in range(3)):
                parent[root(a)] = root(b)
    groups = defaultdict(list)
    for i, island in enumerate(islands):
        groups[root(i)].extend(island)
    return list(groups.values())


def ground_gap(tree, lowest):
    """
    Hauteur du point le plus bas au-dessus de ce qu'il y a dessous (négative
    s'il est enfoncé), ou None s'il n'y a rien ni dessous ni dessus.
    """
    down, up = Vector((0, 0, -1)), Vector((0, 0, 1))
    hit = tree.ray_cast(lowest + Vector((0, 0, 0.5)), down)
    if hit[0] is None:
        hit = tree.ray_cast(lowest, up)
    return None if hit[0] is None else lowest.z - hit[0].z


def floating_pieces(scene):
    """Éléments du décor mal posés : rien sous leur milieu, ou du vide sous le bord d'une base posée au sol."""
    level = water_level(scene)
    terrain = ground_tree(scene, is_terrain)
    problems = {}
    for obj in scene.objects:
        name = obj.name.split(".")[0]
        if not is_checked(obj) or not name.startswith("deco_") or is_terrain(obj):
            continue
        others = ground_tree(scene, lambda other: other != obj)
        for points in pieces(obj):
            problem = support_problem(points, others, terrain, level)
            if problem:
                problems.setdefault(name, []).append(problem)
    return problems


def is_attached(points, others):
    """L'élément touche-t-il un autre élément (fenêtre contre un mur, lanterne sur un poteau) ?"""
    for point in points:
        nearest = others.find_nearest(point)
        if nearest[0] is not None and nearest[3] <= ATTACH_GAP:
            return True
    return False


def support_problem(points, others, terrain, level):
    """Décrit le défaut d'appui d'un élément, ou None s'il est bien posé."""
    lowest_z = min(p.z for p in points)
    if level is not None and lowest_z <= level + FLOAT_GAP:
        return None
    base = [p for p in points if p.z <= lowest_z + 0.01]
    middle = sum(base, Vector()) / len(base)
    gap = ground_gap(others, middle) if others else None
    if gap is None or gap > FLOAT_GAP:
        if others and is_attached(points, others):
            return None
        return {"où": tuple(round(c, 2) for c in middle), "écart": None if gap is None else round(gap, 2)}
    # Posé sur le sol (et pas sur un autre élément) : il doit le toucher tout autour de sa base
    on_terrain = terrain is not None and ground_gap(terrain, middle) == gap
    if not on_terrain:
        return None
    worst = max(base, key=lambda p: ground_gap(terrain, p) or 0.0)
    edge_gap = ground_gap(terrain, worst)
    if edge_gap is not None and edge_gap > FLOAT_GAP:
        return {"où": tuple(round(c, 2) for c in worst), "écart": round(edge_gap, 2), "bord": True}
    return None


def check_scene(scene):
    # Positions à jour (juste après une génération, les pièces enfants ne sont pas encore placées)
    for view_layer in scene.view_layers:
        view_layer.update()
    report = {}
    faces = overlapping_faces(scene)
    if faces:
        report["faces superposées"] = faces
    floating = floating_pieces(scene)
    if floating:
        report["décor qui flotte"] = floating
    return report


def candidate_pairs(triangles):
    """Paires de triangles proches (grille de CELL m), sans doublons."""
    grid = defaultdict(list)
    for index, (_, _, tri, *_) in enumerate(triangles):
        xs, ys = [p[0] for p in tri], [p[1] for p in tri]
        for gx in range(math.floor(min(xs) / CELL), math.floor(max(xs) / CELL) + 1):
            for gy in range(math.floor(min(ys) / CELL), math.floor(max(ys) / CELL) + 1):
                grid[(gx, gy)].append(index)
    seen = set()
    for members in grid.values():
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                pair = (members[i], members[j])
                if pair not in seen:
                    seen.add(pair)
                    yield triangles[pair[0]], triangles[pair[1]]


def main():
    report = {}
    for scene in bpy.data.scenes:
        problems = check_scene(scene)
        if problems:
            report[scene.name] = problems
    for scene, problems in report.items():
        print(f"[{scene}]")
        for kind, items in problems.items():
            for name, info in items.items():
                print(f"  {kind} : {name} → {info}")
    if not report:
        print("Rien à signaler : pas de face superposée ni de décor qui flotte.")
    return report


if __name__ == "__main__":
    main()
