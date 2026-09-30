/**
 * Spielfiguren fürs Gebäude (TaskCrawler, Regel-Labor): aus einfachen Körpern
 * gebaut wie die Zimmer-Objekte. Sechs Klassen, zwei Körperformen, vier
 * Hauttöne. Die Figur steht mit y = 0 auf dem Boden, ist ~1,3 hoch und
 * schaut nach +z (dorthin, wo sie hinläuft).
 */
import * as THREE from "three";

export type Klasse = "normal" | "krieger" | "magier" | "priester" | "rapper" | "rocker";
export type Form = "m" | "w";
export interface Avatar { klasse: Klasse; form: Form; haut: number }

export const KLASSEN: { id: Klasse; name: string; icon: string }[] = [
  { id: "normal", name: "Normal", icon: "🙂" },
  { id: "krieger", name: "Krieger", icon: "⚔️" },
  { id: "magier", name: "Magier", icon: "🔮" },
  { id: "priester", name: "Priester", icon: "✨" },
  { id: "rapper", name: "Rapper", icon: "🎤" },
  { id: "rocker", name: "Rocker", icon: "🎸" },
];
export const FORMEN: { id: Form; name: string }[] = [{ id: "m", name: "männlich" }, { id: "w", name: "weiblich" }];
export const HAUT = [0xf6d5b8, 0xe0ac7e, 0xa86b3c, 0x5c3a21];

export const STANDARD_AVATAR: Avatar = { klasse: "normal", form: "m", haut: 0 };
const SPEICHER = "hp_avatar";

export function istAvatar(x: unknown): x is Avatar {
  const a = x as Avatar;
  return !!a && KLASSEN.some(k => k.id === a.klasse) && (a.form === "m" || a.form === "w")
    && Number.isInteger(a.haut) && a.haut >= 0 && a.haut < HAUT.length;
}

/** Die gewählte Figur gilt auf diesem Gerät für alle Gebäude */
export function ladeAvatar(): Avatar {
  try {
    const a = JSON.parse(localStorage.getItem(SPEICHER) ?? "null");
    if (istAvatar(a)) return a;
  } catch { /* ohne Speicher */ }
  return STANDARD_AVATAR;
}

export function speichereAvatar(a: Avatar) {
  try { localStorage.setItem(SPEICHER, JSON.stringify(a)); } catch { /* egal */ }
}

// ── Bausteine ──────────────────────────────────────────────────────────────
const mat = (farbe: number, leuchtet = false) =>
  new THREE.MeshLambertMaterial(leuchtet ? { color: farbe, emissive: farbe, emissiveIntensity: 0.8 } : { color: farbe });

function teil(g: THREE.Object3D, geo: THREE.BufferGeometry, farbe: number, x: number, y: number, z: number, leuchtet = false) {
  const m = new THREE.Mesh(geo, mat(farbe, leuchtet));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
const zyl = (g: THREE.Object3D, f: number, r1: number, r2: number, h: number, x: number, y: number, z = 0) =>
  teil(g, new THREE.CylinderGeometry(r1, r2, h, 14), f, x, y + h / 2, z);
const kugel = (g: THREE.Object3D, f: number, r: number, x: number, y: number, z = 0, leuchtet = false) =>
  teil(g, new THREE.SphereGeometry(r, 16, 12), f, x, y, z, leuchtet);
const quader = (g: THREE.Object3D, f: number, b: number, h: number, t: number, x: number, y: number, z = 0) =>
  teil(g, new THREE.BoxGeometry(b, h, t), f, x, y + h / 2, z);
const kegel = (g: THREE.Object3D, f: number, r: number, h: number, x: number, y: number, z = 0) =>
  teil(g, new THREE.ConeGeometry(r, h, 16), f, x, y + h / 2, z);
/** obere Halbkugel (Haare, Helm, Kappe) */
const kappe = (g: THREE.Object3D, f: number, r: number, x: number, y: number, z = 0) =>
  teil(g, new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), f, x, y, z);

interface Kleidung {
  oben: number; unten: number; schuhe: number;
  /** langes Gewand statt Beinen (Magier, Priester) */
  robe?: number;
  haar: number;
}

const KOPF_Y = 1.1, KOPF_R = 0.17;

