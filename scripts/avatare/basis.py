"""
Bausteine für die Avatare im Pokémon/Palworld-Stil (Blender, headless).

Körper: überlappende Grundformen (Kugeln, Ellipsoide, Kapseln mit echten Maßen), per Voxel-Remesh
verschmolzen und geglättet, gefärbt per Vertexfarbe nach Regeln. Ohren, Schnäbel, Hüte, Augen sind
eigene, geglättete Teile. Menschen bekommen ein gemaltes Anime-Gesicht als Textur.

Blender ist Z-oben, vorn = -Y; der glTF-Export macht daraus Y-oben, vorn = +Z wie bei den bisherigen
Avataren. Materialnamen sind Rollen für die App (Haut wird zur Laufzeit umgefärbt, Glanz bleibt hell,
Gesicht ist transparent, Auge/Iris ohne Umriss).
"""
import bpy, bmesh, math
from mathutils import Vector, Quaternion, Matrix

# ---------- Farben ----------
def lin(c):  # sRGB-Kanal -> linear
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rgb(hexwert):
    return tuple(lin(((hexwert >> s) & 255) / 255) for s in (16, 8, 0))

def lin_farbe(c):
    return c if isinstance(c, tuple) else rgb(c)

def misch(a, b, t):
    """Farbe a → b, t 0..1 (wird begrenzt)"""
    t = max(0.0, min(1.0, t))
    a, b = lin_farbe(a), lin_farbe(b)
    return tuple(x + (y - x) * t for x, y in zip(a, b))

def stufe(x, a, b):
    """weicher Übergang 0 → 1 zwischen a und b (smoothstep)"""
    if a == b:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def flecken(co, dichte=6.0, seed=0.0):
    """weiches Fleckenmuster 0..1 (Summe versetzter Sinuswellen, für Kuh, Giraffe ...)"""
    x, y, z = co.x * dichte + seed, co.y * dichte - seed * 0.7, co.z * dichte + seed * 1.3
    w = math.sin(x * 1.3 + math.sin(z * 0.9)) + math.sin(y * 1.7 + math.cos(x * 1.1)) + math.sin(z * 1.5 + math.sin(y * 1.2))
    return stufe(w, 0.9, 1.3)

# ---------- Szene ----------
def leeren():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()

MATS = {}
def material(name, hexwert=0xffffff, rau=0.55, metall=0.0, leucht=0.0, vertex=False, alpha=1.0):
    """Materialname ist zugleich die Rolle für die App (Haut, Auge, Glanz, ...)."""
    key = (name, hexwert, vertex, rau, metall, leucht, alpha)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get("Principled BSDF") or nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*rgb(hexwert), 1)
    bsdf.inputs["Roughness"].default_value = rau
    bsdf.inputs["Metallic"].default_value = metall
    if leucht:
        bsdf.inputs["Emission Color"].default_value = (*rgb(hexwert), 1)
        bsdf.inputs["Emission Strength"].default_value = leucht
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED"
    if vertex:
        vc = nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Farbe"
        links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    MATS[key] = m
    return m

def verlinken(obj, eltern=None):
    bpy.context.scene.collection.objects.link(obj)
    if eltern:
        obj.parent = eltern
    return obj

