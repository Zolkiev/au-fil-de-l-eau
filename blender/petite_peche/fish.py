"""Les poissons du lac, de la rivière et de la crique (identifiants de src/data/fish.ts), un par scène `fish_<id>`.

Chaque poisson est un seul mesh (transformations appliquées), tête vers -Y,
dos vers +Z. Le corps est construit par sections elliptiques de la pointe du
museau à la base de la queue ; nageoires planes, yeux, barbillons, rayures et
taches selon l'espèce.

Le mesh est déformé par un petit squelette (`<id>_rig` : spine, head, tail_1,
tail_2) ; tous les poissons partagent l'action `swim`, une boucle d'une
seconde que le jeu joue avec un AnimationMixer.
"""

import math
import random

import bpy
from mathutils import Quaternion, Vector

from .common import MeshBuilder, new_scene, palette_material, rgba

BODY_FRONT, BODY_BACK = -0.5, 0.42
SECTIONS = [0.04, 0.12, 0.22, 0.35, 0.5, 0.65, 0.78, 0.9, 1.0]
RING = 8
TAIL_FORK = {"fork": 0.12, "notch": 0.05, "round": -0.02}

# Pour chaque espèce : hauteur et épaisseur maximales (moitiés), position du point le plus haut,
# finesse du pédoncule, forme de la queue, couleurs, nageoires (t début, t fin, hauteur[, couleur]),
# et détails facultatifs.
SPECIES = {
    "ablette_miroir": dict(height=0.11, width=0.055, peak=0.35, tail_ratio=0.28, tail="fork",
                           colors=dict(back=0x7f98a3, body=0xcfdbe0, belly=0xf4f6f6, fins=0xb8c6cc, iris=0xe8ecee),
                           dorsal=[(0.5, 0.62, 0.07)], anal=(0.6, 0.82, 0.05), eye=1.1),
    "gardon_perle": dict(height=0.16, width=0.065, peak=0.38, tail_ratio=0.3, tail="fork",
                         colors=dict(back=0x5f7a74, body=0xb8c4c2, belly=0xeef0ea, fins=0xd9735b, iris=0xd9443a),
                         dorsal=[(0.42, 0.56, 0.1)], anal=(0.62, 0.76, 0.07), eye=1.2),
    "perche_zebree": dict(height=0.18, width=0.075, peak=0.36, tail_ratio=0.3, tail="notch",
                          colors=dict(back=0x5f6f3a, body=0x9fae62, belly=0xe8e2c0, fins=0xe0873f, iris=0xe0a23f, stripe=0x4a5a30),
                          dorsal=[(0.3, 0.48, 0.14, 0x4a5a30), (0.55, 0.72, 0.1)], anal=(0.68, 0.8, 0.08),
                          stripes=[2, 4, 6], eye=1.2),
    "rotengle_dore": dict(height=0.18, width=0.065, peak=0.4, tail_ratio=0.3, tail="fork",
                          colors=dict(back=0x8a7a3a, body=0xd8b25a, belly=0xf2e6c0, fins=0xd9573f, iris=0xe0a040),
                          dorsal=[(0.55, 0.68, 0.1)], anal=(0.6, 0.78, 0.08), eye=1.1),
    "tanche_vase": dict(height=0.16, width=0.09, peak=0.42, tail_ratio=0.45, tail="round",
                        colors=dict(back=0x3f5530, body=0x6f8a4a, belly=0xb8b070, fins=0x4f6a36, iris=0xc8502a),
                        dorsal=[(0.45, 0.6, 0.1)], anal=(0.62, 0.76, 0.08), barbels=[(0.035, -0.3)], eye=0.8),
    "breme_lune": dict(height=0.27, width=0.055, peak=0.42, tail_ratio=0.22, tail="fork", tail_size=1.1,
                       colors=dict(back=0x7a7560, body=0xc9c2a2, belly=0xeee8d0, fins=0x8f8a78, iris=0xd8d0b0),
                       dorsal=[(0.45, 0.58, 0.13)], anal=(0.5, 0.85, 0.08), eye=1.0),
    "carpe_mousse": dict(height=0.2, width=0.1, peak=0.4, tail_ratio=0.35, tail="notch", tail_size=1.05,
                         colors=dict(back=0x4f5f3a, body=0x8a7a4a, belly=0xd8c890, fins=0x6f5a3a, iris=0xd8b040, spot=0x6a7a42),
                         dorsal=[(0.35, 0.72, 0.1)], anal=(0.66, 0.78, 0.08), barbels=[(0.05, 0.1), (0.04, -0.3)],
                         spots=0.25, eye=0.9),
    "sandre_ombre": dict(height=0.13, width=0.065, peak=0.35, tail_ratio=0.3, tail="notch", snout=0.03,
                         colors=dict(back=0x4c5448, body=0x8c9488, belly=0xdcdcd0, fins=0x7c847c, iris=0xdfe8c8, stripe=0x6c7468),
                         dorsal=[(0.3, 0.46, 0.12, 0x5c645c), (0.52, 0.7, 0.1)], anal=(0.68, 0.82, 0.07),
                         stripes=[3, 5], eye=1.6),
    "brochet_emeraude": dict(height=0.1, width=0.065, peak=0.45, tail_ratio=0.4, tail="notch", tail_size=0.9,
                             snout=0.1, head_flat=True,
                             colors=dict(back=0x2f5a3a, body=0x4f8a5a, belly=0xe8e8c8, fins=0xa3b85a, iris=0xd8c040, spot=0xc8d890),
                             dorsal=[(0.74, 0.86, 0.09)], anal=(0.74, 0.86, 0.07), spots=0.2, eye=1.0),
    "silure_brumes": dict(height=0.12, width=0.1, peak=0.25, tail_ratio=0.25, tail="round", head_flat=True,
                          colors=dict(back=0x2e3035, body=0x4d4f55, belly=0xb8b4a8, fins=0x35373c, iris=0x9aa060),
                          dorsal=[(0.3, 0.36, 0.06)], anal=(0.45, 0.97, 0.08),
                          barbels=[(0.35, 0.3), (0.1, -0.6), (0.08, -0.8)], eye=0.55),
    # --- La rivière ---
    "vairon_vif": dict(height=0.1, width=0.05, peak=0.38, tail_ratio=0.3, tail="fork",
                       colors=dict(back=0x6b7040, body=0xb8b77a, belly=0xf0e8c8, fins=0x8a8a5a, iris=0xe0d0a0, spot=0x3a3a28),
                       dorsal=[(0.5, 0.62, 0.07)], anal=(0.62, 0.78, 0.05), spots=0.3, eye=1.2),
    "chevesne_malin": dict(height=0.15, width=0.08, peak=0.3, tail_ratio=0.3, tail="fork",
                           colors=dict(back=0x4f5a5a, body=0x9fabab, belly=0xeef0ea, fins=0xd07a4a, iris=0xe0b050),
                           dorsal=[(0.45, 0.58, 0.1)], anal=(0.62, 0.76, 0.08), eye=1.0),
    "truite_ruisseau": dict(height=0.15, width=0.07, peak=0.4, tail_ratio=0.35, tail="notch",
                            colors=dict(back=0x5a5030, body=0xb59a5a, belly=0xf0e4c0, fins=0xc8a070, iris=0xe0c060, spot=0xc03a2a),
                            dorsal=[(0.42, 0.56, 0.1), (0.72, 0.78, 0.05)], anal=(0.66, 0.8, 0.07), spots=0.3, eye=1.0),
    "barbeau_gue": dict(height=0.12, width=0.08, peak=0.35, tail_ratio=0.3, tail="fork", snout=0.05, head_flat=True,
                        colors=dict(back=0x5c5030, body=0x9c8a60, belly=0xe8dcb8, fins=0xb07a50, iris=0xd0b060),
                        dorsal=[(0.4, 0.52, 0.12)], anal=(0.66, 0.78, 0.07), barbels=[(0.06, -0.3), (0.05, 0.0)], eye=0.8),
    "ombre_cascade": dict(height=0.13, width=0.065, peak=0.38, tail_ratio=0.3, tail="fork",
                          colors=dict(back=0x4c5868, body=0x8c9aa8, belly=0xe8ecf0, fins=0x8a5ca8, iris=0xd0d8e0, spot=0x3a3a48),
                          dorsal=[(0.28, 0.62, 0.2)], anal=(0.66, 0.8, 0.07), spots=0.15, eye=1.3),
    "anguille_lune": dict(height=0.05, width=0.045, peak=0.3, tail_ratio=0.6, tail="round", tail_size=0.45, head_flat=True,
                          colors=dict(back=0x3e3e2a, body=0x5a5a40, belly=0xb8b490, fins=0x4a4a38, iris=0xd8d8a0),
                          dorsal=[(0.35, 0.99, 0.035)], anal=(0.5, 0.99, 0.03), eye=0.6),
    # --- La crique ---
    "maquereau_raye": dict(height=0.12, width=0.07, peak=0.4, tail_ratio=0.25, tail="fork",
                           colors=dict(back=0x2f5f70, body=0x8fb8c0, belly=0xf0f4f4, fins=0x7a9aa4, iris=0x303030, stripe=0x1f3f4a),
                           dorsal=[(0.3, 0.42, 0.08), (0.55, 0.68, 0.06)], anal=(0.6, 0.72, 0.05), stripes=[1, 3, 5], eye=1.0),
    "rouget_corail": dict(height=0.13, width=0.07, peak=0.35, tail_ratio=0.3, tail="fork", snout=0.02,
                          colors=dict(back=0xc04a3a, body=0xe88878, belly=0xf8e0d8, fins=0xf0a080, iris=0xe0c060),
                          dorsal=[(0.35, 0.47, 0.1), (0.58, 0.68, 0.07)], anal=(0.62, 0.74, 0.06), barbels=[(0.08, -0.7)], eye=1.2),
    "bar_ecume": dict(height=0.14, width=0.07, peak=0.38, tail_ratio=0.3, tail="notch",
                      colors=dict(back=0x5a6a74, body=0xb8c4cc, belly=0xf2f4f4, fins=0x8a98a0, iris=0xd0d8a0),
                      dorsal=[(0.3, 0.45, 0.12, 0x6a7a84), (0.5, 0.68, 0.1)], anal=(0.64, 0.78, 0.07), eye=1.1),
    "daurade_doree": dict(height=0.2, width=0.065, peak=0.4, tail_ratio=0.25, tail="fork",
                          colors=dict(back=0x6a7a80, body=0xc8ccc8, belly=0xf2f2ee, fins=0xa0a8a0, iris=0xe0c040, stripe=0xe0b040),
                          dorsal=[(0.3, 0.68, 0.1)], anal=(0.6, 0.78, 0.07), stripes=[1], eye=1.1),
    "vieille_arlequin": dict(height=0.15, width=0.08, peak=0.38, tail_ratio=0.35, tail="round",
                             colors=dict(back=0x3a7a58, body=0x6aa878, belly=0xd8e8c8, fins=0xe08a50, iris=0xe0a040, spot=0xe08a50),
                             dorsal=[(0.3, 0.75, 0.08)], anal=(0.62, 0.8, 0.07), spots=0.35, eye=1.0),
    "espadon_marees": dict(height=0.11, width=0.08, peak=0.35, tail_ratio=0.18, tail="fork", tail_size=1.4, snout=0.35,
                           colors=dict(back=0x23304a, body=0x3a4a68, belly=0xc8ccd8, fins=0x2a3a58, iris=0x9ab0d0),
                           dorsal=[(0.2, 0.3, 0.2)], anal=(0.62, 0.7, 0.05), eye=1.1),
}


