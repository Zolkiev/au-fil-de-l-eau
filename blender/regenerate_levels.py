"""Régénère seulement les niveaux (lake_01, river_01, cove_01) dans
petite_peche.blend, sans toucher aux autres scènes (barque, canne, chat,
pêcheur, poissons), puis enregistre le fichier.

À lancer dans Blender, fichier petite_peche.blend ouvert, ou via le MCP
Blender, après avoir modifié petite_peche/level.py, river.py, cove.py ou
flora.py. Lancer ensuite export_assets.py, puis check_assets.py.

ATTENTION : les trois scènes de niveau sont supprimées et recréées. Des
retouches faites à la main dans ces scènes seraient perdues.
"""

import importlib
import os
import sys

import bpy

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))
if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)

from petite_peche import ambient, common, cove, flora, level, river  # noqa: E402

# Relit les modules à chaque exécution (utile quand on les modifie sans redémarrer Blender)
for module in (common, flora, level, river, cove, ambient):
    importlib.reload(module)

LEVELS = (level, river, cove)


def remove_scene(name):
    """Supprime une scène, ses objets, ses collections et leurs maillages."""
    scene = bpy.data.scenes.get(name)
    if not scene:
        return
    meshes = {obj.data for obj in scene.objects if obj.type == 'MESH'}
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj)
    for collection in list(scene.collection.children_recursive):
        bpy.data.collections.remove(collection)
    bpy.data.scenes.remove(scene)
    for mesh in meshes:
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def main(bake=True):
    order = [scene.name for scene in bpy.data.scenes]
    for module in LEVELS:
        remove_scene(module.SCENE_NAME)
    world = bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new("World")
    scenes = []
    for module in LEVELS:
        scene = module.build()
        scene.world = world
        scenes.append(scene)
    # Ombres douces au pied du décor, cuites dans les couleurs (voir petite_peche/ambient.py)
    if bake:
        for scene in scenes:
            ambient.bake_level(scene)
    bpy.context.window.scene = scenes[0]
    if bpy.data.filepath:
        bpy.ops.wm.save_mainfile()
    return {"niveaux": [scene.name for scene in scenes], "scenes_avant": order}


if __name__ == "__main__":
    main()
