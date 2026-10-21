"""
Baut die Avatare (Menschen und Tiere) und legt sie als Draco-komprimierte .glb ab.

Aufruf (vom Repo-Wurzelordner):
  blender -b --factory-startup --python scripts/avatare/baue.py -- frontend/public/modelle/avatare [name ...]
Ohne Namen werden alle gebaut. Namen: mensch_<klasse>_<m|w>, tier_<id>.
Die Menschen-Bewegungen kommen aus Quaternius' Universal Animation Library (CC0, nicht im Repo):
UAL_GLB muss auf deren UAL1_Standard.glb zeigen (Unreal-Godot-Ordner der Standard-Ausgabe).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from basis import leeren, export
from menschen import MENSCHEN
from bewegung import RIGS
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
        if name in RIGS:
            RIGS[name](root)
        export(root, os.path.join(ziel, name + ".glb"))
        print("FERTIG", name)