def build_all():
    return [build_fish(species_id, spec) for species_id, spec in SPECIES.items()]


def build_fish(species_id, spec):
    scene = new_scene(f"fish_{species_id}")
    rng = random.Random(species_id)
    builder = MeshBuilder()
    colors = {key: rgba(value) for key, value in spec["colors"].items()}
    build_body(builder, spec, colors, rng)
    build_tail(builder, spec, colors)
    for fin in spec["dorsal"]:
        build_fin(builder, spec, fin, colors, top=True)
    if spec.get("anal"):
        build_fin(builder, spec, spec["anal"], colors, top=False)
    build_side_fins(builder, spec, colors)
    build_eyes(builder, spec, colors)
    for length, height in spec.get("barbels", []):
        build_barbels(builder, spec, length, height, colors)
    fish = builder.to_object(species_id, palette_material("PoissonDoubleFace", double_sided=True, roughness=0.55), scene.collection)
    rig = build_rig(scene, species_id)
    skin(fish, rig)
    animate_swim(rig)
    return scene


# --- Profil du corps -----------------------------------------------------------------------

def section_size(spec, t):
    """Demi-hauteur et demi-épaisseur du corps à la position t (0 = museau, 1 = queue)."""
    peak, tail_ratio = spec["peak"], spec["tail_ratio"]
    if t <= peak:
        shape = math.sin(math.pi / 2 * t / peak) ** 0.8
    else:
        shape = 1 - (1 - tail_ratio) * ((t - peak) / (1 - peak)) ** 1.3
    height, width = spec["height"] * shape, spec["width"] * shape ** 0.9
    if spec.get("head_flat") and t < peak:
        head = 1 - t / peak
        height, width = height * (1 - 0.35 * head), width * (1 + 0.35 * head)
    return height, width