def aktiv(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

def richtung_q(n, vorn=Vector((0, -1, 0))):
    """Drehung, die die lokale Vorderseite (-Y) auf n legt"""
    return vorn.rotation_difference(Vector(n).normalized())

def wurzel(name):
    return verlinken(bpy.data.objects.new(name, None))

def export(root, pfad):
    for o in bpy.context.view_layer.objects:
        o.select_set(o == root or o in root.children_recursive)
    bpy.ops.export_scene.gltf(filepath=pfad, export_format="GLB", use_selection=True, export_apply=True,
                              export_animation_mode="NLA_TRACKS",
                              export_yup=True, export_vertex_color="ACTIVE",
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)

# ---------- Körper aus verschmolzenen Grundformen ----------
class Blob:
    """Sammelt Kugeln, Ellipsoide und (spitz zulaufende) Kapseln mit echten Maßen."""
    def __init__(self):
        self.teile = []  # (art, matrix, maße)
    def kugel(self, co, r):
        self.teile.append(("kugel", Matrix.Translation(Vector(co)), r)); return self
    def ellipse(self, co, r, groesse, drehung=None):
        m = Matrix.Translation(Vector(co)) @ (drehung or Quaternion()).to_matrix().to_4x4() @ Matrix.Diagonal((*groesse, 1))
        self.teile.append(("kugel", m, r)); return self
    def kapsel(self, a, b, r, r2=None):
        a, b = Vector(a), Vector(b)
        achse = b - a
        q = Vector((0, 0, 1)).rotation_difference(achse.normalized())
        m = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
        self.teile.append(("kapsel", m, (r, r if r2 is None else r2, achse.length)))
        return self
    def stumpf(self, a, b, r1, r2):
        """Kegelstumpf mit flachen Enden (gerader Saum einer Robe)"""
        a, b = Vector(a), Vector(b)
        achse = b - a
        q = Vector((0, 0, 1)).rotation_difference(achse.normalized())
        self.teile.append(("stumpf", Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), (r1, r2, achse.length)))
        return self
    def kette(self, punkte, radien):
        for i, (p, r) in enumerate(zip(punkte, radien)):
            self.kugel(p, r)
            if i:  # Glieder verbinden
                self.kapsel(punkte[i - 1], p, radien[i - 1] * 0.8, r * 0.8)
        return self

