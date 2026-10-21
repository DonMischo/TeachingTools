/**
 * Spielfiguren fürs Gebäude (TaskCrawler, Regel-Labor): aus einfachen Körpern
 * gebaut wie die Zimmer-Objekte. Sechs Klassen, zwei Körperformen, vier
 * Hauttöne. Die Figur steht mit y = 0 auf dem Boden, ist ~1,3 hoch und
 * schaut nach +z (dorthin, wo sie hinläuft).
 */
import * as THREE from "three";
import { avatarDatei, ersetzeDurchModell } from "./avatarModell";

export type Klasse = "normal" | "krieger" | "magier" | "priester" | "rapper" | "rocker" | "metalhead";
export type Form = "m" | "w";
/** `tier` gesetzt: eines der Tiere (wie die Avatare beim Beitritt) statt eines Menschen */
export interface Avatar { klasse: Klasse; form: Form; haut: number; tier?: string }

/** Die Tier-Avatare der Plattform (ids wie in components/AvatarPicker.tsx) als 3D-Figuren */
export const TIERE: { id: string; name: string; emoji: string }[] = [
  { id: "cat", name: "Katze", emoji: "🐱" }, { id: "dog", name: "Hund", emoji: "🐶" },
  { id: "fox", name: "Fuchs", emoji: "🦊" }, { id: "frog", name: "Frosch", emoji: "🐸" },
  { id: "panda", name: "Panda", emoji: "🐼" }, { id: "koala", name: "Koala", emoji: "🐨" },
  { id: "tiger", name: "Tiger", emoji: "🐯" }, { id: "lion", name: "Löwe", emoji: "🦁" },
  { id: "cow", name: "Kuh", emoji: "🐮" }, { id: "pig", name: "Schwein", emoji: "🐷" },
  { id: "penguin", name: "Pinguin", emoji: "🐧" }, { id: "duck", name: "Ente", emoji: "🦆" },
  { id: "owl", name: "Eule", emoji: "🦉" }, { id: "octopus", name: "Krake", emoji: "🐙" },
  { id: "butterfly", name: "Schmetterling", emoji: "🦋" }, { id: "unicorn", name: "Einhorn", emoji: "🦄" },
  { id: "bee", name: "Biene", emoji: "🐝" }, { id: "turtle", name: "Schildkröte", emoji: "🐢" },
  { id: "dino", name: "Dino", emoji: "🦕" }, { id: "whale", name: "Wal", emoji: "🐳" },
  { id: "shark", name: "Hai", emoji: "🦈" }, { id: "dolphin", name: "Delfin", emoji: "🐬" },
  { id: "otter", name: "Otter", emoji: "🦦" }, { id: "sloth", name: "Faultier", emoji: "🦥" },
  { id: "hedgehog", name: "Igel", emoji: "🦔" }, { id: "crab", name: "Krebs", emoji: "🦀" },
  { id: "parrot", name: "Papagei", emoji: "🦜" }, { id: "flamingo", name: "Flamingo", emoji: "🦩" },
  { id: "peacock", name: "Pfau", emoji: "🦚" }, { id: "axolotl", name: "Axolotl", emoji: "🦎" },
];

export const KLASSEN: { id: Klasse; name: string; icon: string }[] = [
  { id: "normal", name: "Normal", icon: "🙂" },
  { id: "krieger", name: "Krieger", icon: "⚔️" },
  { id: "magier", name: "Magier", icon: "🔮" },
  { id: "priester", name: "Priester", icon: "✨" },
  { id: "rapper", name: "Rapper", icon: "🎤" },
  { id: "rocker", name: "Rocker", icon: "🎸" },
  { id: "metalhead", name: "Metalhead", icon: "🤘" },
];
export const FORMEN: { id: Form; name: string }[] = [{ id: "m", name: "männlich" }, { id: "w", name: "weiblich" }];
export const HAUT = [0xf6d5b8, 0xe0ac7e, 0xa86b3c, 0x5c3a21];

export const STANDARD_AVATAR: Avatar = { klasse: "normal", form: "m", haut: 0 };
const SPEICHER = "hp_avatar";

export function istAvatar(x: unknown): x is Avatar {
  const a = x as Avatar;
  return !!a && KLASSEN.some(k => k.id === a.klasse) && (a.form === "m" || a.form === "w")
    && Number.isInteger(a.haut) && a.haut >= 0 && a.haut < HAUT.length
    && (a.tier === undefined || TIERE.some(t => t.id === a.tier));
}

