"""Régénère seulement la barque et le pêcheur (scènes `boat` et `fisher`) dans
petite_peche.blend, sans toucher aux autres scènes (niveaux, canne, bouchon,
chat, poissons), enregistre le fichier, puis exporte ces deux scènes.

À lancer après avoir modifié la barque, les rames, le pêcheur ou leurs formes
au choix (`skin_*`) dans petite_peche/props.py :
- dans Blender, fichier petite_peche.blend ouvert, ou via le MCP Blender ;
- ou sans ouvrir Blender, depuis un terminal :
    /Applications/Blender.app/Contents/MacOS/Blender -b blender/petite_peche.blend --python blender/regenerate_props.py

ATTENTION : les deux scènes sont supprimées et recréées. Des retouches faites
à la main dans ces scènes seraient perdues.
"""

import importlib
import os
import runpy
import sys

import bpy

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))
if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)

from petite_peche import common, props  # noqa: E402

# Relit les modules à chaque exécution (utile quand on les modifie sans redémarrer Blender)
for module in (common, props):
    importlib.reload(module)

BUILDERS = {"boat": props.build_boat, "fisher": props.build_fisher}


def remove_scene(name):
    """Supprime une scène, ses objets et leurs maillages."""
    scene = bpy.data.scenes.get(name)
    if not scene:
        return
    meshes = {obj.data for obj in scene.objects if obj.type == 'MESH'}
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj)
    bpy.data.scenes.remove(scene)
    for mesh in meshes:
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def main(save=True):
    world = bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new("World")
    for name, build in BUILDERS.items():
        remove_scene(name)
        build().world = world
    if save and bpy.data.filepath:
        bpy.ops.wm.save_mainfile()
    export = runpy.run_path(os.path.join(BLENDER_DIR, "export_assets.py"), run_name="__not_main__")
    return {"scenes": list(BUILDERS), "exports": export["main"](only=tuple(BUILDERS))}


if __name__ == "__main__":
    print(main())
