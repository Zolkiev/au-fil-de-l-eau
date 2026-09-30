"""Occlusion ambiante « cuite » dans les couleurs du décor des niveaux.

Chaque coin de face reçoit la part de ciel qu'il voit (Cycles, bake « AO »
vers un attribut de couleur), puis sa couleur de palette est assombrie
d'autant : le sol sous les arbres, le pied des rochers, le dessous du ponton
et les coins des cabanes s'assombrissent doucement. Aucun coût dans le jeu.

Seulement pour le décor des niveaux (objets `deco_*` colorés par la
palette). La barque n'est pas concernée : le jeu repeint sa coque en
cherchant la couleur exacte de la palette (décoration achetée au ponton).
"""

import bpy

from .common import COLOR_LAYER

AO_LAYER = "AO"
# Portée de l'occlusion (m) : au-delà, un objet ne fait plus d'ombre douce
DISTANCE = 3.0
# Force de l'assombrissement : 0 = aucun, 1 = l'occlusion telle quelle
STRENGTH = 0.6
SAMPLES = 64


def bake_level(scene):
    """Cuit l'occlusion ambiante dans les couleurs du décor de `scene` ; retourne le nombre d'objets traités."""
    targets = [obj for obj in scene.objects if is_palette_decor(obj)]
    if not targets:
        return 0
    previous_scene = bpy.context.window.scene
    bpy.context.window.scene = scene
    hidden = hide_invisible_objects(scene)
    engine = prepare_render(scene)
    try:
        for obj in targets:
            add_ao_layer(obj)
        select_only(targets)
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        for obj in targets:
            apply_ao(obj)
    finally:
        scene.render.engine = engine
        for obj in hidden:
            obj.hide_render = False
        bpy.context.window.scene = previous_scene
    return len(targets)


def is_palette_decor(obj):
    """Décor visible coloré par la palette (les lanternes et fenêtres émissives n'ont pas d'attribut « Col »)."""
    name = obj.name.split(".")[0]
    return obj.type == 'MESH' and name.startswith("deco_") and COLOR_LAYER in obj.data.color_attributes


def hide_invisible_objects(scene):
    """Ce qui est invisible dans le jeu (eau remplacée, collisions, zones) ne doit rien assombrir."""
    hidden = []
    for obj in scene.objects:
        name = obj.name.split(".")[0]
        if obj.type == 'MESH' and (name == "water" or name.endswith("_col") or name.startswith("zone_")) and not obj.hide_render:
            obj.hide_render = True
            hidden.append(obj)
    return hidden


def prepare_render(scene):
    """Cycles, sur le GPU s'il y en a un ; portée de l'occlusion. Retourne le moteur d'origine."""
    engine = scene.render.engine
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = SAMPLES
    scene.cycles.device = 'GPU'
    scene.world.light_settings.distance = DISTANCE
    return engine


def add_ao_layer(obj):
    mesh = obj.data
    if AO_LAYER in mesh.color_attributes:
        mesh.color_attributes.remove(mesh.color_attributes[AO_LAYER])
    mesh.color_attributes.active_color = mesh.color_attributes.new(AO_LAYER, 'FLOAT_COLOR', 'CORNER')


def select_only(objects):
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def apply_ao(obj):
    """Assombrit la couleur de palette de chaque coin selon son occlusion, puis retire l'attribut « AO »."""
    mesh = obj.data
    colors = mesh.color_attributes[COLOR_LAYER]
    occlusion = mesh.color_attributes[AO_LAYER]
    count = len(colors.data)
    rgba = [0.0] * (4 * count)
    ao = [0.0] * (4 * count)
    colors.data.foreach_get("color", rgba)
    occlusion.data.foreach_get("color", ao)
    for i in range(count):
        factor = 1.0 - STRENGTH * (1.0 - ao[4 * i])
        for channel in range(3):
            rgba[4 * i + channel] *= factor
    colors.data.foreach_set("color", rgba)
    mesh.color_attributes.remove(occlusion)
    mesh.color_attributes.active_color = mesh.color_attributes[COLOR_LAYER]
