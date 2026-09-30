"""Exporte chaque scène de petite_peche.blend en .glb dans le dossier assets/ du jeu.

À lancer dans Blender, fichier petite_peche.blend ouvert (onglet Scripting ›
Ouvrir › Exécuter), ou via le MCP Blender. Ne modifie rien dans les scènes :
on peut retoucher les assets à la main puis relancer ce script.

Correspondance scène → fichier :
  lake_01     → assets/levels/lake_01.glb (compressé en Draco)
  river_01    → assets/levels/river_01.glb (compressé en Draco)
  cove_01     → assets/levels/cove_01.glb (compressé en Draco)
  boat        → assets/props/boat.glb
  rod         → assets/props/rod.glb
  bobber      → assets/props/bobber.glb
  cat         → assets/props/cat.glb
  fisher      → assets/props/fisher.glb
  fish_<id>   → assets/fish/<id>.glb
"""

import os

import bpy

PROPS = {"boat": "props/boat.glb", "rod": "props/rod.glb", "bobber": "props/bobber.glb", "cat": "props/cat.glb",
         "fisher": "props/fisher.glb"}
LEVELS = ("lake_01", "river_01", "cove_01")


def blender_dir():
    """Dossier blender/ du projet (celui du .blend ouvert, sinon celui de ce script)."""
    if bpy.data.filepath:
        return os.path.dirname(bpy.data.filepath)
    return os.path.dirname(os.path.abspath(__file__))


def target_path(scene_name):
    """Chemin relatif (dans assets/) du .glb d'une scène, ou None si la scène n'est pas exportée."""
    if scene_name in LEVELS:
        return f"levels/{scene_name}.glb"
    if scene_name.startswith("fish_"):
        return f"fish/{scene_name[len('fish_'):]}.glb"
    return PROPS.get(scene_name)


def export_scene(scene, path, draco):
    bpy.context.window.scene = scene
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_active_scene=True,
        export_yup=True,
        export_apply=True,
        export_vertex_color="MATERIAL",
        export_lights=False,
        export_cameras=False,
        export_animations=True,
        export_draco_mesh_compression_enable=draco,
    )


def main():
    assets = os.path.join(os.path.dirname(blender_dir()), "assets")
    current = bpy.context.window.scene
    exported = []
    for scene in bpy.data.scenes:
        relative = target_path(scene.name)
        if relative:
            export_scene(scene, os.path.join(assets, relative), draco=scene.name in LEVELS)
            exported.append(relative)
    bpy.context.window.scene = current
    return exported


if __name__ == "__main__":
    main()