def blob_mesh(name, blob, faerben=None, mat=None, voxel=0.011, glatt=12, ziel_flaechen=7000, eltern=None):
    """faerben(co, normal) -> Farbe je Ecke (Vertexfarbe) – oder ein festes Material `mat` (z. B. Haut)"""
    bm = bmesh.new()
    for art, m, mass in blob.teile:
        if art == "kugel":
            bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=mass, matrix=m)
        elif art == "stumpf":
            r1, r2, laenge = mass
            bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=r1, radius2=r2, depth=laenge, matrix=m)
        else:
            r1, r2, laenge = mass
            bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=r1, radius2=r2, depth=laenge, matrix=m)
            bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=r1, matrix=m @ Matrix.Translation((0, 0, -laenge / 2)))
            bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=r2, matrix=m @ Matrix.Translation((0, 0, laenge / 2)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    obj = verlinken(bpy.data.objects.new(name, me))
    aktiv(obj)
    for typ, einst in (("REMESH", {"mode": "VOXEL", "voxel_size": voxel}), ("SMOOTH", {"factor": 0.7, "iterations": glatt})):
        mod = obj.modifiers.new(typ.lower(), typ)
        for k, w in einst.items():
            setattr(mod, k, w)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    n = len(obj.data.polygons)
    if n > ziel_flaechen:
        mod = obj.modifiers.new("dez", "DECIMATE")
        mod.ratio = ziel_flaechen / n
        bpy.ops.object.modifier_apply(modifier=mod.name)
    me = obj.data
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    if faerben:
        attr = me.color_attributes.new("Farbe", "FLOAT_COLOR", "POINT")
        for v in me.vertices:
            attr.data[v.index].color = (*lin_farbe(faerben(v.co, v.normal)), 1)
        me.materials.append(material("Koerper", vertex=True))
    else:
        me.materials.append(mat)
    if eltern:
        obj.parent = eltern
    return obj

# ---------- Einzelteile ----------
def glaetten(obj, stufe_=2):
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    if stufe_:
        obj.modifiers.new("glatt", "SUBSURF").levels = stufe_

def kugel(name, co, r, mat, groesse=(1, 1, 1), drehung=None, segmente=24, eltern=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segmente, v_segments=segmente // 2, radius=r)
    bm.to_mesh(me); bm.free()
    obj = verlinken(bpy.data.objects.new(name, me), eltern)
    obj.location, obj.scale = co, groesse
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = drehung or Quaternion()
    me.materials.append(mat)
    glaetten(obj, 0)
    return obj

def kegel(name, fuss, r, h, richtung, mat, biegung=(0, 0), segmente=10, spitze=0.0, flach=1.0, stufe_=2, eltern=None, farbe_nach_hoehe=None, drall=0.0, vorn=None):
    """Kegel vom Fuß in Richtung `richtung`; biegung krümmt die Spitze (lokal x, y), flach staucht quer (lokal y),
    drall verdreht (Einhorn). `vorn`: Weltrichtung, in die die flache Seite (lokal -y) zeigen soll (Ohren)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segmente, radius1=r, radius2=spitze, depth=h)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > h * 0.5], cuts=6, use_grid_fill=True)
    for v in bm.verts:
        v.co.z += h / 2
        t = max(0.0, v.co.z / h)
        if drall:
            w = drall * t
            x, y = v.co.x, v.co.y
            v.co.x, v.co.y = x * math.cos(w) - y * math.sin(w), x * math.sin(w) + y * math.cos(w)
        v.co.x += biegung[0] * t * t
        v.co.y = v.co.y * flach + biegung[1] * t * t
    bm.to_mesh(me); bm.free()
    obj = verlinken(bpy.data.objects.new(name, me), eltern)
    obj.location = fuss
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = ausrichtung(richtung, vorn)
    me.materials.append(mat)
    if farbe_nach_hoehe:  # z. B. dunkle Ohrspitze
        me.materials.append(farbe_nach_hoehe[1])
        for p in me.polygons:
            z = sum(me.vertices[i].co.z for i in p.vertices) / len(p.vertices)
            p.material_index = 1 if z > h * farbe_nach_hoehe[0] else 0
    glaetten(obj, stufe_)
    return obj

def ausrichtung(richtung, vorn=None):
    """Drehung: lokal z → richtung; mit `vorn` zeigt lokal -y dorthin (sonst beliebiger Drall)"""
    z = Vector(richtung).normalized()
    if vorn is None:
        return Vector((0, 0, 1)).rotation_difference(z)
    y = -(Vector(vorn) - z * Vector(vorn).dot(z)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_quaternion()

def ohr(name, fuss, r, h, richtung, aussen, innen, eltern, flach=0.45, biegung=(0, 0.03), spitze_farbe=None, vorn=Vector((0, -1, 0))):
    """Spitzes Ohr: flach nach vorn, Innenohr kleiner und davor (Fuchs, Katze, Tiger)"""
    q = ausrichtung(richtung, vorn)
    front = q @ Vector((0, -1, 0))
    kegel(name, fuss, r, h, richtung, aussen, biegung=biegung, flach=flach, vorn=vorn, eltern=eltern,
          farbe_nach_hoehe=(0.62, spitze_farbe) if spitze_farbe else None)
    if innen:
        kegel(name + "_innen", Vector(fuss) + front * r * flach * 0.55 + Vector(richtung).normalized() * h * 0.06, r * 0.6, h * 0.66, richtung, innen,
              biegung=biegung, flach=flach * 0.5, vorn=vorn, eltern=eltern)

def stab(name, a, b, r, mat, eltern=None):
    """Zylinder von a nach b (Stab, Bein, Fühler)"""
    a, b = Vector(a), Vector(b)
    return kegel(name, a, r, (b - a).length, b - a, mat, spitze=r, stufe_=0, segmente=12, eltern=eltern)

def bogen(name, punkte, dicke, mat, eltern=None):
    """Dünner Schlauch entlang von Punkten (Mund, Schnurrhaare), als Mesh"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = dicke
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(punkte) - 1)
    for p, q in zip(sp.points, punkte):
        p.co = (*q, 1)
    obj = verlinken(bpy.data.objects.new(name, cu))
    aktiv(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    obj.data.materials.append(mat)
    glaetten(obj, 0)
    if eltern:
        obj.parent = eltern
    return obj

def auf_kopf(mitte, r, gier, nick, tief=0.97):
    """Punkt und Normale auf einer Kopfkugel: gier = seitlich (0 = vorn, + = links vom Betrachter rechts), nick = Höhe"""
    n = Vector((math.sin(gier) * math.cos(nick), -math.cos(gier) * math.cos(nick), math.sin(nick)))
    return Vector(mitte) + n * r * tief, n

def auf_ellipse(c, r, groesse, gier, dz):
    """Punkt und Normale auf einem Ellipsoid (Mitte c, Radius r, Achsfaktoren groesse) in Höhe c.z + dz, seitlich gier (0 = vorn)"""
    rx, ry, rz = r * groesse[0], r * groesse[1], r * groesse[2]
    k = math.sqrt(max(0.0, 1 - (dz / rz) ** 2))
    p = Vector((c[0] + rx * k * math.sin(gier), c[1] - ry * k * math.cos(gier), c[2] + dz))
    n = Vector(((p.x - c[0]) / rx ** 2, (p.y - c[1]) / ry ** 2, (p.z - c[2]) / rz ** 2)).normalized()
    return p, n

def mund_ellipse(name, c, r, groesse, dz, breite, durchhang, eltern, farbe=0x5a2030, dicke=0.012, zaehne=0, zahn_laenge=0.05):
    """Mund als Bogen genau auf einem Ellipsoid (Schnauze, breiter Froschkopf); optional Zähne am Oberkiefer"""
    pkt = []
    for i in range(13):
        t = i / 12 - 0.5
        p, n = auf_ellipse(c, r * 1.01, groesse, t * breite, dz - (1 - (2 * t) ** 2) * durchhang)
        pkt.append(tuple(p))
    bogen(name, pkt, dicke, material("Mund", farbe, rau=0.5), eltern)
    for k in range(zaehne):   # gleichmäßig verteilt, die Ecken frei
        t = (k + 0.5) / zaehne * 0.8 + 0.1
        p, n = auf_ellipse(c, r * 1.005, groesse, (t - 0.5) * breite, dz - (1 - (2 * t - 1) ** 2) * durchhang)
        kegel(f"{name}_zahn{k}", p + Vector((0, 0, 0.004)), zahn_laenge * 0.32, zahn_laenge, Vector((n.x * 0.3, n.y * 0.3, -1)), material("Zahn", 0xfbfbf5, rau=0.3), stufe_=0, segmente=6, eltern=eltern)

# ---------- Tiergesicht: glänzende 3D-Augen, Wangen, Mund ----------
def auge(name, mitte, r_kopf, gier, nick, groesse, iris=None, eltern=None, hoch=1.3):
    p, n = auf_kopf(mitte, r_kopf, gier, nick)
    q = richtung_q(n)
    kugel(name, p, groesse, material("Auge", 0x14121c, rau=0.15), groesse=(1, 0.35, hoch), drehung=q, eltern=eltern)
    if iris is not None:
        kugel(name + "_iris", p + n * groesse * 0.26 + Vector((0, 0, -groesse * 0.2)), groesse * 0.6, material("Iris", iris, rau=0.2, leucht=0.3), groesse=(1, 0.3, 1.15), drehung=q, eltern=eltern)
    seite = -1 if gier > 0 else 1
    rechts, hoch_v = q @ Vector((1, 0, 0)), q @ Vector((0, 0, 1))
    glanz = material("Glanz", 0xffffff, leucht=2.0)
    kugel(name + "_glanz", p + n * groesse * 0.3 + hoch_v * groesse * 0.45 + rechts * seite * groesse * 0.25, groesse * 0.3, glanz, drehung=q, eltern=eltern)
    kugel(name + "_glanz2", p + n * groesse * 0.3 - hoch_v * groesse * 0.4 - rechts * seite * groesse * 0.2, groesse * 0.13, glanz, drehung=q, eltern=eltern)
    return p, n

def augen(kopf, r, gier, nick, groesse, eltern, iris=None, hoch=1.3):
    for s in (-1, 1):
        auge(f"auge{s}", kopf, r, s * gier, nick, groesse, iris=iris, eltern=eltern, hoch=hoch)

def wangen(kopf, r, gier, nick, eltern, farbe=0xff8a9a, groesse=0.05):
    for s in (-1, 1):
        p, n = auf_kopf(kopf, r, s * gier, nick)
        kugel(f"wange{s}", p, groesse, material("Wange", farbe, rau=0.8), groesse=(1, 0.3, 0.7), drehung=richtung_q(n), eltern=eltern)

def laecheln(name, mitte, r, breite, nick, eltern, farbe=0x5a2030, tiefe=0.12, dicke=0.012):
    pkt = []
    for i in range(9):
        t = i / 8 - 0.5
        p, _ = auf_kopf(mitte, r, t * breite, nick - (1 - (2 * t) ** 2) * tiefe, tief=1.0)
        pkt.append(tuple(p))
    return bogen(name, pkt, dicke, material("Mund", farbe, rau=0.5), eltern)

def nase(kopf_punkt, eltern, farbe=0x2a1a14, r=0.035, groesse=(1.3, 1, 0.9)):
    return kugel("nase", kopf_punkt, r, material("Nase", farbe, rau=0.2), groesse=groesse, eltern=eltern)

def schnurrhaare(mitte, r, nick, eltern, farbe=0x3a2a2a, laenge=0.2):
    for s in (-1, 1):
        for k, dz in enumerate((-0.02, 0.02)):
            p, n = auf_kopf(mitte, r, s * 0.35, nick, tief=0.98)
            ende = p + Vector((s * laenge, -0.02, dz * 2.5))
            bogen(f"bart{s}{k}", [tuple(p + Vector((0, 0, dz))), tuple(ende)], 0.005, material("Bart", farbe), eltern)

def stacheln(name, mitte, r, eltern, mat, reihen=4, je_reihe=7, laenge=0.16, dicke=0.05, von=-0.2, bis=1.05):
    """Stacheln auf der Rückseite einer Kugel (Igel, Kugelfisch)"""
    for j in range(reihen):
        e = von + (bis - von) * j / max(1, reihen - 1)
        for i in range(je_reihe):
            a = math.pi * (0.65 + 0.7 * (i + (j % 2) * 0.5) / je_reihe)
            n = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
            kegel(f"{name}{j}_{i}", Vector(mitte) + n * r * 0.92, dicke, laenge, n, mat, segmente=6, stufe_=1, eltern=eltern)

# ---------- Menschengesicht: gemalte Anime-Textur auf einem Kugelstück ----------
G_LON, G_LAT = (-62.0, 62.0), (-42.0, 30.0)   # Ausschnitt in Grad (seitlich, Höhe)

# Stilwerte je Form: Augen (Breite/Höhe in Grad, Lidbogen, Neigung außen), Iris, Glanz, Brauen, Mund, Röte
STIL = {
    "w": dict(auge_b=11.0, auge_h=15.0, auge_y=-2.0, lid_bogen=0.2, lid_hoch=0.8, lid_neig=0.0, lid_dick=0.11, fluegel=True,
              iris_b=8.2, iris_h=12.5, glanz=(2.9, 3.8, 1.3), braue_y=20.5, braue_bogen=2.2, braue_dick=0.95, braue_innen=-0.8,
              mund="offen", roete=0.4),
    "m": dict(auge_b=9.6, auge_h=10.8, auge_y=-3.5, lid_bogen=0.06, lid_hoch=0.8, lid_neig=0.03, lid_dick=0.15, fluegel=False,
              iris_b=6.3, iris_h=8.2, glanz=(1.8, 2.2, 0.8), braue_y=13.8, braue_bogen=0.6, braue_dick=1.6, braue_innen=1.3,
              mund="breit", roete=0.12),
}

def gesicht_textur(name, iris_hell, iris_dunkel, braue, form="w", aufl=512):
    """Malt Augen, Brauen, Mund, Nase, Wangenröte in Grad-Koordinaten des Kopfausschnitts (Stil je Form).
    Die Haut selbst bleibt durchsichtig (wird zur Laufzeit gefärbt)."""
    st = STIL[form]
    W = H = aufl
    px = [0.0] * (W * H * 4)
    ih, idk, br = rgb(iris_hell), rgb(iris_dunkel), rgb(braue)
    lid = rgb(0x231626); weiss = rgb(0xfbfbff); mund = rgb(0x8a2a3a); zunge = rgb(0xf07a8a); rot = rgb(0xff7c96)
    schatten = rgb(0x5a3a30); lippe = rgb(0x5e3030)

    def ueber(i, farbe, a):
        if a <= 0: return
        a = min(1.0, a)
        r, g, b, aa = px[i:i + 4]
        na = a + aa * (1 - a)
        if na <= 0: return
        px[i] = (farbe[0] * a + r * aa * (1 - a)) / na
        px[i + 1] = (farbe[1] * a + g * aa * (1 - a)) / na
        px[i + 2] = (farbe[2] * a + b * aa * (1 - a)) / na
        px[i + 3] = na

    def kante(d, weich=0.08):
        return max(0.0, min(1.0, (1 - d) / weich + 0.5))

    AUGEN = ((-20.0, st["auge_y"], -1), (20.0, st["auge_y"], 1))
    gb, gh, gk = st["glanz"]
    for y in range(H):
        lat = G_LAT[0] + (y + 0.5) / H * (G_LAT[1] - G_LAT[0])
        for x in range(W):
            lon = G_LON[0] + (x + 0.5) / W * (G_LON[1] - G_LON[0])
            i = (y * W + x) * 4
            for s in (-1, 1):  # Wangenröte
                d = ((lon - s * 27) / 7) ** 2 + ((lat + 12) / 3.4) ** 2
                if d < 1.6: ueber(i, rot, st["roete"] * math.exp(-d * 1.6))
            if st["mund"] == "offen":
                d = (lon / 1.1) ** 2 + ((lat + 13) / 0.8) ** 2   # Nase: zarter Schattenpunkt
                if d < 1.5: ueber(i, schatten, 0.35 * kante(d, 0.4))
                if abs(lon) < 6.0 and -29.5 < lat < -22:        # Mund: kleines offenes D mit Zunge
                    oben = -23.0 + 0.3 * (lon / 5.4) ** 2
                    unten = -23.2 - 4.4 * math.sqrt(max(0.0, 1 - (lon / 5.4) ** 2))
                    if unten < lat < oben:
                        ueber(i, zunge if lat < unten + 1.8 and abs(lon) < 3.2 else mund, 1.0)
                    if abs(lat - oben) < 0.5 and abs(lon) < 5.8:
                        ueber(i, lid, 0.9)
            else:
                if 0 < lon < 1.0 and -14.5 < lat < -9.5:          # Nase: kurzer Schattenstrich an der Seite
                    ueber(i, schatten, 0.4 * (1 - abs(lat + 12) / 2.5))
                if abs(lon) < 10.8:                              # Mund: breites, offenes Grinsen mit oberer Zahnreihe
                    oben = -23.2 + 1.4 * (lon / 10.0) ** 2
                    unten = oben - 4.8 * math.sqrt(max(0.0, 1 - (lon / 10.0) ** 2))
                    if unten < lat < oben:
                        ueber(i, weiss if lat > oben - 1.5 and abs(lon) < 8.0 else rgb(0x3a1a1a), 1.0)
                    if abs(lat - oben) < 0.5 or (abs(lat - unten) < 0.45 and abs(lon) < 9.4):
                        ueber(i, lippe, 0.95)
            for s in (-1, 1):  # Brauen
                ex = (lon - s * 20) / 9.5
                if abs(ex) < 1:
                    innen = -s * ex   # > 0 zur Gesichtsmitte hin
                    bogen_y = st["braue_y"] + st["braue_bogen"] * (1 - ex * ex) - st["braue_innen"] * innen
                    if abs(lat - bogen_y) < st["braue_dick"] * (1 - 0.35 * abs(ex)): ueber(i, br, 0.95)
            for cx, cy, s in AUGEN:
                ex, ey = (lon - cx) / st["auge_b"], (lat - cy) / st["auge_h"]
                if abs(ex) > 1.45 or abs(ey) > 1.4: continue
                aussen = 1.0 if ex * s > 0 else 0.0
                deckel = st["lid_hoch"] - st["lid_bogen"] * ex * ex - st["lid_neig"] * ex * s
                if ey < deckel:
                    d = ex * ex + ey * ey
                    if d < 1.0: ueber(i, weiss, kante(d, 0.06))
                    ix, iy = (lon - cx) / st["iris_b"], (lat - (cy - 1.0)) / st["iris_h"]
                    di = ix * ix + iy * iy
                    if di < 1.0:
                        t = max(0.0, min(1.0, 0.5 - iy * 0.6))
                        c = tuple(a_ + (b_ - a_) * t for a_, b_ in zip(idk, ih))
                        if di > 0.72: c = tuple(v * 0.55 for v in c)
                        ueber(i, c, kante(di, 0.05))
                        dp = ((lon - cx) / (st["iris_b"] * 0.42)) ** 2 + ((lat - (cy + 0.5)) / (st["iris_h"] * 0.45)) ** 2
                        if dp < 1.0: ueber(i, tuple(v * 0.35 for v in idk), kante(dp, 0.1))
                    for gx, gy, rx, ry in ((-3.0 * s, st["iris_h"] * 0.4, gb, gh), (2.8 * s, -st["iris_h"] * 0.5, gk, gk)):
                        dg = ((lon - cx - gx) / rx) ** 2 + ((lat - cy - gy) / ry) ** 2
                        if dg < 1.0: ueber(i, weiss, kante(dg, 0.12))
                fluegel = aussen if st["fluegel"] else 0.0
                dick = st["lid_dick"] + 0.07 * fluegel * min(1.0, abs(ex))
                if abs(ex) < 1.08 and abs(ey - deckel) < dick:
                    ueber(i, lid, 1.0)
                elif fluegel and 1.0 <= abs(ex) < 1.35:
                    spitze = deckel + (abs(ex) - 1.0) * 0.9
                    if abs(ey - spitze) < 0.1 * (1.35 - abs(ex)) / 0.35: ueber(i, lid, 1.0)
                if abs(ex) < 0.45 and abs(ey + 0.97) < 0.04: ueber(i, lid, 0.55 if st["fluegel"] else 0.3)
    img = bpy.data.images.new(name, W, H, alpha=True)
    img.pixels.foreach_set(px)
    img.pack()
    return img

def gesicht(name, kopf, r, iris_hell, iris_dunkel, braue, form="w", eltern=None):
    """Kugelstück knapp über der Kopfhaut mit der gemalten Gesichtstextur"""
    img = gesicht_textur(name + "_tex", iris_hell, iris_dunkel, braue, form)
    m = bpy.data.materials.new("Gesicht")
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = "Linear"
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.6
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    bm = bmesh.new()
    NU, NV = 40, 24
    uv = bm.loops.layers.uv.new("UVMap")
    gitter = []
    for j in range(NV + 1):
        lat = math.radians(G_LAT[0] + j / NV * (G_LAT[1] - G_LAT[0]))
        zeile = []
        for k in range(NU + 1):
            lon = math.radians(G_LON[0] + k / NU * (G_LON[1] - G_LON[0]))
            n = Vector((math.sin(lon) * math.cos(lat), -math.cos(lon) * math.cos(lat), math.sin(lat)))
            zeile.append((bm.verts.new(Vector(kopf) + n * r), k / NU, j / NV))
        gitter.append(zeile)
    for j in range(NV):
        for k in range(NU):
            ecken = (gitter[j][k], gitter[j][k + 1], gitter[j + 1][k + 1], gitter[j + 1][k])
            f = bm.faces.new([e[0] for e in ecken])
            for loop, (_, u, v) in zip(f.loops, ecken):
                loop[uv].uv = (u, v)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    me.materials.append(m)
    obj = verlinken(bpy.data.objects.new(name, me), eltern)
    glaetten(obj, 0)
    return obj