/** Grundkörper: Beine oder Gewand, Rumpf, Arme, Hände, Kopf mit Augen */
function koerper(g: THREE.Group, a: Avatar, k: Kleidung) {
  const haut = HAUT[a.haut], w = a.form === "w";
  if (k.robe !== undefined) {
    zyl(g, k.robe, 0.16, 0.3, 0.55, 0, 0);
  } else {
    for (const s of [-1, 1]) {
      zyl(g, k.unten, 0.065, 0.07, 0.45, s * 0.08, 0.05);
      quader(g, k.schuhe, 0.12, 0.08, 0.2, s * 0.08, 0, 0.03);
    }
  }
  // Rumpf: breitere Schultern bei m, Taille bei w
  zyl(g, k.robe ?? k.oben, w ? 0.15 : 0.18, w ? 0.13 : 0.15, 0.45, 0, 0.5);
  if (w) zyl(g, k.robe ?? k.oben, 0.13, 0.17, 0.12, 0, 0.45); // Hüfte
  for (const s of [-1, 1]) {
    const arm = zyl(g, k.robe ?? k.oben, 0.05, 0.055, 0.4, s * (w ? 0.2 : 0.23), 0.55);
    arm.rotation.z = s * 0.12;
    kugel(g, haut, 0.055, s * (w ? 0.23 : 0.26), 0.55);
  }
  zyl(g, haut, 0.06, 0.06, 0.1, 0, 0.93);
  kugel(g, haut, KOPF_R, 0, KOPF_Y);
  for (const s of [-1, 1]) kugel(g, 0x111827, 0.022, s * 0.06, KOPF_Y + 0.02, 0.155);
  kugel(g, 0xb45309, 0.015, 0, KOPF_Y - 0.07, 0.16); // Mund
}

/** Frisur: kurz (m) oder lang mit Zopf (w); `lang` erzwingt lange Haare (Rocker) */
function haare(g: THREE.Group, a: Avatar, farbe: number, lang = a.form === "w") {
  kappe(g, farbe, KOPF_R + 0.015, 0, KOPF_Y + 0.01);
  if (lang) {
    quader(g, farbe, 0.34, 0.32, 0.1, 0, KOPF_Y - 0.28, -0.12);
    if (a.form === "w") kugel(g, farbe, 0.07, 0, KOPF_Y + 0.05, -0.2);
  }
}