/** Die gespeicherte Figur, oder null, wenn auf diesem Gerät noch keine gewählt wurde */
export function gespeicherterAvatar(): Avatar | null {
  try {
    const a = JSON.parse(localStorage.getItem(SPEICHER) ?? "null");
    if (istAvatar(a)) return a;
  } catch { /* ohne Speicher */ }
  return null;
}

/** Die gewählte Figur gilt auf diesem Gerät für alle Gebäude */
export function ladeAvatar(): Avatar {
  return gespeicherterAvatar() ?? STANDARD_AVATAR;
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
/** Kugelkappe von oben bis zum Winkel `bis` (π/2 = Halbkugel) — für Haare, Helm, Kappe */
const kappe = (g: THREE.Object3D, f: number, r: number, x: number, y: number, z = 0, bis = Math.PI / 2) =>
  teil(g, new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, bis), f, x, y, z);
/** Kopfbedeckungen enden knapp über den Augen (die liegen etwas über der Kopfmitte) */
const UEBER_AUGEN = 1.2;

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

/**
 * Frisur: oben nur der Scheitelbereich (endet weit über den Augen), dazu der
 * Hinterkopf bis zum Nacken. Kurz (m) oder lang mit Zopf (w); `lang` erzwingt
 * lange Haare (Rocker). `oben: false` unter Hüten: Hinterkopf erst ab Krempenhöhe, Dutt tiefer, damit nichts durchsticht.
 */
