"""Outils communs aux générateurs : couleurs, matériaux, construction de meshes.

Tous les objets sont colorés par face (attribut de couleur « Col », par coin)
et utilisent un matériau « palette » qui lit cette couleur : un seul matériau
par asset, un rendu low poly net, et un export glTF simple (COLOR_0).
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

COLOR_LAYER = "Col"


# --- Couleurs -----------------------------------------------------------------

def srgb_to_linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def rgba(hex_value, alpha=1.0):
    """Couleur hexadécimale sRGB (comme dans un sélecteur) → RGBA linéaire."""
    r, g, b = (hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255
    return (srgb_to_linear(r / 255), srgb_to_linear(g / 255), srgb_to_linear(b / 255), alpha)


def mix(color_a, color_b, t):
    return tuple(a + (b - a) * t for a, b in zip(color_a, color_b))


def smoothstep(edge0, edge1, x):
    t = min(max((x - edge0) / (edge1 - edge0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


# --- Fichier, scènes, collections ------------------------------------------------

def reset_file():
    """Repart de zéro : une scène temporaire vide, tout le reste supprimé."""
    temp = bpy.data.scenes.new("_generation")
    bpy.context.window.scene = temp
    for scene in list(bpy.data.scenes):
        if scene != temp:
            bpy.data.scenes.remove(scene)
    for blocks in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights,
                   bpy.data.collections, bpy.data.armatures, bpy.data.actions):
        for block in list(blocks):
            blocks.remove(block)
    return temp


def new_scene(name):
    scene = bpy.data.scenes.new(name)
    scene.unit_settings.system = 'METRIC'
    return scene


def new_collection(scene, name):
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    return collection


# --- Matériaux ------------------------------------------------------------------

def palette_material(name="Palette", double_sided=False, roughness=0.85):
    """Matériau qui prend la couleur des sommets (attribut « Col »)."""
    material = bpy.data.materials.get(name)
    if material:
        return material
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    attribute = nodes.new("ShaderNodeVertexColor")
    attribute.layer_name = COLOR_LAYER
    attribute.location = (-300, 200)
    material.node_tree.links.new(attribute.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    material.use_backface_culling = not double_sided
    return material


def emissive_material(name, base_hex, emission_hex, strength):
    """Matériau qui brille (verre de lanterne…)."""
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba(base_hex)
    bsdf.inputs["Emission Color"].default_value = rgba(emission_hex)
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Roughness"].default_value = 0.4
    return material


# --- Construction de meshes -----------------------------------------------------------

class Ground:
    """
    Hauteur du vrai maillage du terrain, pour y poser le décor. La grille
    triangulée ne suit pas exactement le relief calculé (terrain_height) :
    un arbre posé d'après le calcul peut flotter de quelques centimètres.
    """

    def __init__(self, terrain):
        mesh = terrain.data
        points = [terrain.matrix_world @ v.co for v in mesh.vertices]
        self.tree = BVHTree.FromPolygons(points, [list(p.vertices) for p in mesh.polygons])

    def height(self, x, y):
        hit = self.tree.ray_cast(Vector((x, y, 1000.0)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] is not None else 0.0

    def lowest_under(self, x, y, radius, samples=8):
        """Point le plus bas du terrain sous un disque : un tronc ou un socle posé là touche le sol partout."""
        around = [(x + math.cos(2 * math.pi * k / samples) * radius, y + math.sin(2 * math.pi * k / samples) * radius) for k in range(samples)]
        return min(self.height(px, py) for px, py in [(x, y), *around])


class MeshBuilder:
    """Accumule de la géométrie colorée (une couleur par face) dans un bmesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.layer = self.bm.loops.layers.float_color.new(COLOR_LAYER)

    def paint(self, faces, color):
        for face in faces:
            for loop in face.loops:
                loop[self.layer] = color

    def _faces_of(self, verts):
        return {face for vert in verts for face in vert.link_faces}

    def polygon(self, points, color):
        """Face plane à partir d'une liste de points (ordre = sens de la normale)."""
        verts = [self.bm.verts.new(point) for point in points]
        face = self.bm.faces.new(verts)
        face.normal_update()
        self.paint([face], color)
        return face

    def cone(self, location, radius1, radius2, depth, segments, color, rotation=None):
        """Cône ou cylindre le long de Z (centré), éventuellement tourné."""
        matrix = Matrix.Translation(location) @ (rotation or Matrix.Identity(4))
        verts = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments,
                                      radius1=radius1, radius2=radius2, depth=depth, matrix=matrix)["verts"]
        self.paint(self._faces_of(verts), color)
        return verts

    def box(self, location, size, color, rotation=None):
        """Pavé de dimensions `size` (x, y, z), centré en `location`."""
        matrix = Matrix.Translation(location) @ (rotation or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1.0))
        verts = bmesh.ops.create_cube(self.bm, size=1.0, matrix=matrix)["verts"]
        self.paint(self._faces_of(verts), color)
        return verts

    def blob(self, location, radius, color, scale=(1.0, 1.0, 1.0), jitter=0.0, rng=None, subdivisions=1, rotation=None):
        """Icosphère low poly, déformée pour un aspect naturel (rochers, feuillages), éventuellement tournée."""
        matrix = Matrix.Translation(location) @ (rotation or Matrix.Identity(4)) @ Matrix.Diagonal((*scale, 1.0))
        verts = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=radius, matrix=matrix)["verts"]
        if jitter and rng:
            for vert in verts:
                vert.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * jitter * radius
        self.paint(self._faces_of(verts), color)
        return verts

    def to_object(self, name, material, collection, parent=None):
        mesh = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(mesh)
        self.bm.free()
        for polygon in mesh.polygons:
            polygon.use_smooth = False
        mesh.materials.append(material)
        mesh.color_attributes.active_color = mesh.color_attributes[COLOR_LAYER]
        obj = bpy.data.objects.new(name, mesh)
        obj.parent = parent
        collection.objects.link(obj)
        return obj


def empty(name, collection, location=(0, 0, 0), rotation=(0, 0, 0), scale=1.0, display='PLAIN_AXES', size=1.0, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    obj.location = location
    obj.rotation_euler = rotation
    obj.scale = (scale, scale, scale)
    obj.parent = parent
    collection.objects.link(obj)
    return obj


def flat_polygon_object(name, collection, rings, material):
    """Mesh plat fait de polygones (listes de points 3D), affiché en fil de fer dans Blender."""
    builder = MeshBuilder()
    for ring in rings:
        builder.polygon(ring, rgba(0xff6b6b))
    obj = builder.to_object(name, material, collection)
    obj.display_type = 'WIRE'
    return obj


def circle_points(center, radius, segments, z=0.0):
    cx, cy = center
    return [Vector((cx + math.cos(2 * math.pi * i / segments) * radius, cy + math.sin(2 * math.pi * i / segments) * radius, z))
            for i in range(segments)]


def oriented_quad(builder, quad, color, reference, away=True):
    """Face orientée à l'opposé du point `reference` (away) ou vers lui (not away)."""
    face = builder.polygon(quad, color)
    center = sum(quad, Vector()) / len(quad)
    facing_away = face.normal.dot(center - reference) >= 0
    if facing_away != away:
        face.normal_flip()
    return face