// ── Klassen ────────────────────────────────────────────────────────────────
const BAU: Record<Klasse, (g: THREE.Group, a: Avatar) => void> = {
  normal: (g, a) => {
    koerper(g, a, { oben: a.form === "w" ? 0x10b981 : 0x2563eb, unten: 0x1e3a8a, schuhe: 0xf8fafc, haar: 0x4a2c17 });
    haare(g, a, 0x4a2c17);
    quader(g, 0xfacc15, 0.14, 0.14, 0.02, 0, 0.72, 0.17); // Motiv auf dem Shirt
  },
  krieger: (g, a) => {
    const METALL = 0x9ca3af;
    koerper(g, a, { oben: METALL, unten: 0x57341c, schuhe: 0x3f2a14, haar: 0xb45309 });
    if (a.form === "w") quader(g, 0xb45309, 0.08, 0.35, 0.06, 0, KOPF_Y - 0.4, -0.18); // Zopf unter dem Helm
    quader(g, 0x78350f, 0.38, 0.06, 0.36, 0, 0.5); // Gürtel
    // Helm mit Hörnern und Nasenschutz
    kappe(g, METALL, KOPF_R + 0.03, 0, KOPF_Y + 0.02);
    quader(g, METALL, 0.03, 0.12, 0.03, 0, KOPF_Y - 0.06, 0.17);
    for (const s of [-1, 1]) {
      const horn = kegel(g, 0xf5f5f4, 0.04, 0.18, s * 0.18, KOPF_Y + 0.05);
      horn.rotation.z = -s * 0.9;
    }
    // Schwert rechts, Schild links
    quader(g, 0xe5e7eb, 0.04, 0.6, 0.02, 0.27, 0.6, 0.08);
    quader(g, 0xfacc15, 0.16, 0.03, 0.05, 0.27, 0.6, 0.08);
    const schild = teil(g, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20), 0xb91c1c, -0.3, 0.7, 0.05);
    schild.rotation.z = Math.PI / 2;
    kugel(g, 0xfacc15, 0.05, -0.33, 0.7, 0.05);
  },
  magier: (g, a) => {
    const ROBE = 0x4c1d95;
    koerper(g, a, { oben: ROBE, unten: ROBE, schuhe: ROBE, robe: ROBE, haar: 0xe5e7eb });
    haare(g, a, a.form === "w" ? 0xc0c0d0 : 0xe5e7eb);
    if (a.form === "m") kegel(g, 0xe5e7eb, 0.1, 0.25, 0, KOPF_Y - 0.37, 0.12).rotation.x = Math.PI; // Bart
    // Spitzhut mit Krempe und Sternen
    zyl(g, ROBE, 0.3, 0.3, 0.02, 0, KOPF_Y + 0.08);
    const hut = kegel(g, ROBE, 0.17, 0.45, 0, KOPF_Y + 0.08);
    hut.rotation.z = 0.15;
    for (const [x, y] of [[0.08, KOPF_Y + 0.22], [-0.05, KOPF_Y + 0.35]]) kugel(g, 0xfacc15, 0.025, x, y, 0.1, true);
    for (const [x, y] of [[0.1, 0.35], [-0.12, 0.2], [0.05, 0.6]]) kugel(g, 0xfacc15, 0.02, x, y, 0.2, true);
    // Stab mit leuchtender Kugel
    zyl(g, 0x78350f, 0.025, 0.025, 1.3, 0.3, 0, 0.08);
    kugel(g, 0x22d3ee, 0.08, 0.3, 1.36, 0.08, true);
  },
  priester: (g, a) => {
    const ROBE = 0xf8fafc, GOLD = 0xd4a017;
    koerper(g, a, { oben: ROBE, unten: ROBE, schuhe: ROBE, robe: ROBE, haar: 0x6b4423 });
    haare(g, a, 0x6b4423);
    quader(g, GOLD, 0.06, 0.9, 0.02, 0, 0, 0.19); // Goldstreifen vorn
    quader(g, GOLD, 0.38, 0.05, 0.36, 0, 0.5); // Kordel
    // Heiligenschein und Stab mit Sonnenscheibe
    const schein = teil(g, new THREE.TorusGeometry(0.15, 0.018, 8, 24), GOLD, 0, KOPF_Y + 0.28, 0, true);
    schein.rotation.x = Math.PI / 2;
    zyl(g, GOLD, 0.022, 0.022, 1.25, -0.3, 0, 0.08);
    const sonne = teil(g, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), 0xfde047, -0.3, 1.32, 0.08, true);
    sonne.rotation.x = Math.PI / 2;
  },
  rapper: (g, a) => {
    koerper(g, a, { oben: 0xdc2626, unten: 0x1f2937, schuhe: 0xf8fafc, haar: 0x111827 });
    if (a.form === "w") haare(g, a, 0x111827);
    // Kappe verkehrt herum
    kappe(g, 0x111827, KOPF_R + 0.02, 0, KOPF_Y + 0.02);
    quader(g, 0x111827, 0.2, 0.02, 0.14, 0, KOPF_Y + 0.05, -0.2);
    // Goldkette, Kapuze, Sonnenbrille, Mikro
    const kette = teil(g, new THREE.TorusGeometry(0.12, 0.018, 8, 20), 0xfacc15, 0, 0.88, 0.05, true);
    kette.rotation.x = 1.2;
    kugel(g, 0xfacc15, 0.04, 0, 0.75, 0.17, true);
    quader(g, 0xb91c1c, 0.3, 0.16, 0.1, 0, 0.88, -0.14);
    quader(g, 0x111827, 0.28, 0.05, 0.03, 0, KOPF_Y, 0.16);
    zyl(g, 0x374151, 0.02, 0.025, 0.18, 0.26, 0.58, 0.1);
    kugel(g, 0x6b7280, 0.04, 0.26, 0.8, 0.1);
    for (const s of [-1, 1]) quader(g, 0xf8fafc, 0.15, 0.1, 0.24, s * 0.08, 0, 0.03); // dicke Sneaker
  },
  rocker: (g, a) => {
    koerper(g, a, { oben: 0x111827, unten: 0x1e3a8a, schuhe: 0x111827, haar: 0x111827 });
    haare(g, a, a.form === "w" ? 0x7f1d1d : 0x292524, true);
    // Bandana, Nieten, Gitarre auf dem Rücken
    zyl(g, 0xdc2626, KOPF_R + 0.02, KOPF_R + 0.02, 0.05, 0, KOPF_Y + 0.04);
    for (const x of [-0.1, 0, 0.1]) kugel(g, 0xd1d5db, 0.02, x, 0.88, 0.16);
    const gitarre = new THREE.Group();
    gitarre.position.set(0, 0.55, -0.2);
    gitarre.rotation.z = 0.6;
    g.add(gitarre);
    kugel(gitarre, 0xdc2626, 0.15, 0, 0, 0).scale.set(1, 1.2, 0.3);
    kugel(gitarre, 0xdc2626, 0.11, 0, 0.18, 0).scale.set(1, 1, 0.3);
    quader(gitarre, 0x78350f, 0.05, 0.5, 0.03, 0, 0.25, 0);
    quader(gitarre, 0x111827, 0.08, 0.1, 0.04, 0, 0.72, 0);
  },
};

export function baueAvatar(a: Avatar): THREE.Group {
  const g = new THREE.Group();
  (BAU[a.klasse] ?? BAU.normal)(g, a);
  return g;
}