function haare(g: THREE.Group, a: Avatar, farbe: number, lang = a.form === "w", oben = true) {
  const r = KOPF_R + 0.012;
  if (oben) kappe(g, farbe, r, 0, KOPF_Y, 0, 1.0);
  // Hinterkopf: hintere Hälfte (−z), vom Scheitel bis unter die Ohren
  const ab = oben ? 0.5 : 1.15;
  teil(g, new THREE.SphereGeometry(r, 16, 10, Math.PI, Math.PI, ab, 2.1 - ab), farbe, 0, KOPF_Y, 0);
  if (lang) {
    quader(g, farbe, 0.34, 0.32, 0.1, 0, KOPF_Y - 0.28, -0.12);
    if (a.form === "w") kugel(g, farbe, 0.07, 0, oben ? KOPF_Y + 0.05 : KOPF_Y - 0.08, -0.2);
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
    kappe(g, METALL, KOPF_R + 0.03, 0, KOPF_Y, 0, UEBER_AUGEN);
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
    haare(g, a, a.form === "w" ? 0xc0c0d0 : 0xe5e7eb, a.form === "w", false);
    if (a.form === "m") kegel(g, 0xe5e7eb, 0.1, 0.25, 0, KOPF_Y - 0.37, 0.12).rotation.x = Math.PI; // Bart
    // Spitzhut mit Krempe und Sternen
    zyl(g, ROBE, 0.3, 0.3, 0.02, 0, KOPF_Y + 0.08);
    // geschert statt gedreht: die Spitze neigt sich, der Rand bleibt flach auf der Krempe (sonst klafft ein Spalt)
    teil(g, new THREE.ConeGeometry(0.17, 0.45, 16).translate(0, 0.225, 0).applyMatrix4(new THREE.Matrix4().makeShear(0, 0, -0.33, 0, 0, 0)), ROBE, 0, KOPF_Y + 0.09, 0);
    for (const [hy, w] of [[0.13, 0.6], [0.26, -0.5]]) { // Sterne auf der Hutfläche (Höhe hy über der Krempe, Winkel w)
      const rr = 0.17 * (1 - hy / 0.45);
      kugel(g, 0xfacc15, 0.025, -0.33 * hy + rr * Math.sin(w), KOPF_Y + 0.09 + hy, rr * Math.cos(w), true);
    }
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
    if (a.form === "w") haare(g, a, 0x111827, true, false); // unter der Kappe nur Hinterkopf und lange Haare
    // Kappe verkehrt herum
    kappe(g, 0x111827, KOPF_R + 0.02, 0, KOPF_Y, 0, UEBER_AUGEN);
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
    zyl(g, 0xdc2626, KOPF_R + 0.005, KOPF_R + 0.015, 0.05, 0, KOPF_Y + 0.065);
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
  metalhead: (g, a) => {
    koerper(g, a, { oben: 0x111111, unten: 0x1c1c22, schuhe: 0x0b0b0b, haar: 0x0f0f12 });
    haare(g, a, 0x0f0f12, true);
    quader(g, 0x34507a, 0.4, 0.3, 0.38, 0, 0.55); // Kutte
    quader(g, 0xf1f1f1, 0.08, 0.08, 0.02, 0, 0.72, 0.2); // Totenkopf
    for (const s of [-1, 1]) zyl(g, 0x111111, 0.065, 0.065, 0.05, s * (a.form === "w" ? 0.23 : 0.26), 0.5);
  },
};

// ── Tiere ──────────────────────────────────────────────────────────────────
// Kindchenschema: großer Kopf (Mitte bei KY, Radius KR), runder Bauch, kleine Füße.
const KY = 0.85, KR = 0.27, SCHWARZ = 0x111827, WEISS = 0xf8fafc;

function augen(g: THREE.Object3D, y = KY + 0.05, abstand = 0.1, gross = 0.06) {
  for (const s of [-1, 1]) {
    kugel(g, WEISS, gross, s * abstand, y, KR - 0.05);
    kugel(g, SCHWARZ, gross * 0.55, s * abstand, y, KR - 0.05 + gross * 0.75);
  }
}

/** Füße, Körper mit Bauchfleck, Ärmchen, Kopf, Augen */
function basis(g: THREE.Group, fell: number, bauch = fell, fuss = fell, augenAn = true) {
  for (const s of [-1, 1]) kugel(g, fuss, 0.08, s * 0.1, 0.06, 0.05).scale.set(1, 0.6, 1.4);
  kugel(g, fell, 0.28, 0, 0.38).scale.set(1, 1.1, 0.95);
  kugel(g, bauch, 0.2, 0, 0.36, 0.12).scale.set(1, 1.1, 0.55);
  for (const s of [-1, 1]) kugel(g, fell, 0.075, s * 0.27, 0.45, 0.04);
  kugel(g, fell, KR, 0, KY);
  if (augenAn) augen(g);
}

function ohrenSpitz(g: THREE.Object3D, farbe: number, innen?: number, hoehe = 0.18, abstand = 0.15) {
  for (const s of [-1, 1]) {
    const o = kegel(g, farbe, 0.08, hoehe, s * abstand, KY + 0.17);
    o.rotation.z = -s * 0.35;
    if (innen !== undefined) kegel(g, innen, 0.045, hoehe * 0.7, s * abstand, KY + 0.18, 0.03).rotation.z = -s * 0.35;
  }
}
function ohrenRund(g: THREE.Object3D, farbe: number, r = 0.08, innen?: number, y = KY + 0.2, abstand = 0.18) {
  for (const s of [-1, 1]) {
    kugel(g, farbe, r, s * abstand, y, -0.02).scale.set(1, 1, 0.5);
    if (innen !== undefined) kugel(g, innen, r * 0.6, s * abstand, y, 0.02).scale.set(1, 1, 0.4);
  }
}
function schnauze(g: THREE.Object3D, farbe: number, nase = SCHWARZ, breit = 1) {
  kugel(g, farbe, 0.1, 0, KY - 0.06, KR - 0.04).scale.set(1.2 * breit, 0.8, 0.8);
  kugel(g, nase, 0.035, 0, KY - 0.02, KR + 0.03);
}
function schnurrhaare(g: THREE.Object3D) {
  for (const s of [-1, 1]) for (const dy of [-0.02, 0.02]) {
    const h = quader(g, 0x1f2937, 0.16, 0.006, 0.006, s * 0.2, KY - 0.06 + dy, KR - 0.02);
    h.rotation.z = s * dy * 4;
  }
}
function schwanz(g: THREE.Object3D, farbe: number, laenge = 0.35, dicke = 0.04, spitze?: number) {
  const t = zyl(g, farbe, dicke * 0.6, dicke, laenge, 0, 0.25, -0.3);
  t.rotation.x = -0.9;
  t.position.set(0, 0.35, -0.38);
  if (spitze !== undefined) kugel(g, spitze, dicke * 1.6, 0, 0.35 + Math.cos(0.9) * laenge / 2, -0.38 - Math.sin(0.9) * laenge / 2);
}
function schnabel(g: THREE.Object3D, farbe: number, lang = 0.14) {
  const s = kegel(g, farbe, 0.06, lang, 0, KY - 0.04, KR + lang / 2 - 0.04);
  s.rotation.x = Math.PI / 2;
  s.position.set(0, KY - 0.04, KR + 0.02);
}
function fluegel(g: THREE.Object3D, farbe: number) {
  for (const s of [-1, 1]) {
    const f = kugel(g, farbe, 0.14, s * 0.27, 0.42, -0.02);
    f.scale.set(0.35, 1.1, 0.8);
    f.rotation.z = s * 0.3;
  }
}
/** Meerestiere schweben: Körper waagrecht in Hüfthöhe */
function schwimmer(g: THREE.Group, farbe: number, bauch: number, laenge = 0.75) {
  kugel(g, farbe, 0.3, 0, 0.55).scale.set(1, 0.9, laenge / 0.6);
  kugel(g, bauch, 0.24, 0, 0.45, 0.05).scale.set(0.95, 0.6, laenge / 0.6);
  for (const s of [-1, 1]) {
    kugel(g, WEISS, 0.06, s * 0.2, 0.65, 0.28);
    kugel(g, SCHWARZ, 0.035, s * 0.22, 0.65, 0.32);
    const flosse = kugel(g, farbe, 0.12, s * 0.3, 0.45, 0.1);
    flosse.scale.set(1, 0.25, 0.6);
    flosse.rotation.z = s * 0.5;
  }
  const schw = kugel(g, farbe, 0.14, 0, 0.6, -laenge / 2 - 0.2);
  schw.scale.set(1.6, 0.25, 0.6);
}
/** Ringe um einen (gestauchten) Kugelkörper: Mitte cy, Radius r, Höhenfaktor sy */
function streifen(g: THREE.Object3D, farbe: number, n: number, y0: number, dy: number, r: number, cy = 0.38, sy = 1.1) {
  for (let i = 0; i < n; i++) {
    const y = y0 + i * dy;
    const rr = r * Math.sqrt(Math.max(0.05, 1 - ((y - cy) / (r * sy)) ** 2)) + 0.012;
    const t = teil(g, new THREE.TorusGeometry(rr, 0.022, 6, 28), farbe, 0, y, 0);
    t.rotation.x = Math.PI / 2;
  }
}

/** Stacheln, die vom Rücken einer Kugel (Mitte c, Radius r) nach außen zeigen */
function stacheln(g: THREE.Object3D, farbe: number, c: THREE.Vector3, r: number, reihen: number, jeReihe: number) {
  const hoch = new THREE.Vector3(0, 1, 0);
  for (let j = 0; j < reihen; j++) {
    const e = -0.25 + (1.25 * j) / Math.max(1, reihen - 1);          // Höhenwinkel: unten bis fast oben
    for (let i = 0; i < jeReihe; i++) {
      const a = Math.PI * (0.6 + (0.8 * (i + (j % 2) * 0.5)) / jeReihe); // hintere Hälfte, versetzt je Reihe
      const normale = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
      const st = teil(g, new THREE.ConeGeometry(0.035, 0.18, 6), farbe, 0, 0, 0);
      st.position.copy(c).addScaledVector(normale, r + 0.05);
      st.quaternion.setFromUnitVectors(hoch, normale);
    }
  }
}

const TIER_BAU: Record<string, (g: THREE.Group) => void> = {
  cat: g => { basis(g, 0xf59e0b, 0xfde68a); ohrenSpitz(g, 0xf59e0b, 0xfda4af); kugel(g, 0xfda4af, 0.03, 0, KY - 0.03, KR); schnurrhaare(g); schwanz(g, 0xf59e0b, 0.45); },
  dog: g => {
    basis(g, 0xc08a54, 0xf5deb3);
    for (const s of [-1, 1]) { const o = kugel(g, 0x7c4a1e, 0.1, s * 0.25, KY + 0.02, -0.02); o.scale.set(0.5, 1.4, 0.8); }
    schnauze(g, 0xf5deb3); kugel(g, 0xef4444, 0.04, 0, KY - 0.14, KR - 0.02).scale.set(1, 0.5, 1); schwanz(g, 0xc08a54, 0.22, 0.05);
  },
  fox: g => { basis(g, 0xea580c, WEISS, 0x1f2937); ohrenSpitz(g, 0xea580c, SCHWARZ, 0.24); schnauze(g, WEISS); schwanz(g, 0xea580c, 0.45, 0.09, WEISS); },
  frog: g => {
    basis(g, 0x22c55e, 0xbbf7d0, 0x16a34a, false);
    for (const s of [-1, 1]) { kugel(g, 0x22c55e, 0.1, s * 0.13, KY + 0.2, 0.08); kugel(g, WEISS, 0.07, s * 0.13, KY + 0.22, 0.14); kugel(g, SCHWARZ, 0.04, s * 0.13, KY + 0.22, 0.2); }
    const mund = teil(g, new THREE.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), 0x14532d, 0, KY - 0.02, KR - 0.02);
    mund.rotation.z = Math.PI;
  },
  panda: g => {
    basis(g, WEISS, WEISS, SCHWARZ);
    for (const s of [-1, 1]) { kugel(g, SCHWARZ, 0.075, s * 0.27, 0.45, 0.04); kugel(g, SCHWARZ, 0.08, s * 0.1, KY + 0.05, KR - 0.1).scale.set(1, 1.2, 0.6); }
    augen(g); ohrenRund(g, SCHWARZ); kugel(g, SCHWARZ, 0.04, 0, KY - 0.05, KR);
  },
  koala: g => { basis(g, 0x9ca3af, 0xe5e7eb); ohrenRund(g, 0x9ca3af, 0.12, WEISS, KY + 0.12, 0.25); kugel(g, 0x374151, 0.06, 0, KY - 0.04, KR).scale.set(0.8, 1.2, 0.8); },
  tiger: g => { basis(g, 0xf97316, WEISS); streifen(g, SCHWARZ, 3, 0.26, 0.13, 0.28); ohrenRund(g, 0xf97316, 0.07, WEISS); schnauze(g, WEISS); schwanz(g, 0xf97316, 0.45, 0.04, SCHWARZ); },
  lion: g => {
    basis(g, 0xeab308, 0xfef3c7);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; kugel(g, 0x92400e, 0.1, Math.cos(a) * 0.27, KY + Math.sin(a) * 0.27, -0.05); }
    ohrenRund(g, 0xeab308, 0.06); schnauze(g, 0xfef3c7, 0x78350f); schwanz(g, 0xeab308, 0.4, 0.035, 0x92400e);
  },
  cow: g => {
    basis(g, WEISS, WEISS, SCHWARZ);
    for (const [x, y, z] of [[0.18, 0.45, 0.12], [-0.15, 0.3, 0.15], [0.1, KY + 0.12, 0.18]]) kugel(g, SCHWARZ, 0.08, x, y, z).scale.set(1, 1, 0.4);
    for (const s of [-1, 1]) { kegel(g, 0xfef3c7, 0.03, 0.12, s * 0.14, KY + 0.2).rotation.z = -s * 0.5; const o = kugel(g, WEISS, 0.07, s * 0.28, KY + 0.05); o.scale.set(1.4, 0.6, 0.6); }
    kugel(g, 0xfda4af, 0.12, 0, KY - 0.1, KR - 0.05).scale.set(1.3, 0.8, 0.7);
    for (const s of [-1, 1]) kugel(g, 0x9f1239, 0.02, s * 0.05, KY - 0.1, KR + 0.03);
  },
  pig: g => {
    basis(g, 0xf9a8d4, 0xfbcfe8); ohrenSpitz(g, 0xf472b6, undefined, 0.12, 0.17);
    const r = teil(g, new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), 0xf472b6, 0, KY - 0.05, KR); r.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) kugel(g, 0x9d174d, 0.018, s * 0.03, KY - 0.05, KR + 0.035);
    const k = teil(g, new THREE.TorusGeometry(0.05, 0.015, 6, 16), 0xf472b6, 0, 0.4, -0.3); k.rotation.y = Math.PI / 2;
  },
  penguin: g => { basis(g, 0x1f2937, WEISS, 0xf97316); kugel(g, WEISS, 0.2, 0, KY - 0.02, 0.1).scale.set(1, 0.9, 0.9); augen(g); schnabel(g, 0xf97316, 0.1); fluegel(g, 0x1f2937); },
  duck: g => {
    basis(g, 0xfde047, 0xfef9c3, 0xf97316); fluegel(g, 0xfacc15);
    const s = kugel(g, 0xf97316, 0.1, 0, KY - 0.06, KR); s.scale.set(1.2, 0.35, 0.9);
    kugel(g, 0xfde047, 0.05, 0, KY + 0.28, 0);
  },
  owl: g => {
    basis(g, 0x92400e, 0xfde68a, 0xf59e0b, false);
    for (const s of [-1, 1]) { kugel(g, 0xfef3c7, 0.1, s * 0.1, KY + 0.04, KR - 0.08).scale.set(1, 1, 0.5); kugel(g, SCHWARZ, 0.05, s * 0.1, KY + 0.04, KR - 0.02); kegel(g, 0x92400e, 0.05, 0.14, s * 0.18, KY + 0.2).rotation.z = -s * 0.4; }
    schnabel(g, 0xf59e0b, 0.08); fluegel(g, 0x78350f);
  },
  octopus: g => {
    kugel(g, 0xf472b6, 0.34, 0, 0.8).scale.set(1, 1.15, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      // oben dick unter dem Kopf, unten dünn und nach außen gespreizt, Spitze eingerollt
      const T = 0.5;
      const arm = zyl(g, 0xec4899, 0.075, 0.035, 0.5, Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2);
      arm.rotation.set(-Math.sin(a) * T, 0, Math.cos(a) * T);
      const aussen = 0.2 + 0.25 * Math.sin(T) + 0.03;
      kugel(g, 0xec4899, 0.045, Math.cos(a) * aussen, 0.3 - 0.25 * Math.cos(T), Math.sin(a) * aussen);
    }
    for (const s of [-1, 1]) { kugel(g, WEISS, 0.07, s * 0.12, 0.72, 0.28); kugel(g, SCHWARZ, 0.04, s * 0.12, 0.72, 0.34); }
  },
  butterfly: g => {
    zyl(g, 0x1f2937, 0.05, 0.05, 0.5, 0, 0.45);
    kugel(g, 0x1f2937, 0.1, 0, 1.0); augen(g, 1.02, 0.05, 0.035);
    for (const s of [-1, 1]) {
      for (const [dy, r, f] of [[0.2, 0.28, 0x3b82f6], [-0.08, 0.2, 0xa855f7]] as const) {
        const w = kugel(g, f, r, s * (r + 0.02), 0.7 + dy, -0.05); w.scale.set(1, 1, 0.08); w.rotation.y = s * 0.4;
      }
      const f = zyl(g, SCHWARZ, 0.008, 0.008, 0.2, s * 0.05, 1.08); f.rotation.z = -s * 0.4; kugel(g, SCHWARZ, 0.02, s * 0.1, 1.27);
    }
  },
  unicorn: g => {
    basis(g, WEISS, WEISS, 0xe9d5ff); ohrenSpitz(g, WEISS, 0xfbcfe8, 0.14, 0.17);
    kegel(g, 0xfacc15, 0.05, 0.3, 0, KY + 0.22, 0.12).rotation.x = 0.3;
    for (let i = 0; i < 5; i++) kugel(g, [0xf472b6, 0xa78bfa, 0x60a5fa, 0x34d399, 0xfbbf24][i], 0.07, 0, KY + 0.2 - i * 0.12, -0.2 - i * 0.02);
    schnauze(g, 0xfce7f3, 0xf9a8d4); schwanz(g, 0xa78bfa, 0.4, 0.06, 0xf472b6);
  },
  bee: g => {
    kugel(g, 0xfacc15, 0.3, 0, 0.5).scale.set(1, 1.1, 1);
    streifen(g, SCHWARZ, 3, 0.37, 0.13, 0.3, 0.5);
    kugel(g, 0xfacc15, KR * 0.8, 0, 0.98); augen(g, 1.0, 0.08, 0.05);
    for (const s of [-1, 1]) {
      const w = kugel(g, 0xe0f2fe, 0.18, s * 0.22, 0.85, -0.15); w.scale.set(1, 0.6, 0.12); w.rotation.z = s * 0.6;
      const f = zyl(g, SCHWARZ, 0.008, 0.008, 0.2, s * 0.06, 1.12); f.rotation.z = -s * 0.3; kugel(g, SCHWARZ, 0.03, s * 0.1, 1.33);
    }
    kegel(g, SCHWARZ, 0.04, 0.12, 0, 0.45, -0.38).rotation.x = -Math.PI / 2;
  },
  turtle: g => {
    basis(g, 0x84cc16, 0xecfccb, 0x65a30d);
    // Panzer als Kuppel auf dem Rücken: die Wölbung zeigt nach hinten (−z)
    const panzer = kappe(g, 0x166534, 0.31, 0, 0.4, -0.08);
    panzer.rotation.x = -Math.PI / 2;
    panzer.scale.set(1, 0.75, 1.15);
    teil(g, new THREE.TorusGeometry(0.31, 0.025, 6, 28), 0x14532d, 0, 0.4, -0.08).scale.set(1, 1.15, 1);
    for (const [x, y, z] of [[0, 0.4, -0.32], [0.13, 0.55, -0.27], [-0.13, 0.55, -0.27], [0.13, 0.25, -0.27], [-0.13, 0.25, -0.27]]) {
      kugel(g, 0x14532d, 0.065, x, y, z).scale.set(1, 1, 0.3);
    }
  },
  dino: g => {
    basis(g, 0x65a30d, 0xd9f99d);
    // Rückenzacken sitzen auf der Rundung von Kopf und Körper und zeigen senkrecht von ihr weg
    const hoch = new THREE.Vector3(0, 1, 0);
    for (const [cy, r, e, gross] of [[KY, KR, 1.1, 1], [KY, KR, 0.65, 1], [KY, KR, 0.2, 0.9], [0.38, 0.29, 0.55, 0.9], [0.38, 0.29, 0.1, 0.8], [0.38, 0.28, -0.35, 0.7]]) {
      const normale = new THREE.Vector3(0, Math.sin(e), -Math.cos(e));
      const z = teil(g, new THREE.ConeGeometry(0.06 * gross, 0.14 * gross, 8).translate(0, 0.07 * gross - 0.01, 0), 0xf97316, 0, cy, 0);
      z.position.addScaledVector(normale, r);
      z.quaternion.setFromUnitVectors(hoch, normale);
    }
    schwanz(g, 0x65a30d, 0.55, 0.1); kugel(g, 0x3f6212, 0.02, 0.06, KY - 0.05, KR); kugel(g, 0x3f6212, 0.02, -0.06, KY - 0.05, KR);
  },
  whale: g => { schwimmer(g, 0x2563eb, 0xbfdbfe, 0.9); zyl(g, 0x7dd3fc, 0.02, 0.05, 0.25, 0, 0.8, 0.05); kugel(g, 0xbae6fd, 0.06, 0, 1.08, 0.05); },
  shark: g => {
    schwimmer(g, 0x64748b, WEISS, 0.9);
    const f = kegel(g, 0x475569, 0.12, 0.3, 0, 0.75, -0.05); f.scale.set(0.3, 1, 1); f.rotation.x = -0.3;
    for (let i = 0; i < 5; i++) kegel(g, WEISS, 0.02, 0.05, -0.1 + i * 0.05, 0.43, 0.43).rotation.x = Math.PI;
  },
  dolphin: g => {
    schwimmer(g, 0x60a5fa, 0xe0f2fe, 0.8);
    // runder Schnabel (Rostrum), vorn am Kopf angesetzt und leicht nach unten
    kugel(g, 0x60a5fa, 0.08, 0, 0.47, 0.44).scale.set(1, 0.7, 1.8);
    const mund = teil(g, new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), 0x1e3a8a, 0, 0.45, 0.5);
    mund.rotation.set(Math.PI / 2, 0, Math.PI);
    const f = kegel(g, 0x3b82f6, 0.1, 0.22, 0, 0.75, -0.05); f.scale.set(0.3, 1, 1); f.rotation.x = -0.4;
  },
  otter: g => { basis(g, 0x92400e, 0xfde68a); ohrenRund(g, 0x92400e, 0.05, undefined, KY + 0.2, 0.2); schnauze(g, 0xfde68a); schnurrhaare(g); const t = kugel(g, 0x78350f, 0.1, 0, 0.12, -0.35); t.scale.set(0.8, 0.3, 2); },
  sloth: g => {
    basis(g, 0xa8a29e, 0xd6d3d1, 0x57534e, false);
    kugel(g, 0xf5f5f4, 0.2, 0, KY, KR - 0.14).scale.set(1.2, 0.9, 0.6);
    for (const s of [-1, 1]) { kugel(g, 0x57534e, 0.07, s * 0.1, KY + 0.03, KR - 0.05).scale.set(1.4, 0.8, 0.5); kugel(g, SCHWARZ, 0.03, s * 0.1, KY + 0.03, KR - 0.01); zyl(g, 0xa8a29e, 0.05, 0.06, 0.35, s * 0.3, 0.2, 0.05); }
    kugel(g, 0x44403c, 0.035, 0, KY - 0.06, KR - 0.02);
  },
  hedgehog: g => {
    basis(g, 0xd6b38a, 0xfef3c7, 0x78350f);
    stacheln(g, 0x57341c, new THREE.Vector3(0, 0.4, 0), 0.28, 4, 6);
    stacheln(g, 0x57341c, new THREE.Vector3(0, KY, 0), KR, 4, 6);
    kugel(g, SCHWARZ, 0.04, 0, KY - 0.04, KR + 0.03);
  },
  crab: g => {
    kugel(g, 0xdc2626, 0.33, 0, 0.45).scale.set(1.4, 0.7, 1);
    for (const s of [-1, 1]) {
      zyl(g, 0xdc2626, 0.025, 0.025, 0.25, s * 0.12, 0.6, 0.12); kugel(g, WEISS, 0.06, s * 0.12, 0.88, 0.12); kugel(g, SCHWARZ, 0.035, s * 0.12, 0.9, 0.17);
      const sch = kugel(g, 0xef4444, 0.13, s * 0.52, 0.65, 0.2); sch.scale.set(1, 0.8, 0.6);
      for (let i = 0; i < 3; i++) { const b = zyl(g, 0xb91c1c, 0.02, 0.02, 0.3, s * (0.4 + i * 0.03), 0.05, -0.15 + i * 0.12); b.rotation.z = s * 0.8; }
    }
  },
  parrot: g => {
    basis(g, 0x16a34a, 0xfde047, 0x57534e); kugel(g, 0xdc2626, 0.2, 0, KY + 0.1, 0.02).scale.set(1.05, 0.8, 1.05); augen(g);
    const s = kegel(g, 0xfef3c7, 0.07, 0.15, 0, KY - 0.06, KR); s.rotation.x = Math.PI * 0.75; fluegel(g, 0x2563eb);
    for (const [f, x] of [[0xdc2626, -0.06], [0x2563eb, 0], [0xfde047, 0.06]] as const) { const t = quader(g, f, 0.06, 0.45, 0.02, x, 0.05, -0.3); t.rotation.x = 0.3; }
  },
  flamingo: g => {
    for (const s of [-1, 1]) zyl(g, 0xf472b6, 0.02, 0.02, 0.4, s * 0.06, 0);
    const k = kugel(g, 0xf9a8d4, 0.25, 0, 0.55); k.scale.set(0.9, 0.8, 1.2);
    const hals = zyl(g, 0xf9a8d4, 0.05, 0.06, 0.35, 0, 0.62, 0.15); hals.rotation.x = -0.3;
    kugel(g, 0xf9a8d4, 0.14, 0, 1.05, 0.22);
    for (const s of [-1, 1]) { kugel(g, WEISS, 0.04, s * 0.07, 1.09, 0.32); kugel(g, SCHWARZ, 0.022, s * 0.07, 1.09, 0.35); }
    const s = kegel(g, SCHWARZ, 0.04, 0.14, 0, 0.98, 0.36); s.rotation.x = Math.PI * 0.7;
    fluegel(g, 0xf472b6);
  },
  peacock: g => {
    basis(g, 0x1d4ed8, 0x2563eb, 0x57534e); schnabel(g, 0xa8a29e, 0.08);
    for (let i = 0; i < 3; i++) kugel(g, 0x1d4ed8, 0.025, -0.05 + i * 0.05, KY + 0.35, 0).scale.set(1, 1, 1);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.15 + (i / 8) * 0.7);
      const x = Math.cos(a) * 0.55, y = 0.3 + Math.sin(a) * 0.6;
      const f = kugel(g, 0x059669, 0.13, x, y, -0.35); f.scale.set(1, 1, 0.2);
      kugel(g, 0x1e40af, 0.05, x, y, -0.32); kugel(g, 0xfacc15, 0.025, x, y, -0.29);
    }
  },
  axolotl: g => {
    basis(g, 0xfbcfe8, 0xfce7f3, 0xf9a8d4);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const k = kugel(g, 0xec4899, 0.05, s * (0.28 + i * 0.03), KY + 0.1 - i * 0.1, -0.02); k.scale.set(1.8, 0.5, 0.5); k.rotation.z = s * (0.5 - i * 0.4);
    }
    const mund = teil(g, new THREE.TorusGeometry(0.07, 0.01, 6, 16, Math.PI), 0x9d174d, 0, KY - 0.05, KR - 0.01); mund.rotation.z = Math.PI;
    schwanz(g, 0xfbcfe8, 0.4, 0.08);
  },
};

export function baueAvatar(a: Avatar): THREE.Group {
  const g = new THREE.Group();
  if (a.tier && TIER_BAU[a.tier]) TIER_BAU[a.tier](g);
  else (BAU[a.klasse] ?? BAU.normal)(g, a);
  ersetzeDurchModell(g, avatarDatei(a), HAUT[a.haut] ?? HAUT[0]); // neue Figur im Pokémon-Stil, sobald geladen
  return g;
}
