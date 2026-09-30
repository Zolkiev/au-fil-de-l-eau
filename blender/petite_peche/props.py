"""Accessoires : barque, canne à pêche, bouchon, et Moustache le chat du ponton.

Conventions (docs/BLENDER_CONVENTIONS.md) : origine à la ligne de flottaison
pour la barque et le bouchon, au pivot (poignée) pour la canne, au sol pour
le chat ; l'avant regarde -Y. Objets attendus : `rod_mount`, `lantern`,
`water_mask` (barque), `rod_tip` (canne), `cat_tail` (queue du chat, pivot à
sa base).
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


def build_all():
    return [build_boat(), build_rod(), build_bobber(), build_cat()]


# --- Barque ---------------------------------------------------------------------

def hull_ring(y, width, depth, rim, inset=0.0):
    """Section en U, de bâbord (+X) à tribord (-X) : plat-bord, bordés, quille."""
    w, d = width * (1 - inset), depth
    lift = 0.04 if inset else 0.0
    profile = [(1.0, rim), (0.96, 0.10), (0.78, -0.55 * d), (0.40, -0.92 * d), (0.0, -d),
               (-0.40, -0.92 * d), (-0.78, -0.55 * d), (-0.96, 0.10), (-1.0, rim)]
    return [Vector((fx * w, y, z if z == rim else z + lift)) for fx, z in profile]


def section_at(y):
    """Section de la coque interpolée à l'ordonnée `y` : (demi-largeur, creux, plat-bord)."""
    for (y0, *a), (y1, *b) in zip(HULL_SECTIONS, HULL_SECTIONS[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return tuple(u + (v - u) * t for u, v in zip(a, b))
    raise ValueError(f"y = {y} hors de la coque")


def inner_rings():
    """Sections de l'intérieur : les mêmes, sauf aux deux bouts, en retrait de l'épaisseur des planches."""
    ys = [section[0] for section in HULL_SECTIONS]
    ys[0] += END_THICKNESS
    ys[-1] -= END_THICKNESS
    return [hull_ring(y, *section_at(y), inset=0.08) for y in ys]


def strake_color(index):
    """Couleur du bordé entre les points `index` et `index + 1` d'une section."""
    if index in (0, 7):
        return PAINT
    if index in (1, 6):
        return STRIPE
    return ANTIFOULING


def build_boat():
    scene = new_scene("boat")
    collection = scene.collection
    builder = MeshBuilder()
    outer = [hull_ring(*section) for section in HULL_SECTIONS]
    inner = inner_rings()
    build_shell(builder, outer, inner)
    build_fittings(builder)
    # Coque vue des deux côtés : matériau double face
    boat = builder.to_object("boat", palette_material("PaletteDoubleFace", double_sided=True), collection)
    build_lantern(collection, boat)
    empty("rod_mount", collection, location=(-0.56, -0.05, 0.37), display='ARROWS', size=0.25, parent=boat)
    build_water_mask(collection, boat)
    return scene


def build_shell(builder, outer, inner):
    """Coque épaisse : bordés extérieurs peints, intérieur en bois, plats-bords, tableau arrière."""
    for i in range(len(outer) - 1):
        axis = Vector((0, (outer[i][0].y + outer[i + 1][0].y) / 2, 0.15))
        for k in range(len(outer[i]) - 1):
            quad = [outer[i][k], outer[i][k + 1], outer[i + 1][k + 1], outer[i + 1][k]]
            oriented_quad(builder, quad, strake_color(k), axis)
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


def inner_half_width(y, height=0.12):
    """Demi-largeur intérieure approximative de la coque à l'ordonnée `y`."""
    for (y0, w0, _, _), (y1, w1, _, _) in zip(HULL_SECTIONS, HULL_SECTIONS[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return (w0 + (w1 - w0) * t) * 0.86 - height * 0.05
    return 0.3


def build_fittings(builder):
    """Bancs, plancher, dames de nage, rames et mât de lanterne."""
    for y in (-0.55, 0.55, 1.15):
        width = 2 * inner_half_width(y)
        builder.box((0, y, 0.14), (width, 0.28, 0.05), WOOD_SEAT)
    for x in (-0.24, -0.08, 0.08, 0.24):
        builder.box((x, 0.1, -0.15), (0.14, 2.2, 0.03), WOOD_INSIDE[1])
    for side in (-1, 1):
        builder.box((side * 0.62, 0.1, 0.40), (0.05, 0.08, 0.08), WOOD_DARK)
        oar = Matrix.Rotation(side * 0.04, 4, 'Z')
        builder.box((side * 0.3, 0.05, 0.2), (0.05, 2.3, 0.05), rgba(0xd8b48a), rotation=oar)
        builder.box((side * 0.3 - side * 0.04, -1.05, 0.2), (0.16, 0.5, 0.02), PAINT, rotation=oar)
    builder.box((0.4, 1.36, 0.72), (0.04, 0.04, 0.62), WOOD_DARK)
    builder.box((0.4, 1.36, 1.12), (0.16, 0.16, 0.03), WOOD_DARK)


def build_lantern(collection, boat):
    """Verre de la lanterne : il brille la nuit (le jeu règle son intensité)."""
    builder = MeshBuilder()
    builder.box((0, 0, 0), (0.12, 0.12, 0.14), rgba(0xffe2a8))
    glass = builder.to_object("lantern", emissive_material("LanternGlass", 0xffe2a8, 0xffb35c, 1.0), collection, parent=boat)
    glass.location = (0.4, 1.36, 1.04)
    # Son matériau n'utilise pas de couleurs de sommets : on retire l'attribut (sinon avertissement à l'export)
    glass.data.color_attributes.remove(glass.data.color_attributes["Col"])


def build_water_mask(collection, boat):
    """Plan au niveau des plats-bords qui couvre l'intérieur de la coque (voir waterMask.ts)."""
    builder = MeshBuilder()
    left = [Vector((w * 0.9, y, MASK_HEIGHT)) for y, w, _, _ in HULL_SECTIONS]
    right = [Vector((-w * 0.9, y, MASK_HEIGHT)) for y, w, _, _ in reversed(HULL_SECTIONS)]
    face = builder.polygon(left + right, rgba(0xffffff))
    if face.normal.z < 0:
        face.normal_flip()
    mask = builder.to_object("water_mask", palette_material(), collection, parent=boat)
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
