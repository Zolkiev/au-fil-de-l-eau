"""Accessoires : barque (et ses rames), canne à pêche, bouchon, Moustache le
chat du ponton, et le pêcheur.

Conventions (docs/BLENDER_CONVENTIONS.md) : origine à la ligne de flottaison
pour la barque et le bouchon, au pivot (poignée) pour la canne, au sol pour
le chat, sur le banc pour le pêcheur ; l'avant regarde -Y. Objets attendus :
`rod_mount`, `lantern`, `water_mask`, `oar_l`/`oar_r` (et leurs `_grip`),
`fisher_seat` (barque), `rod_tip`, `rod_grip`, `rod_reel` (canne),
`cat_tail` (queue du chat, pivot à sa base), et les pièces articulées du
pêcheur (`fisher`, `fisher_torso`, `fisher_head`, `fisher_arm_l/r`,
`fisher_forearm_l/r`, `fisher_hand_l/r`).

Formes au choix (boutique du jeu, src/data/shop.ts) : les objets
`skin_<emplacement>_<forme>` sont des variantes d'une même pièce ; le jeu
n'en montre qu'une par emplacement. Ici : `skin_hull_*` (coques, chacune
avec son `water_mask`), `skin_oars_*` (rames, sous `oar_l` et `oar_r`) et
`skin_hat_*` (chapeaux, sous `fisher_head`).
"""

import math

from mathutils import Matrix, Vector

from .common import MeshBuilder, emissive_material, empty, new_collection, new_scene, oriented_quad, palette_material, rgba

# Barque : sections de la proue (-Y) à la poupe (+Y) : (y, demi-largeur, creux, hauteur du plat-bord)
HULL_SECTIONS = [
    (-1.62, 0.03, 0.06, 0.58),
    (-1.40, 0.26, 0.14, 0.50),
    (-1.00, 0.48, 0.20, 0.43),
    (-0.45, 0.62, 0.22, 0.38),
    (0.15, 0.66, 0.22, 0.36),
    (0.75, 0.62, 0.21, 0.37),
    (1.20, 0.52, 0.18, 0.40),
    (1.45, 0.47, 0.16, 0.43),
]
# Canoë : long, fin, pointu aux deux bouts qui se relèvent
CANOE_SECTIONS = [
    (-1.95, 0.02, 0.05, 0.64),
    (-1.70, 0.20, 0.12, 0.52),
    (-1.30, 0.40, 0.18, 0.43),
    (-0.70, 0.58, 0.21, 0.38),
    (0.10, 0.64, 0.22, 0.36),
    (0.80, 0.60, 0.21, 0.37),
    (1.36, 0.46, 0.18, 0.41),
    (1.72, 0.22, 0.12, 0.51),
    (1.95, 0.02, 0.05, 0.64),
]
# Barque plate : fond plat, avant carré relevé
PUNT_SECTIONS = [
    (-1.55, 0.40, 0.08, 0.46),
    (-1.25, 0.52, 0.16, 0.41),
    (-0.60, 0.63, 0.20, 0.37),
    (0.15, 0.66, 0.20, 0.36),
    (0.75, 0.64, 0.20, 0.36),
    (1.20, 0.58, 0.19, 0.38),
    (1.48, 0.54, 0.15, 0.41),
]
# Petit drakkar : étrave et étambot relevés (ils portent la tête et la queue du dragon)
DRAKKAR_SECTIONS = [
    (-1.70, 0.03, 0.06, 0.74),
    (-1.42, 0.26, 0.14, 0.56),
    (-1.00, 0.48, 0.20, 0.44),
    (-0.45, 0.62, 0.22, 0.38),
    (0.15, 0.66, 0.22, 0.36),
    (0.75, 0.62, 0.21, 0.37),
    (1.20, 0.52, 0.18, 0.41),
    (1.48, 0.44, 0.15, 0.47),
    (1.70, 0.18, 0.09, 0.62),
]
# Profil d'une demi-section sous le plat-bord : (part de la demi-largeur, part du creux)
ROUND_PROFILE = [(0.78, 0.55), (0.40, 0.92)]
FLAT_PROFILE = [(0.92, 0.82), (0.50, 1.0)]
MASK_HEIGHT = 0.345
# Épaisseur de l'étrave et du tableau arrière : l'intérieur de la coque s'arrête
# avant les faces extérieures (des faces superposées clignotent à l'écran)
END_THICKNESS = 0.05
PAINT = rgba(0x6aa9a8)
STRIPE = rgba(0xefe6d2)
ANTIFOULING = rgba(0xa6503e)
WOOD_INSIDE = [rgba(0xc79a6a), rgba(0xb88a5c)]
WOOD_SEAT = rgba(0xdcb58c)
WOOD_DARK = rgba(0x6f4a32)
GOLD = rgba(0xe8b84a)
# Coques au choix : sections, profil, couleur du fond, plancher (de y à y) et décorations propres à la coque.
# Toutes gardent la même largeur au milieu : les rames, la canne, le banc du pêcheur et la lanterne ne bougent pas.
HULLS = {
    "classic": dict(sections=HULL_SECTIONS, profile=ROUND_PROFILE, bottom=ANTIFOULING, floor=(-1.0, 1.2)),
    "canoe": dict(sections=CANOE_SECTIONS, profile=ROUND_PROFILE, bottom=rgba(0x8f5f3f), floor=(-1.0, 1.2)),
    "punt": dict(sections=PUNT_SECTIONS, profile=FLAT_PROFILE, bottom=rgba(0x4f5d57), floor=(-1.0, 1.3)),
    "drakkar": dict(sections=DRAKKAR_SECTIONS, profile=ROUND_PROFILE, bottom=WOOD_DARK, floor=(-1.0, 1.2)),
}