def body_y(t):
    return BODY_FRONT + t * (BODY_BACK - BODY_FRONT)


def ring_angle(k):
    return math.pi / 2 + 2 * math.pi * k / RING  # k = 0 : sommet du dos


def ring_points(spec, t):
    height, width = section_size(spec, t)
    points = []
    for k in range(RING):
        angle = ring_angle(k)
        vertical = height if math.sin(angle) >= 0 else 0.85 * height
        points.append(Vector((width * math.cos(angle), body_y(t), vertical * math.sin(angle))))
    return points


def body_color(colors, vertical, section, spec, rng):
    """Dos sombre, flancs, ventre clair ; rayures et taches selon l'espèce."""
    if section in spec.get("stripes", []) and vertical > -0.3:
        return colors["stripe"]
    if spec.get("spots") and vertical > -0.2 and rng.random() < spec["spots"]:
        return colors["spot"]
    if vertical > 0.45:
        return colors["back"]
    if vertical < -0.45:
        return colors["belly"]
    return colors["body"]


def build_body(builder, spec, colors, rng):
    rings = [ring_points(spec, t) for t in SECTIONS]
    first_height, _ = section_size(spec, SECTIONS[0])
    nose = Vector((0, BODY_FRONT - spec.get("snout", 0.0), -0.1 * first_height))
    for k in range(RING):
        vertical = (math.sin(ring_angle(k)) + math.sin(ring_angle(k + 1))) / 2
        builder.polygon([nose, rings[0][(k + 1) % RING], rings[0][k]], body_color(colors, vertical, 0, spec, rng))
    for i in range(len(rings) - 1):
        for k in range(RING):
            vertical = (math.sin(ring_angle(k)) + math.sin(ring_angle(k + 1))) / 2
            quad = [rings[i][k], rings[i][(k + 1) % RING], rings[i + 1][(k + 1) % RING], rings[i + 1][k]]
            builder.polygon(quad, body_color(colors, vertical, i + 1, spec, rng))
    builder.polygon(list(rings[-1]), colors["body"])


