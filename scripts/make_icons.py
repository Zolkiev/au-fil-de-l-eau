"""Icônes d’Au fil de l’eau (onglet, écran d'accueil, application installée).

Dessine l'icône en SVG (un bouchon qui flotte au coucher du soleil), puis la
convertit en PNG avec `sips` (fourni avec macOS, aucune dépendance) :

- assets/icons/icon.svg           : coins arrondis (onglet du navigateur)
- assets/icons/icon-192.png, -512 : coins arrondis (« any » du manifeste)
- assets/icons/icon-maskable-512  : pleine page, le dessin tient dans le
                                    cercle central (Android découpe autour)
- assets/icons/apple-touch-icon   : pleine page, 180 px (iPhone, iPad)

Usage : python3 scripts/make_icons.py
"""

import subprocess
import tempfile
from pathlib import Path

ICONS = Path(__file__).resolve().parent.parent / "assets" / "icons"
SIZE = 512

DEFS = """
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f9dcc0"/>
    <stop offset="1" stop-color="#f1b9a6"/>
  </linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#78cbc2"/>
    <stop offset="1" stop-color="#3f8f9a"/>
  </linearGradient>
"""

# Ciel, soleil, collines low poly, eau à facettes
BACKGROUND = """
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="356" cy="190" r="58" fill="#fff3dc" opacity="0.9"/>
  <polygon points="0,300 0,236 64,252 128,214 188,258 236,240 300,262 372,226 440,250 512,232 512,300" fill="#9cc39a"/>
  <polygon points="128,214 188,258 150,300 96,300" fill="#88b38b"/>
  <polygon points="372,226 440,250 420,300 340,300" fill="#88b38b"/>
  <rect y="292" width="512" height="220" fill="url(#water)"/>
  <polygon points="0,292 150,292 40,420 0,400" fill="#ffffff" opacity="0.06"/>
  <polygon points="360,292 512,292 512,380 450,512 400,512" fill="#1f5f6a" opacity="0.08"/>
"""

# Le bouchon : antenne, moitié rouge, moitié blanche, bague sombre
BOBBER = """
  <path d="M256,164 Q300,70 512,-8" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.8"/>
  <rect x="249" y="160" width="14" height="84" rx="7" fill="#3d4a52"/>
  <circle cx="256" cy="164" r="12" fill="#e3875a"/>
  <circle cx="256" cy="300" r="66" fill="#f7f1e6"/>
  <path d="M190,300 A66,66 0 0 1 322,300 Z" fill="#e0574a"/>
  <path d="M212,258 A50,50 0 0 1 250,240" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" opacity="0.45"/>
  <rect x="190" y="293" width="132" height="14" fill="#3d4a52"/>
"""

# La ligne d'eau recouvre le bas du bouchon ; des ronds s'éloignent
WATERLINE = """
  <rect y="326" width="512" height="186" fill="url(#water)" opacity="0.82"/>
  <ellipse cx="256" cy="328" rx="104" ry="17" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.75"/>
  <ellipse cx="256" cy="332" rx="164" ry="29" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.45"/>
  <ellipse cx="256" cy="336" rx="222" ry="42" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.25"/>
"""


def svg(rounded: bool) -> str:
    """Icône complète ; `rounded` : coins arrondis et transparents autour."""
    art = BACKGROUND + BOBBER + WATERLINE
    clip = '<clipPath id="round"><rect width="512" height="512" rx="112"/></clipPath>' if rounded else ""
    body = f'<g clip-path="url(#round)">{art}</g>' if rounded else art
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">'
        f"<defs>{DEFS}{clip}</defs>{body}</svg>\n"
    )


def to_png(source: Path, target: Path, size: int) -> None:
    subprocess.run(
        ["sips", "-s", "format", "png", "-z", str(size), str(size), str(source), "--out", str(target)],
        check=True,
        capture_output=True,
    )


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    rounded = ICONS / "icon.svg"
    rounded.write_text(svg(rounded=True), encoding="utf-8")
    to_png(rounded, ICONS / "icon-192.png", 192)
    to_png(rounded, ICONS / "icon-512.png", 512)
    with tempfile.TemporaryDirectory() as temp:
        full = Path(temp) / "icon-full.svg"
        full.write_text(svg(rounded=False), encoding="utf-8")
        to_png(full, ICONS / "icon-maskable-512.png", 512)
        to_png(full, ICONS / "apple-touch-icon.png", 180)
    print("Icônes écrites dans", ICONS)


if __name__ == "__main__":
    main()
