"""
Baut die Avatare (Menschen und Tiere) und legt sie als Draco-komprimierte .glb ab.

Aufruf (vom Repo-Wurzelordner):
  blender -b --factory-startup --python scripts/avatare/baue.py -- frontend/public/modelle/avatare [name ...]
Ohne Namen werden alle gebaut. Namen: mensch_<klasse>_<m|w>, tier_<id>.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from basis import leeren, export
from menschen import MENSCHEN
try:
    from tiere import TIERE
except ImportError:
    TIERE = {}

ALLE = {**MENSCHEN, **TIERE}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    ziel, namen = argv[0], argv[1:] or list(ALLE)
    os.makedirs(ziel, exist_ok=True)
    for name in namen:
        leeren()
        root = ALLE[name]()
        export(root, os.path.join(ziel, name + ".glb"))
        print("FERTIG", name)
