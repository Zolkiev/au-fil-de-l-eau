"""Génère tous les assets d’Au fil de l’eau dans Blender, puis enregistre
blender/petite_peche.blend (une scène par asset).

Scènes : lake_01, river_01, cove_01, boat, rod, bobber, cat, fish_<id> (22 poissons).
Les niveaux reçoivent ensuite leur occlusion ambiante (ambient.py, Cycles).
À lancer dans Blender (onglet Scripting › Ouvrir › Exécuter) ou via le MCP Blender.

ATTENTION : repart d'un fichier vide. Toutes les scènes du fichier ouvert sont
remplacées. Après des retouches à la main dans petite_peche.blend, ne relance
pas ce script : utilise seulement export_assets.py.
"""

import importlib
import os
import sys

import bpy

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))
if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)

from petite_peche import ambient, common, cove, fish, flora, level, props, river  # noqa: E402

# Relit les modules à chaque exécution (utile quand on les modifie sans redémarrer Blender)
for module in (common, flora, level, river, cove, props, fish, ambient):
    importlib.reload(module)


def main():
    temporary = common.reset_file()
    levels = [level.build(), river.build(), cove.build()]
    scenes = [*levels, *props.build_all(), *fish.build_all()]
    world = bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new("World")
    for scene in scenes:
        scene.world = world
    bpy.data.scenes.remove(temporary)
    # Ombres douces au pied du décor, cuites dans les couleurs (voir petite_peche/ambient.py)
    for scene in levels:
        ambient.bake_level(scene)
    bpy.context.window.scene = scenes[0]
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLENDER_DIR, "petite_peche.blend"))
    return [scene.name for scene in scenes]


if __name__ == "__main__":
    main()
