"""Petite végétation et galets du bord de l'eau : touffes d'herbe, fleurs,
buissons, galets.

Tout est posé sur le vrai maillage du terrain (Ground), avec son propre
tirage aléatoire : ajouter ou retoucher cette flore ne déplace ni les arbres
ni les rochers des niveaux. Chaque sorte est un seul objet (peu coûteux à
dessiner) ; l'herbe et les fleurs finissent par `_sway` (elles ondulent au
vent dans le jeu).
"""

import math
import random

from mathutils import Matrix, Vector

from .common import MeshBuilder, rgba

GRASS_TUFT = [rgba(0x6f9e4f), rgba(0x86b35a), rgba(0x5d8a45), rgba(0x93b865)]
STEM = rgba(0x5d8a45)
FLOWERS = [rgba(0xf6f1e4), rgba(0xf2d15a), rgba(0xe89bb8), rgba(0xb89ae0), rgba(0xf4a261)]
BUSH = [rgba(0x4f8a55), rgba(0x5f9a5a), rgba(0x6aa35e)]
PEBBLE = [rgba(0xb9b3a6), rgba(0xa39d91), rgba(0xcbc4b5), rgba(0x8f8a80)]

# Essais par élément avant d'abandonner (zones étroites)
ATTEMPTS = 40


class Spot:
    """Règle de placement d'une sorte : combien, et où (`where(x, y)` → vrai si le point convient)."""

    def __init__(self, count, where):
        self.count = count
        self.where = where


def build_flora(collection, material, ground, seed, half_size, spots):
    """
    Sème la flore dans le carré de demi-côté `half_size` (m), ou le rectangle
    de demi-côtés `half_size = (x, y)`. `spots` associe
    chaque sorte ("grass", "flowers", "bushes", "pebbles") à sa règle (Spot) ;
    une sorte absente n'est pas semée. L'herbe et les fleurs poussent par
    taches : `count` est alors le nombre de taches.
    """
    rng = random.Random(seed)
    half_x, half_y = half_size if isinstance(half_size, tuple) else (half_size, half_size)
    makers = {"grass": (add_grass_patch, "deco_grass_sway"), "flowers": (add_flower_patch, "deco_flowers_sway"),
              "bushes": (add_bush, "deco_bushes"), "pebbles": (add_pebble, "deco_pebbles")}
    for kind, spot in spots.items():
        add, name = makers[kind]
        builder = MeshBuilder()
        for _ in range(spot.count):
            point = pick_point(rng, half_x, half_y, spot.where)
            if point:
                add(builder, rng, ground, *point, spot.where)
        builder.to_object(name, material, collection)


def pick_point(rng, half_x, half_y, where):
    for _ in range(ATTEMPTS):
        x, y = rng.uniform(-half_x, half_x), rng.uniform(-half_y, half_y)
        if where(x, y):
            return x, y
    return None


def around(rng, x, y, radius, count, where):
    """Points d'une tache autour de (x, y), qui respectent tous la règle `where`."""
    points = []
    for _ in range(count):
        angle, distance = rng.uniform(0, 2 * math.pi), radius * math.sqrt(rng.random())
        px, py = x + math.cos(angle) * distance, y + math.sin(angle) * distance
        if where(px, py):
            points.append((px, py))
    return points


def add_grass_patch(builder, rng, ground, x, y, where):
    """Tache de 3 à 8 touffes."""
    for px, py in around(rng, x, y, 1.2, rng.randint(3, 8), where):
        add_tuft(builder, rng, ground, px, py)


def add_tuft(builder, rng, ground, x, y):
    """Touffe de 3 à 5 brins (pyramides fines à 3 faces), un peu écartés."""
    base = ground.lowest_under(x, y, 0.12) - rng.uniform(0.03, 0.05)
    color = rng.choice(GRASS_TUFT)
    for _ in range(rng.randint(3, 5)):
        height = rng.uniform(0.3, 0.6)
        lean = Matrix.Rotation(rng.uniform(0, 2 * math.pi), 4, 'Z') @ Matrix.Rotation(rng.uniform(0.1, 0.45), 4, 'X')
        foot = Vector((x + rng.uniform(-0.07, 0.07), y + rng.uniform(-0.07, 0.07), base))
        builder.spike(foot, foot + lean @ Vector((0, 0, height)), 0.035, color)


def add_flower_patch(builder, rng, ground, x, y, where):
    """Massif de 5 à 12 fleurs, le plus souvent d'une seule couleur."""
    color = rng.choice(FLOWERS)
    for px, py in around(rng, x, y, 0.9, rng.randint(5, 12), where):
        add_flower(builder, rng, ground, px, py, color if rng.random() < 0.8 else rng.choice(FLOWERS))


def add_flower(builder, rng, ground, x, y, color):
    """Tige fine et corolle à 5 pétales (pyramide aplatie), un peu penchée."""
    base = ground.lowest_under(x, y, 0.03) - rng.uniform(0.02, 0.04)
    height = rng.uniform(0.3, 0.5)
    foot = Vector((x, y, base))
    builder.spike(foot, foot + Vector((0, 0, height + 0.01)), 0.014, STEM)
    # Corolle penchée, chacune à sa façon (deux fleurs voisines n'ont jamais de faces confondues)
    tilt = Matrix.Rotation(rng.uniform(0, math.pi), 4, 'Z') @ Matrix.Rotation(rng.uniform(0.05, 0.3), 4, 'X')
    builder.cone((x, y, base + height + 0.012), rng.uniform(0.08, 0.12), 0.0, 0.035, 5, color, rotation=tilt)


def add_bush(builder, rng, ground, x, y, _where=None):
    """Buisson : une grosse boule à facettes et parfois une plus petite à côté."""
    radius = rng.uniform(0.6, 1.1)
    color = rng.choice(BUSH)
    spin = Matrix.Rotation(rng.uniform(0, 2 * math.pi), 4, 'Z')
    base = ground.lowest_under(x, y, radius) - 0.05
    builder.blob((x, y, base + 0.4 * radius), radius, color, scale=(1.0, 1.0, 0.75), jitter=0.15, rng=rng, rotation=spin)
    if rng.random() < 0.5:
        side = spin @ Vector((radius * 0.9, 0, 0))
        small = radius * 0.6
        low = ground.lowest_under(x + side.x, y + side.y, small) - 0.05
        builder.blob((x + side.x, y + side.y, low + 0.4 * small), small, color, scale=(1.0, 1.0, 0.75), jitter=0.15, rng=rng, rotation=spin)


def add_pebble(builder, rng, ground, x, y, _where=None):
    """Galet aplati, à moitié enfoncé."""
    radius = rng.uniform(0.07, 0.18)
    base = ground.lowest_under(x, y, radius)
    builder.blob((x, y, base + 0.1 * radius), radius, rng.choice(PEBBLE), scale=(1.2, 1.0, 0.5), jitter=0.2, rng=rng,
                 rotation=Matrix.Rotation(rng.uniform(0, 2 * math.pi), 4, 'Z'))


def far_from(point_radius_pairs):
    """Règle « loin des constructions » : vrai si (x, y) est hors de tous les cercles (centre, rayon)."""
    def check(x, y):
        return all((Vector((x, y)) - Vector(center)).length > radius for center, radius in point_radius_pairs)
    return check
