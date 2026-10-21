"""
Skelett und Bewegungen der Menschen (aus der Universal Animation Library) und das Verzeichnis RIGS aller Figuren;
die Tiere stehen in tierbewegung.py.
"""
import os
import bpy
from rig import skelett, binden

# Quaternius Universal Animation Library (CC0), liegt nicht im Repo: Pfad zur UAL1_Standard.glb
UAL = os.environ.get("UAL_GLB", "")

# ---------- Menschen (Namen wie beim Unreal-Mannequin, links = +x) ----------
MENSCH = [("pelvis", (0, 0, 0.47), (0, 0, 0.58), None),
          ("spine_01", (0, 0, 0.58), (0, 0, 0.7), "pelvis"),
          ("spine_02", (0, 0, 0.7), (0, 0, 0.84), "spine_01"),
          ("neck_01", (0, 0, 0.84), (0, 0, 0.93), "spine_02"),
          ("head", (0, 0, 0.93), (0, 0, 1.45), "neck_01")]
for s, x in (("l", 1), ("r", -1)):
    MENSCH += [(f"upperarm_{s}", (x * 0.15, 0, 0.8), (x * 0.215, -0.025, 0.67), "spine_02"),
               (f"lowerarm_{s}", (x * 0.215, -0.025, 0.67), (x * 0.29, -0.05, 0.53), f"upperarm_{s}"),
               (f"hand_{s}", (x * 0.29, -0.05, 0.53), (x * 0.315, -0.085, 0.44), f"lowerarm_{s}"),
               (f"thigh_{s}", (x * 0.085, 0, 0.5), (x * 0.088, -0.005, 0.31), "pelvis"),
               (f"calf_{s}", (x * 0.088, -0.005, 0.31), (x * 0.09, -0.01, 0.12), f"thigh_{s}"),
               (f"foot_{s}", (x * 0.09, -0.01, 0.12), (x * 0.09, -0.12, 0.04), f"calf_{s}")]

# unser Clip -> Clip der Bibliothek; der Angriff hängt an der Klasse
MENSCH_CLIPS = {"idle": "Idle_Loop", "lauf": "Walk_Loop", "rennen": "Jog_Fwd_Loop", "treffer": "Hit_Chest",
                "jubel": "Dance_Loop", "tod": "Death01"}
SPIEGEL_ANGRIFF = ("magier",)   # Stab in der linken Hand: mit der rechten zaubern
ANGRIFF = {"krieger": "Sword_Attack", "magier": "Spell_Simple_Shoot", "priester": "Spell_Simple_Shoot"}

ROBE = ("magier", "priester")

def robe_steif(kleidung):
    """Gewand: was an den Beinen hing, hängt am Becken – die Robe schwingt als Ganzes statt Beine abzuformen"""
    beine = [g for g in kleidung.vertex_groups if g.name.startswith(("thigh", "calf", "foot"))]
    becken = kleidung.vertex_groups.get("pelvis") or kleidung.vertex_groups.new(name="pelvis")
    ids = {g.index for g in beine}
    for v in kleidung.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in ids)
        if w:
            becken.add([v.index], w, "ADD")
    for g in beine:
        kleidung.vertex_groups.remove(g)

def rigge_mensch(root):
    from retarget import lade_quelle, uebertrage
    if not os.path.isfile(UAL):
        raise SystemExit("UAL_GLB muss auf UAL1_Standard.glb der Universal Animation Library zeigen")
    arm = skelett(root, MENSCH)
    starr = {o.name: "head" for o in root.children_recursive if o.name.startswith(("bart", "kinnbart", "mähne"))}
    binden(root, arm, starr)
    klasse = root.name.split("_")[1]
    if klasse in ROBE:
        robe_steif(bpy.data.objects["kleidung"])
    quelle = lade_quelle(UAL)
    for name, q in {**MENSCH_CLIPS, "angriff": ANGRIFF.get(klasse, "Punch_Cross")}.items():
        uebertrage(arm, quelle, q, name, auf_der_stelle=name in ("idle", "lauf", "rennen"), spiegeln=(name == "angriff" and klasse in SPIEGEL_ANGRIFF))

from menschen import MENSCHEN
from tierbewegung import TIER_RIGS
RIGS = {**TIER_RIGS, **{n: rigge_mensch for n in MENSCHEN}}