# --- Nageoires, yeux, barbillons ------------------------------------------------------------------

def build_tail(builder, spec, colors):
    """Nageoire caudale verticale : fourchue, échancrée ou arrondie."""
    size = spec.get("tail_size", 1.0)
    height, _ = section_size(spec, 1.0)
    y = BODY_BACK
    length, span = 0.2 * size, spec["height"] * 1.05 * size
    fork = TAIL_FORK[spec["tail"]]
    points = [Vector((0, y, height)), Vector((0, y + length, span)), Vector((0, y + length - fork, 0)),
              Vector((0, y + length, -span)), Vector((0, y, -0.85 * height))]
    builder.polygon(points, colors["fins"])


def build_fin(builder, spec, fin, colors, top):
    """Nageoire dorsale (top) ou anale : plane, dans l'axe du corps."""
    start, end, fin_height = fin[:3]
    color = rgba(fin[3]) if len(fin) > 3 else colors["fins"]
    sign = 1 if top else -0.85
    base = lambda t: Vector((0, body_y(t), sign * section_size(spec, t)[0] * 0.97))
    rise = Vector((0, 0, fin_height if top else -fin_height))
    if end - start > 0.3:  # longue nageoire : un trapèze
        points = [base(start), base(start + 0.08) + rise, base(end - 0.02) + rise * 0.4, base(end)]
    else:
        points = [base(start), base(start + (end - start) * 0.35) + rise, base(end)]
    builder.polygon(points, color)


def build_side_fins(builder, spec, colors):
    """Pectorales (derrière la tête) et pelviennes (sous le ventre), de chaque côté."""
    for side in (-1, 1):
        height, width = section_size(spec, 0.22)
        builder.polygon([Vector((side * width * 0.9, body_y(0.18), -0.3 * height)),
                         Vector((side * (width + 0.07), body_y(0.32), -0.55 * height)),
                         Vector((side * width * 0.9, body_y(0.26), -0.4 * height))], colors["fins"])
        height, width = section_size(spec, 0.48)
        builder.polygon([Vector((side * width * 0.4, body_y(0.42), -0.8 * height)),
                         Vector((side * width * 0.65, body_y(0.58), -0.8 * height - 0.05)),
                         Vector((side * width * 0.4, body_y(0.5), -0.8 * height))], colors["fins"])


def build_eyes(builder, spec, colors):
    """Œil = iris coloré + pupille noire, un peu en saillie de chaque côté de la tête."""
    height, width = section_size(spec, 0.1)
    radius = 0.022 * spec.get("eye", 1.0)
    for side in (-1, 1):
        center = Vector((side * width * 0.85, body_y(0.1), 0.25 * height))
        builder.blob(center, radius, colors["iris"], subdivisions=1)
        builder.blob(center + Vector((side * radius * 0.45, -radius * 0.1, 0)), radius * 0.6, rgba(0x1d2126), subdivisions=1)