def build_all():
    return [build_boat(), build_rod(), build_bobber(), build_cat(), build_fisher()]


# --- Barque ---------------------------------------------------------------------

def hull_ring(y, width, depth, rim, profile=ROUND_PROFILE, inset=0.0):
    """Section en U, de bâbord (+X) à tribord (-X) : plat-bord, bordés, quille."""
    w, d = width * (1 - inset), depth
    lift = 0.04 if inset else 0.0
    half = [(1.0, rim), (0.96, 0.10), *[(fx, -fz * d) for fx, fz in profile]]
    points = [*half, (0.0, -d), *[(-fx, z) for fx, z in reversed(half)]]
    return [Vector((fx * w, y, z if z == rim else z + lift)) for fx, z in points]


def section_at(sections, y):
    """Section de la coque interpolée à l'ordonnée `y` : (demi-largeur, creux, plat-bord)."""
    for (y0, *a), (y1, *b) in zip(sections, sections[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return tuple(u + (v - u) * t for u, v in zip(a, b))
    raise ValueError(f"y = {y} hors de la coque")


def inner_rings(sections, profile):
    """Sections de l'intérieur : les mêmes, sauf aux deux bouts, en retrait de l'épaisseur des planches."""
    ys = [section[0] for section in sections]
    ys[0] += END_THICKNESS
    ys[-1] -= END_THICKNESS
    return [hull_ring(y, *section_at(sections, y), profile=profile, inset=0.08) for y in ys]


def strake_color(index, bottom):
    """Couleur du bordé entre les points `index` et `index + 1` d'une section."""
    if index in (0, 7):
        return PAINT
    if index in (1, 6):
        return STRIPE
    return bottom


def build_boat():
    """
    Barque : `boat` (Empty) porte ce qui ne change pas (lanterne, canne,
    siège du pêcheur, rames) et les coques au choix `skin_hull_<forme>`,
    chacune avec ses aménagements et son `water_mask`.
    """
    scene = new_scene("boat")
    collection = scene.collection
    boat = empty("boat", collection, display='PLAIN_AXES', size=0.5)
    for shape, hull in HULLS.items():
        build_hull(collection, boat, shape, hull)
    build_lantern(collection, boat)
    # Canne sur le plat-bord droit, à portée de main du pêcheur assis au banc du milieu
    empty("rod_mount", collection, location=(-0.56, 0.2, 0.37), display='ARROWS', size=0.25, parent=boat)
    empty("fisher_seat", collection, location=(0, 0.55, 0.165), display='ARROWS', size=0.3, parent=boat)
    build_oars(collection, boat)
    return scene


def build_hull(collection, boat, shape, hull):
    """Une coque complète (bordés, bancs, plancher, petit matériel) et son masque « au sec »."""
    sections, profile = hull["sections"], hull["profile"]
    builder = MeshBuilder()
    outer = [hull_ring(*section, profile=profile) for section in sections]
    build_shell(builder, outer, inner_rings(sections, profile), hull["bottom"])
    build_fittings(builder, sections, hull["floor"])
    if shape == "drakkar":
        build_dragon(builder, sections)
    # Coque vue des deux côtés : matériau double face
    obj = builder.to_object(f"skin_hull_{shape}", palette_material("PaletteDoubleFace", double_sided=True), collection, parent=boat)
    build_water_mask(collection, obj, sections)
    return obj


def build_shell(builder, outer, inner, bottom):
    """Coque épaisse : bordés extérieurs peints, intérieur en bois, plats-bords, tableau arrière."""
    for i in range(len(outer) - 1):
        axis = Vector((0, (outer[i][0].y + outer[i + 1][0].y) / 2, 0.15))
        for k in range(len(outer[i]) - 1):
            quad = [outer[i][k], outer[i][k + 1], outer[i + 1][k + 1], outer[i + 1][k]]
            oriented_quad(builder, quad, strake_color(k, bottom), axis)
            # L'intérieur regarde vers l'axe de la barque
            quad = [inner[i][k], inner[i][k + 1], inner[i + 1][k + 1], inner[i + 1][k]]
            oriented_quad(builder, quad, WOOD_INSIDE[k % 2], axis, away=False)
        for k in (0, len(outer[i]) - 1):
            builder.polygon([outer[i][k], outer[i + 1][k], inner[i + 1][k], inner[i][k]], WOOD_DARK)
    for ring_outer, ring_inner, facing in ((outer[-1], inner[-1], 1), (outer[0], inner[0], -1)):
        close_end(builder, ring_outer, ring_inner, facing)


def close_end(builder, ring_outer, ring_inner, facing):
    """
    Ferme une extrémité de la coque (tableau arrière ou étrave) : face
    extérieure, face intérieure (en retrait de END_THICKNESS) et tranche
    entre les deux.
    """
    back = Vector((0, ring_outer[0].y - facing, 0.1))
    oriented_quad(builder, list(ring_outer), rgba(0x8f5f3f), back)
    oriented_quad(builder, list(reversed(ring_inner)), WOOD_INSIDE[0], back + Vector((0, 2 * facing, 0)))
    for k in range(len(ring_outer) - 1):
        builder.polygon([ring_outer[k], ring_outer[k + 1], ring_inner[k + 1], ring_inner[k]], WOOD_DARK)


def inner_half_width(sections, y, height=0.12):
    """Demi-largeur intérieure approximative de la coque à l'ordonnée `y`."""
    for (y0, w0, _, _), (y1, w1, _, _) in zip(sections, sections[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return (w0 + (w1 - w0) * t) * 0.86 - height * 0.05
    return 0.3


def build_fittings(builder, sections, floor):
    """Bancs, plancher (de floor[0] à floor[1]), dames de nage et mât de lanterne."""
    for y in (-0.55, 0.55, 1.15):
        width = 2 * inner_half_width(sections, y)
        builder.box((0, y, 0.14), (width, 0.28, 0.05), WOOD_SEAT)
    for x in (-0.24, -0.08, 0.08, 0.24):
        builder.box((x, (floor[0] + floor[1]) / 2, -0.15), (0.14, floor[1] - floor[0], 0.03), WOOD_INSIDE[1])
    # Dames de nage (les rames sont des objets à part : le jeu les anime)
    for side in (-1, 1):
        builder.box((side * 0.62, 0.1, 0.40), (0.05, 0.08, 0.08), WOOD_DARK)
    builder.box((0.4, 1.36, 0.72), (0.04, 0.04, 0.62), WOOD_DARK)
    builder.box((0.4, 1.36, 1.12), (0.16, 0.16, 0.03), WOOD_DARK)
    build_gear(builder)


# Dessus du plancher : les objets posés au fond y sont enfoncés de 5 mm (pas de faces confondues)
FLOOR_TOP = -0.135


def build_gear(builder):
    """Petit matériel au fond de la barque : boîte à pêche, seau, rouleau de corde (loin des rames)."""
    # Boîte à pêche verte, avec son couvercle un peu plus grand et une poignée
    builder.box((0.2, 0.72, FLOOR_TOP - 0.005 + 0.07), (0.3, 0.18, 0.14), rgba(0x3f6e5a))
    builder.box((0.2, 0.72, FLOOR_TOP + 0.147), (0.31, 0.19, 0.025), rgba(0x2f5a4a))
    builder.box((0.2, 0.72, FLOOR_TOP + 0.172), (0.12, 0.025, 0.03), WOOD_DARK)
    # Seau de métal, plus large en haut
    builder.cone((-0.24, 0.85, FLOOR_TOP - 0.005 + 0.1), 0.085, 0.11, 0.2, 10, rgba(0x8fa3ad))
    # Rouleau de corde à l'avant, avec son creux plus sombre
    builder.cone((0.0, -0.8, FLOOR_TOP - 0.005 + 0.025), 0.12, 0.12, 0.05, 12, rgba(0xd9c49a))
    builder.cone((0.0, -0.8, FLOOR_TOP + 0.024), 0.05, 0.05, 0.05, 10, rgba(0xa8905f))


SHIELD_COLORS = [rgba(0xb5523b), rgba(0xefe6d2)]


def build_dragon(builder, sections):
    """
    Drakkar : tête de dragon à la proue, queue enroulée à la poupe, boucliers
    ronds le long des plats-bords (loin des rames). Rien ne dépasse la tête du
    pêcheur : la vue vers le bouchon reste dégagée.
    """
    bow_y, _, _, bow_rim = sections[0]
    stern_y, _, _, stern_rim = sections[-1]
    # Cou : part de l'étrave et monte vers l'avant ; tête, museau, cornes et yeux
    neck = [Vector((0, bow_y + 0.06, bow_rim - 0.2)), Vector((0, bow_y - 0.08, bow_rim + 0.16)), Vector((0, bow_y - 0.06, bow_rim + 0.34))]
    limb(builder, neck, 0.07, 0.055, WOOD_DARK)
    head = neck[-1] + Vector((0, -0.06, 0.03))
    nod = Matrix.Rotation(0.2, 4, 'X')  # la tête regarde un peu vers l'eau
    builder.box(head, (0.15, 0.27, 0.14), WOOD_DARK, rotation=nod)
    builder.box(head + Vector((0, -0.17, -0.075)), (0.11, 0.16, 0.07), rgba(0x8f5f3f), rotation=nod)
    for side in (-1, 1):
        builder.blob(head + Vector((side * 0.078, -0.05, 0.035)), 0.026, GOLD)
        horn = Matrix.Rotation(-0.6, 4, 'X') @ Matrix.Rotation(side * 0.3, 4, 'Y')  # couchées vers l'arrière
        builder.cone(head + Vector((side * 0.05, 0.12, 0.13)), 0.028, 0.004, 0.17, 5, GOLD, rotation=horn)
    # Queue : monte de l'étambot et s'enroule vers l'avant
    tail = [Vector((0, stern_y - 0.05, stern_rim - 0.2)), Vector((0, stern_y + 0.08, stern_rim + 0.12)),
            Vector((0, stern_y + 0.03, stern_rim + 0.27)), Vector((0, stern_y - 0.1, stern_rim + 0.29)),
            Vector((0, stern_y - 0.13, stern_rim + 0.19))]
    limb(builder, tail, 0.06, 0.025, WOOD_DARK)
    builder.blob(tail[-1], 0.04, GOLD)
    # Boucliers accrochés dehors, sous le plat-bord
    sideways = Matrix.Rotation(math.pi / 2, 4, 'Y')
    for index, y in enumerate((-1.0, -0.55, 0.62, 1.08)):
        width, _, rim = section_at(sections, y)
        for side in (-1, 1):
            # Le bordé rentre un peu sous le plat-bord : le bouclier s'y appuie
            center = Vector((side * (width * 0.975 + 0.012), y, rim - 0.15))
            builder.cone(center, 0.15, 0.15, 0.03, 10, SHIELD_COLORS[index % 2], rotation=sideways)
            builder.blob(center + Vector((side * 0.02, 0, 0)), 0.04, GOLD)


def limb(builder, points, radius_start, radius_end, color):
    """Membre courbe fait de tronçons qui s'emboîtent (cou, queue), de plus en plus fins."""
    count = len(points) - 1
    for index, (start, end) in enumerate(zip(points, points[1:])):
        direction = end - start
        rotation = direction.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
        r0 = radius_start + (radius_end - radius_start) * index / count
        r1 = radius_start + (radius_end - radius_start) * (index + 1) / count
        builder.cone((start + end) / 2, r0, r1, direction.length + 0.03, 6, color, rotation=rotation)


# Rames : pivot au tolet, au-dessus des dames de nage
OAR_PIN = (0.62, 0.1, 0.46)
OAR_SHAFT = rgba(0xd8b48a)
# Pelles au choix : contour d'une demi-pelle (x le long de la rame, z ≥ 0 en travers), du manche au bout
OAR_BLADES = {
    "classic": dict(outline=[(1.10, 0.075), (1.60, 0.075)], color=PAINT, tip=None),
    "leaf": dict(outline=[(1.06, 0.02), (1.22, 0.095), (1.46, 0.085), (1.68, 0.012)], color=PAINT, tip=None),
    # Queue de poisson : la pelle s'évase puis se creuse en V
    "fishtail": dict(outline=[(1.08, 0.025), (1.34, 0.06), (1.66, 0.15)], color=rgba(0xe0873f), tip=1.5),
}
BLADE_THICKNESS = 0.02


def build_oars(collection, boat):
    """
    Rames posées sur les dames de nage : `oar_l` / `oar_r` (Empties, pivot au
    tolet) portent les rames au choix `skin_oars_<forme>`. En repère local, la
    rame s'étend vers +X : poignée à l'intérieur (-X), pelle dehors (+X). La
    rame droite est tournée d'un demi-tour. Le jeu les fait battre (voir
    src/scene/oars.ts) ; `oar_*_grip` marque la main.
    """
    x, y, z = OAR_PIN
    for name, side in (("oar_l", 1), ("oar_r", -1)):
        oar = empty(name, collection, location=(side * x, y, z), rotation=(0, 0, 0 if side > 0 else math.pi),
                    display='PLAIN_AXES', size=0.2, parent=boat)
        for shape, blade in OAR_BLADES.items():
            builder = MeshBuilder()
            builder.box((0.405, 0, 0), (1.69, 0.045, 0.045), OAR_SHAFT if shape != "fishtail" else GOLD)
            builder.box((-0.35, 0, 0), (0.2, 0.052, 0.052), WOOD_DARK)
            build_blade(builder, blade)
            builder.to_object(f"skin_oars_{shape}", palette_material(), collection, parent=oar)
        empty(f"{name}_grip", collection, location=(-0.36, 0, 0), display='SPHERE', size=0.04, parent=oar)


def build_blade(builder, blade):
    """
    Pelle : deux moitiés symétriques (z > 0 et z < 0), chacune un prisme de
    BLADE_THICKNESS d'épaisseur. `tip` : abscisse du creux du V au bout de la
    pelle (queue de poisson), sinon le bout est droit.
    """
    outline = blade["outline"]
    first, last = outline[0][0], outline[-1][0]
    spine = [(first, 0.0), *outline, (blade["tip"] if blade["tip"] else last, 0.0)]
    for mirror in (1, -1):
        prism(builder, [(x, mirror * z) for x, z in spine], BLADE_THICKNESS, blade["color"])


def prism(builder, outline, thickness, color):
    """Plaque d'épaisseur `thickness` (le long de Y), de contour (x, z) quelconque."""
    top = [Vector((x, thickness / 2, z)) for x, z in outline]
    bottom = [Vector((x, -thickness / 2, z)) for x, z in outline]
    center = sum(top + bottom, Vector()) / (2 * len(outline))
    oriented_quad(builder, top, color, center)
    oriented_quad(builder, list(reversed(bottom)), color, center)
    for k in range(len(outline)):
        n = (k + 1) % len(outline)
        # Pas de tranche le long du manche (z = 0) : les deux moitiés de la pelle s'y rejoignent
        if outline[k][1] == 0 and outline[n][1] == 0:
            continue
        oriented_quad(builder, [top[k], top[n], bottom[n], bottom[k]], color, center)


def build_lantern(collection, boat):
    """Verre de la lanterne : il brille la nuit (le jeu règle son intensité)."""
    builder = MeshBuilder()
    builder.box((0, 0, 0), (0.12, 0.12, 0.14), rgba(0xffe2a8))
    glass = builder.to_object("lantern", emissive_material("LanternGlass", 0xffe2a8, 0xffb35c, 1.0), collection, parent=boat)
    glass.location = (0.4, 1.36, 1.04)
    # Son matériau n'utilise pas de couleurs de sommets : on retire l'attribut (sinon avertissement à l'export)
    glass.data.color_attributes.remove(glass.data.color_attributes["Col"])


def build_water_mask(collection, hull, sections):
    """Plan au niveau des plats-bords qui couvre l'intérieur de la coque (voir waterMask.ts)."""
    builder = MeshBuilder()
    left = [Vector((w * 0.9, y, MASK_HEIGHT)) for y, w, _, _ in sections]
    right = [Vector((-w * 0.9, y, MASK_HEIGHT)) for y, w, _, _ in reversed(sections)]
    face = builder.polygon(left + right, rgba(0xffffff))
    if face.normal.z < 0:
        face.normal_flip()
    mask = builder.to_object("water_mask", palette_material(), collection, parent=hull)
    mask.display_type = 'WIRE'


# --- Canne ------------------------------------------------------------------------

ROD_LENGTH = 2.4


def build_rod():
    """Canne allongée vers -Y, pivot à la poignée ; `rod_tip` marque la pointe."""
    scene = new_scene("rod")
    builder = MeshBuilder()
    along_y = Matrix.Rotation(math.pi / 2, 4, 'X')  # l'axe Z du cône devient -Y
    across = Matrix.Rotation(math.pi / 2, 4, 'Y')  # l'axe Z du cylindre devient X
    # Le scion s'arrête dans le manche (fin à 0.35) : leurs bouts ne sont pas dans le même plan
    blank_start, blank_end = 0.34, -ROD_LENGTH
    builder.cone((0, (blank_start + blank_end) / 2, 0), 0.022, 0.006, blank_start - blank_end, 8, rgba(0x3f5f4a), rotation=along_y)
    builder.cone((0, 0.115, 0), 0.032, 0.03, 0.47, 8, rgba(0xc9a57a), rotation=along_y)
    builder.cone((0, 0.37, 0), 0.028, 0.028, 0.04, 8, rgba(0x2b2b2b), rotation=along_y)
    builder.box((0, 0.12, -0.035), (0.012, 0.06, 0.04), rgba(0x9aa3a8))
    builder.cone((0, 0.12, -0.075), 0.045, 0.045, 0.04, 10, rgba(0x9aa3a8), rotation=across)
    builder.box((0.035, 0.12, -0.075), (0.01, 0.01, 0.06), rgba(0x2b2b2b))
    for y in (-0.6, -1.2, -1.7, -2.1):
        builder.box((0, y, -0.02), (0.012, 0.012, 0.03), rgba(0xcfd5d8))
    rod = builder.to_object("rod", palette_material(), scene.collection)
    empty("rod_tip", scene.collection, location=(0, blank_end, 0), display='SPHERE', size=0.05, parent=rod)
    # Mains du pêcheur : la droite tient la poignée au niveau du moulinet, la gauche tourne la manivelle
    empty("rod_grip", scene.collection, location=(0, 0.12, -0.01), display='SPHERE', size=0.03, parent=rod)
    empty("rod_reel", scene.collection, location=(0.05, 0.12, -0.075), display='SPHERE', size=0.03, parent=rod)
    return scene


# --- Bouchon -------------------------------------------------------------------------

def build_bobber():
    """Bouchon : dôme rouge au-dessus de l'eau, corps blanc allongé dessous, antenne à pointe jaune."""
    import bmesh

    scene = new_scene("bobber")
    builder = MeshBuilder()
    verts = bmesh.ops.create_uvsphere(builder.bm, u_segments=10, v_segments=6, radius=0.1)["verts"]
    for vert in verts:
        if vert.co.z < 0:
            vert.co.z *= 1.6
    faces = {face for vert in verts for face in vert.link_faces}
    for face in faces:
        above = face.calc_center_median().z > 0
        builder.paint([face], rgba(0xe0483c) if above else rgba(0xf6f1e7))
    builder.cone((0, 0, 0.175), 0.013, 0.01, 0.19, 6, rgba(0xe0483c))
    builder.blob((0, 0, 0.275), 0.022, rgba(0xffd166), subdivisions=1)
    builder.to_object("bobber", palette_material(), scene.collection)
    return scene


# --- Moustache, le chat du ponton ----------------------------------------------------------

GINGER = rgba(0xe39a4f)
GINGER_DARK = rgba(0xc9763a)
CREAM = rgba(0xf6e3c6)
STRAW = rgba(0xe8c77a)
# Queue : points du pivot vers le bout (repère de `cat_tail`), elle s'enroule vers le haut
TAIL_POINTS = [(0, 0, 0), (0.05, 0.12, 0.02), (0.14, 0.2, 0.06), (0.2, 0.2, 0.16), (0.2, 0.14, 0.25)]


def build_cat():
    """Chat roux assis, chapeau de paille ; origine au sol, regard vers -Y. La queue est un objet à part."""
    scene = new_scene("cat")
    builder = MeshBuilder()
    build_cat_body(builder)
    build_cat_head(builder)
    build_straw_hat(builder)
    cat = builder.to_object("cat", palette_material(), scene.collection)
    build_cat_tail(scene.collection, cat)
    return scene


def build_cat_body(builder):
    """Corps en poire, plastron crème, cuisses, pattes avant."""
    builder.blob((0, 0.02, 0.2), 0.2, GINGER, scale=(1.0, 1.1, 1.25))
    builder.blob((0, -0.12, 0.22), 0.11, CREAM, scale=(1.0, 0.6, 1.3))
    for side in (-1, 1):
        builder.blob((side * 0.13, 0.06, 0.1), 0.11, GINGER_DARK, scale=(0.8, 1.3, 0.9))
        builder.cone((side * 0.07, -0.13, 0.11), 0.035, 0.03, 0.2, 6, GINGER)
        builder.blob((side * 0.07, -0.16, 0.025), 0.045, CREAM, scale=(1.0, 1.3, 0.6))


def build_cat_head(builder):
    """Tête ronde, museau, nez rose, yeux brillants, oreilles, et les fameuses moustaches."""
    builder.blob((0, -0.08, 0.5), 0.15, GINGER, scale=(1.15, 1.0, 0.92))
    builder.blob((0, -0.21, 0.46), 0.065, CREAM, scale=(1.3, 0.8, 0.8))
    builder.blob((0, -0.268, 0.485), 0.018, rgba(0xe79bb0))
    for side in (-1, 1):
        builder.blob((side * 0.06, -0.205, 0.53), 0.026, rgba(0x2b2b2b))
        builder.blob((side * 0.052, -0.228, 0.542), 0.008, rgba(0xffffff))
        builder.cone((side * 0.085, -0.06, 0.64), 0.055, 0.004, 0.11, 4, GINGER, rotation=Matrix.Rotation(side * 0.35, 4, 'Y'))
        for height, angle in ((0.47, 0.18), (0.455, -0.05)):
            whisker = Matrix.Rotation(side * angle, 4, 'Z')
            builder.box((side * 0.12, -0.24, height), (0.13, 0.006, 0.006), rgba(0xffffff), rotation=whisker)


def build_straw_hat(builder):
    """Petit chapeau de paille (les oreilles passent au travers du bord)."""
    builder.cone((0, -0.06, 0.64), 0.17, 0.17, 0.014, 12, STRAW)
    builder.cone((0, -0.06, 0.668), 0.075, 0.075, 0.022, 10, rgba(0xb5523b))
    builder.cone((0, -0.06, 0.7), 0.074, 0.062, 0.06, 10, STRAW)


def build_cat_tail(collection, cat):
    """Queue enroulée, en segments de plus en plus fins ; bout crème. Pivot à sa base."""
    builder = MeshBuilder()
    points = [Vector(point) for point in TAIL_POINTS]
    for index, (start, end) in enumerate(zip(points, points[1:])):
        direction = end - start
        rotation = direction.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
        radius = 0.036 - index * 0.004
        color = CREAM if index == len(points) - 2 else GINGER
        builder.cone((start + end) / 2, radius, radius - 0.004, direction.length + 0.02, 6, color, rotation=rotation)
    tail = builder.to_object("cat_tail", palette_material(), collection, parent=cat)
    tail.location = (0, 0.2, 0.06)


# --- Pêcheur ---------------------------------------------------------------------------

SKIN = rgba(0xe7b48f)
SKIN_DARK = rgba(0xd99b77)
JACKET = rgba(0xe0a83a)
JACKET_DARK = rgba(0xc38d2b)
TROUSERS = rgba(0x3e5470)
BOOTS = rgba(0x5a3d2b)
HAT = rgba(0x6f7d4a)
HAT_BAND = rgba(0x55603a)
BEARD = rgba(0x7a5236)
EYE = rgba(0x2b2b2b)
SCARF = rgba(0xb8483c)
# Longueurs des bras (m) ; la main est au bout de l'avant-bras
UPPER_ARM, FOREARM, HAND = 0.25, 0.23, 0.045
HIPS = (0, 0.02, 0.06)
SHOULDER = (0.19, 0, 0.4)
NECK_Z = 0.46


def build_fisher():
    """
    Pêcheur assis, en pièces articulées que le jeu anime (src/scene/fisher.ts).
    Origine sur le banc, face à -Y comme la barque :
    fisher (bassin et jambes) → fisher_torso (pivot aux hanches)
      → fisher_head (pivot au cou) → skin_hat_<forme> (chapeaux au choix)
      → fisher_arm_l/r (pivot à l'épaule, bras pendant vers -Z)
        → fisher_forearm_l/r (pivot au coude) → fisher_hand_l/r (Empty, centre de la main).
    La gauche est +X (l'avant regarde -Y).
    """
    scene = new_scene("fisher")
    collection = scene.collection
    material = palette_material()
    legs = MeshBuilder()
    build_fisher_legs(legs)
    root = legs.to_object("fisher", material, collection)
    torso = fisher_part(build_fisher_torso, "fisher_torso", material, collection, root, HIPS)
    head = fisher_part(build_fisher_head, "fisher_head", material, collection, torso, (0, 0, NECK_Z))
    for shape, build in HATS.items():
        fisher_part(build, f"skin_hat_{shape}", material, collection, head, (0, 0, 0))
    for side, suffix in ((1, "l"), (-1, "r")):
        arm = fisher_part(build_upper_arm, f"fisher_arm_{suffix}", material, collection, torso,
                          (side * SHOULDER[0], SHOULDER[1], SHOULDER[2]))
        forearm = fisher_part(build_forearm, f"fisher_forearm_{suffix}", material, collection, arm, (0, 0, -UPPER_ARM))
        empty(f"fisher_hand_{suffix}", collection, location=(0, 0, -FOREARM - HAND), display='SPHERE', size=0.03, parent=forearm)
    return scene


def fisher_part(build, name, material, collection, parent, location):
    """Une pièce du pêcheur, construite autour de son pivot et placée par rapport à son parent."""
    builder = MeshBuilder()
    build(builder)
    obj = builder.to_object(name, material, collection, parent=parent)
    obj.location = location
    return obj


def build_fisher_legs(builder):
    """Bassin posé sur le banc, cuisses vers l'avant, genoux, tibias jusqu'au plancher, bottes."""
    forward = Matrix.Rotation(math.pi / 2, 4, 'X')  # l'axe Z du cône devient -Y
    builder.blob((0, 0.02, 0.07), 0.17, TROUSERS, scale=(1.15, 1.0, 0.6))
    for side in (-1, 1):
        x = side * 0.1
        builder.cone((x, -0.16, 0.07), 0.075, 0.065, 0.34, 8, TROUSERS, rotation=forward)
        builder.blob((x, -0.33, 0.06), 0.07, TROUSERS)
        builder.cone((x, -0.33, -0.11), 0.065, 0.055, 0.34, 8, TROUSERS)
        # Botte : 5 mm dans le plancher (qui est 30 cm sous le banc)
        builder.box((x, -0.37, -0.265), (0.12, 0.22, 0.08), BOOTS)


def build_fisher_torso(builder):
    """Ciré moutarde un peu évasé, rabat plus sombre devant, écharpe rouge au cou ; pivot aux hanches."""
    builder.cone((0, 0, 0.2), 0.2, 0.155, 0.42, 10, JACKET)
    builder.box((0, -0.19, 0.2), (0.03, 0.02, 0.34), JACKET_DARK)
    builder.cone((0, 0, 0.43), 0.1, 0.085, 0.06, 10, SCARF)


def build_fisher_head(builder):
    """Tête ronde, nez, yeux, barbe courte ; regarde vers -Y. Pivot au cou. Les chapeaux sont à part (`skin_hat_*`)."""
    builder.blob((0, 0, 0.14), 0.14, SKIN, subdivisions=2)
    builder.blob((0, -0.137, 0.125), 0.032, SKIN_DARK)
    for side in (-1, 1):
        builder.blob((side * 0.05, -0.123, 0.17), 0.017, EYE)
    builder.blob((0, -0.075, 0.065), 0.105, BEARD, scale=(1.0, 0.75, 0.7))


def build_hat_bob(builder):
    """Bob kaki à bande sombre (le chapeau d'origine)."""
    builder.cone((0, 0, 0.215), 0.2, 0.185, 0.03, 12, HAT)
    builder.cone((0, 0, 0.245), 0.135, 0.13, 0.035, 12, HAT_BAND)
    builder.cone((0, 0, 0.29), 0.128, 0.1, 0.07, 12, HAT)


def build_hat_cap(builder):
    """Casquette : calotte ronde, visière plus sombre vers l'avant, bouton au sommet."""
    builder.cone((0, 0, 0.222), 0.142, 0.138, 0.045, 12, HAT)
    builder.cone((0, 0, 0.27), 0.138, 0.085, 0.056, 12, HAT)
    builder.blob((0, 0, 0.3), 0.02, HAT_BAND)
    builder.box((0, -0.19, 0.2), (0.2, 0.17, 0.016), HAT_BAND, rotation=Matrix.Rotation(0.12, 4, 'X'))


def build_hat_straw(builder):
    """Chapeau de paille : très large bord, calotte basse, ruban."""
    builder.cone((0, 0, 0.214), 0.29, 0.275, 0.018, 14, HAT)
    builder.cone((0, 0, 0.24), 0.137, 0.133, 0.034, 12, HAT_BAND)
    builder.cone((0, 0, 0.284), 0.132, 0.112, 0.055, 12, HAT)


def build_hat_beanie(builder):
    """Bonnet : revers épais, calotte ronde, pompon clair."""
    builder.cone((0, 0, 0.218), 0.15, 0.148, 0.05, 12, HAT_BAND)
    builder.cone((0, 0, 0.27), 0.142, 0.1, 0.06, 12, HAT)
    builder.cone((0, 0, 0.313), 0.1, 0.05, 0.03, 12, HAT)
    builder.blob((0, 0, 0.36), 0.045, rgba(0xf2ead8))


def build_hat_captain(builder):
    """Casquette de capitaine : coiffe blanche évasée, bandeau marine, visière noire, écusson doré (couleurs fixes)."""
    builder.cone((0, 0, 0.225), 0.142, 0.14, 0.05, 12, rgba(0x2f4468))
    builder.cone((0, 0, 0.277), 0.142, 0.18, 0.06, 12, rgba(0xf4f1ea))
    builder.cone((0, 0, 0.311), 0.18, 0.165, 0.012, 12, rgba(0xf4f1ea))
    builder.box((0, -0.18, 0.198), (0.19, 0.13, 0.016), rgba(0x23262b), rotation=Matrix.Rotation(0.18, 4, 'X'))
    builder.blob((0, -0.143, 0.235), 0.027, GOLD, scale=(1.0, 0.5, 1.0))


# Chapeaux au choix : objets `skin_hat_<forme>`, enfants de la tête
HATS = {"bob": build_hat_bob, "cap": build_hat_cap, "straw": build_hat_straw, "beanie": build_hat_beanie, "captain": build_hat_captain}


def build_upper_arm(builder):
    """Épaule arrondie et bras (manche du ciré), pendant vers -Z depuis l'épaule."""
    builder.blob((0, 0, 0), 0.07, JACKET)
    builder.cone((0, 0, -UPPER_ARM / 2), 0.058, 0.05, UPPER_ARM, 8, JACKET)


def build_forearm(builder):
    """Avant-bras, manchette plus sombre et main, pendant vers -Z depuis le coude."""
    builder.blob((0, 0, 0), 0.052, JACKET)
    builder.cone((0, 0, -FOREARM / 2), 0.05, 0.045, FOREARM, 8, JACKET)
    builder.cone((0, 0, -FOREARM + 0.015), 0.053, 0.053, 0.04, 8, JACKET_DARK)
    builder.blob((0, 0, -FOREARM - HAND), 0.048, SKIN)