def build_barbels(builder, spec, length, height_factor, colors):
    """Paire de barbillons fins depuis les coins de la bouche."""
    height, width = section_size(spec, SECTIONS[0])
    for side in (-1, 1):
        start = Vector((side * width * 0.6, BODY_FRONT - spec.get("snout", 0.0) + 0.03, height_factor * height))
        direction = Vector((side * 0.5, -0.6, -0.55)).normalized()
        rotation = direction.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        builder.cone(start + direction * length / 2, 0.006, 0.002, length, 4, colors["fins"], rotation=rotation)


# --- Squelette et nage ------------------------------------------------------------------------------

SWIM_ACTION = "swim"
SWIM_FRAMES = 24  # une boucle = un battement de queue, 1 s à 24 images/s
SWIM_KEY_STEP = 2
# Os : (nom, parent, y de la tête de l'os (pivot), y de sa pointe). L'os `head` pointe vers le museau.
BONES = [
    ("spine", None, 0.0, 0.12),
    ("head", "spine", 0.0, -0.4),
    ("tail_1", "spine", 0.12, 0.3),
    ("tail_2", "tail_1", 0.3, 0.62),
]
# Influence le long du corps (du museau à la queue) : (os, y où il a tout le poids)
INFLUENCE = [("head", -0.3), ("spine", 0.04), ("tail_1", 0.22), ("tail_2", 0.42)]
# Balancement latéral de chaque os : (amplitude en radians, déphasage en radians).
# Le retard croissant vers la queue fait courir la vague de la tête à la queue.
SWING = {"spine": (0.03, 0.0), "head": (0.05, 0.8), "tail_1": (0.16, -0.9), "tail_2": (0.3, -1.9)}


def build_rig(scene, species_id):
    """Armature `<id>_rig` à l'origine, os dans l'axe du corps (création en mode édition)."""
    data = bpy.data.armatures.new(f"{species_id}_rig")
    data.display_type = 'STICK'
    rig = bpy.data.objects.new(f"{species_id}_rig", data)
    rig.show_in_front = True
    scene.collection.objects.link(rig)
    bpy.context.window.scene = scene
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name, parent, head_y, tail_y in BONES:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail, bone.roll = (0, head_y, 0), (0, tail_y, 0), 0.0
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def skin(fish, rig):
    """Lie le mesh au squelette : poids répartis le long du corps selon INFLUENCE."""
    fish.parent = rig
    fish.modifiers.new("Armature", 'ARMATURE').object = rig
    groups = {name: fish.vertex_groups.new(name=name) for name, *_ in BONES}
    for vert in fish.data.vertices:
        for name, weight in bone_weights(vert.co.y):
            groups[name].add([vert.index], weight, 'REPLACE')


def bone_weights(y):
    """Un ou deux os se partagent le sommet, en fondu entre leurs zones d'influence."""
    if y <= INFLUENCE[0][1]:
        return [(INFLUENCE[0][0], 1.0)]
    for (bone_a, y_a), (bone_b, y_b) in zip(INFLUENCE, INFLUENCE[1:]):
        if y <= y_b:
            t = (y - y_a) / (y_b - y_a)
            t = t * t * (3 - 2 * t)
            return [(bone_a, 1 - t), (bone_b, t)]
    return [(INFLUENCE[-1][0], 1.0)]


def animate_swim(rig):
    """Assigne l'action partagée `swim` (créée avec le premier poisson)."""
    rig.animation_data_create()
    action = bpy.data.actions.get(SWIM_ACTION)
    if action is None:
        action = key_swim(rig)
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]


def key_swim(rig):
    """Clés de rotation autour de l'axe vertical, une sinusoïde par os, première clé = dernière."""
    for frame in range(0, SWIM_FRAMES + 1, SWIM_KEY_STEP):
        phase = 2 * math.pi * frame / SWIM_FRAMES
        for name, (amplitude, offset) in SWING.items():
            bone = rig.pose.bones[name]
            # Axe vertical du monde exprimé dans le repère de l'os
            up = bone.bone.matrix_local.to_3x3().inverted() @ Vector((0, 0, 1))
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = Quaternion(up, amplitude * math.sin(phase + offset))
            bone.keyframe_insert("rotation_quaternion", frame=frame)
    action = rig.animation_data.action
    action.name = SWIM_ACTION
    return action
