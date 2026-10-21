/**
 * Die Dinge in den Zimmern, aus einfachen Körpern gebaut. Jedes Objekt steht
 * mit y = 0 auf dem Zimmerboden, mittig, Grundfläche höchstens ~1,4 × 1,4.
 */
import * as THREE from "three";
import type { Objekt } from "@/lib/gebaeude/objekte";
import { VERLIES_MONSTER, VERLIES_WAECHTER } from "@/lib/angriffe/monster";
import { ladeMonster } from "@/lib/angriffe/monsterLader";

const HOLZ = 0x8b5a2b, DUNKEL = 0x3f2a1d, METALL = 0x9ca3af, SCHWARZ = 0x1f2937;

function mat(farbe: number) {
  return new THREE.MeshLambertMaterial({ color: farbe });
}

/** Quader mit Unterkante bei y */
function q(g: THREE.Group, farbe: number, b: number, h: number, t: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), mat(farbe));
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

function zyl(g: THREE.Group, farbe: number, r1: number, r2: number, h: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), mat(farbe));
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

function kugel(g: THREE.Group, farbe: number, r: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(farbe));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

/** Tisch: Platte auf vier Beinen, gibt die Höhe der Platte zurück */
function tisch(g: THREE.Group, b = 1.2, t = 0.7, h = 0.7, farbe = HOLZ): number {
  q(g, farbe, b, 0.08, t, 0, h - 0.08, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) q(g, DUNKEL, 0.07, h - 0.08, 0.07, sx * (b / 2 - 0.06), 0, sz * (t / 2 - 0.06));
  return h;
}

const BAU: Record<Objekt, (g: THREE.Group) => void> = {
  monster: () => undefined, // unten gesetzt
  boss: () => undefined,
  pult: g => {
    const h = tisch(g);
    q(g, 0xf8fafc, 0.35, 0.01, 0.45, -0.15, h, 0);
    q(g, 0x2563eb, 0.04, 0.02, 0.3, 0.25, h, 0.05);
  },
  computer: g => {
    const h = tisch(g);
    q(g, SCHWARZ, 0.7, 0.45, 0.06, 0, h + 0.08, -0.15);
    q(g, 0x38bdf8, 0.62, 0.36, 0.01, 0, h + 0.125, -0.115);
    q(g, SCHWARZ, 0.08, 0.08, 0.08, 0, h, -0.15);
    q(g, 0xd1d5db, 0.55, 0.03, 0.18, 0, h, 0.15);
  },
  kuckucksuhr: g => {
    q(g, DUNKEL, 0.12, 1.1, 0.12, 0, 0, 0);
    const haus = q(g, HOLZ, 0.55, 0.5, 0.3, 0, 1.1, 0);
    // Giebeldach aus zwei schrägen Platten
    for (const s of [-1, 1]) {
      const d = q(g, DUNKEL, 0.42, 0.05, 0.36, s * 0.15, 1.62, 0);
      d.rotation.z = -s * 0.6;
    }
    const zb = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), mat(0xfef3c7));
    zb.position.set(0, haus.position.y, 0.152);
    g.add(zb);
    q(g, SCHWARZ, 0.02, 0.12, 0.01, 0, haus.position.y, 0.16);
    q(g, 0xfacc15, 0.03, 0.35, 0.03, 0.12, 0.75, 0.1);
    kugel(g, 0xfacc15, 0.07, 0.12, 0.72, 0.1);
    kugel(g, 0x16a34a, 0.06, 0, 1.72, 0.12);
  },
  globus: g => {
    tisch(g, 0.7, 0.7, 0.55);
    zyl(g, METALL, 0.03, 0.03, 0.35, 0, 0.55);
    kugel(g, 0x2563eb, 0.3, 0, 1.15);
    kugel(g, 0x22c55e, 0.12, 0.12, 1.25, 0.2);
    kugel(g, 0x22c55e, 0.1, -0.2, 1.05, 0.15);
  },
  regal: g => {
    q(g, HOLZ, 1.3, 1.6, 0.35, 0, 0, -0.35);
    const farben = [0xdc2626, 0x2563eb, 0x16a34a, 0xeab308, 0x7c3aed, 0xea580c];
    for (let reihe = 0; reihe < 3; reihe++) {
      q(g, DUNKEL, 1.2, 0.04, 0.32, 0, 0.1 + reihe * 0.5, -0.2);
      for (let i = 0; i < 7; i++) {
        const hoehe = 0.3 + ((i * 7 + reihe * 3) % 4) * 0.04;
        q(g, farben[(i + reihe) % farben.length], 0.13, hoehe, 0.24, -0.5 + i * 0.16, 0.14 + reihe * 0.5, -0.18);
      }
    }
  },
  mikroskop: g => {
    const h = tisch(g, 1, 0.7);
    q(g, SCHWARZ, 0.3, 0.05, 0.25, 0, h, 0);
    q(g, SCHWARZ, 0.07, 0.4, 0.07, 0, h, -0.08);
    q(g, METALL, 0.2, 0.03, 0.18, 0, h + 0.15, 0.02);
    const rohr = zyl(g, METALL, 0.05, 0.05, 0.35, 0, h + 0.25, 0.02);
    rohr.rotation.x = 0.4;
  },
  tafel: g => {
    for (const s of [-0.6, 0.6]) q(g, METALL, 0.06, 1.7, 0.06, s, 0, -0.3);
    q(g, 0x7c4a1e, 1.3, 0.85, 0.06, 0, 0.75, -0.3);
    q(g, 0x14532d, 1.2, 0.75, 0.02, 0, 0.8, -0.26);
    q(g, 0xf8fafc, 0.5, 0.02, 0.01, -0.2, 1.3, -0.25);
    q(g, 0xf8fafc, 0.35, 0.02, 0.01, 0.1, 1.15, -0.25);
    q(g, 0xf8fafc, 0.6, 0.02, 0.01, -0.05, 1.0, -0.25);
  },
  laborbank: g => {
    const h = tisch(g, 1.3, 0.7, 0.75, 0xe5e7eb);
    zyl(g, 0x22d3ee, 0.07, 0.12, 0.25, -0.35, h);
    zyl(g, 0xf472b6, 0.05, 0.05, 0.3, -0.05, h);
    kugel(g, 0xa3e635, 0.11, 0.3, h + 0.11);
    zyl(g, 0xe5e7eb, 0.02, 0.02, 0.15, 0.3, h + 0.2);
  },
  tresor: g => {
    q(g, 0x4b5563, 0.9, 0.9, 0.8, 0, 0, -0.1);
    q(g, 0x6b7280, 0.75, 0.75, 0.02, 0, 0.08, 0.31);
    const rad = zyl(g, 0xfacc15, 0.12, 0.12, 0.05, 0, 0.45, 0.33);
    rad.rotation.x = Math.PI / 2;
    rad.position.set(0, 0.45, 0.34);
    q(g, 0xd1d5db, 0.05, 0.25, 0.05, 0.25, 0.33, 0.34);
  },
  teleskop: g => {
    for (let i = 0; i < 3; i++) {
      const bein = q(g, DUNKEL, 0.05, 1.0, 0.05, 0, 0, 0);
      const a = (i * Math.PI * 2) / 3;
      bein.position.set(Math.cos(a) * 0.2, 0.48, Math.sin(a) * 0.2);
      bein.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    }
    const rohr = zyl(g, 0xe5e7eb, 0.09, 0.13, 1.0, 0, 0.9, 0);
    rohr.rotation.z = -0.9;
    rohr.position.set(0.1, 1.2, 0);
  },
  kalender: g => {
    for (const s of [-0.5, 0.5]) q(g, METALL, 0.05, 1.6, 0.05, s, 0, -0.3);
    q(g, 0xf8fafc, 1.1, 0.85, 0.03, 0, 0.7, -0.3);
    q(g, 0xdc2626, 1.1, 0.18, 0.04, 0, 1.4, -0.29);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      q(g, (r * 6 + c) % 7 === 3 ? 0xdc2626 : 0x9ca3af, 0.12, 0.1, 0.01, -0.42 + c * 0.17, 0.82 + r * 0.14, -0.28);
    }
  },
  waage: g => {
    const h = tisch(g, 1.2, 0.7, 0.6);
    q(g, METALL, 0.3, 0.05, 0.2, 0, h, 0);
    zyl(g, METALL, 0.03, 0.03, 0.45, 0, h + 0.05);
    q(g, 0xfacc15, 0.9, 0.04, 0.04, 0, h + 0.5, 0);
    for (const s of [-0.42, 0.42]) {
      zyl(g, METALL, 0.01, 0.01, 0.2, s, h + 0.3);
      zyl(g, 0xfacc15, 0.16, 0.12, 0.03, s, h + 0.28);
    }
  },
  abakus: g => {
    q(g, HOLZ, 1.1, 0.06, 0.3, 0, 0, 0);
    for (const s of [-0.52, 0.52]) q(g, HOLZ, 0.06, 1.0, 0.3, s, 0, 0);
    q(g, HOLZ, 1.1, 0.06, 0.3, 0, 1.0, 0);
    const farben = [0xdc2626, 0x2563eb, 0x16a34a, 0xeab308, 0x7c3aed];
    for (let r = 0; r < 5; r++) {
      const stab = zyl(g, METALL, 0.01, 0.01, 1.0);
      stab.rotation.z = Math.PI / 2;
      stab.position.set(0, 0.2 + r * 0.17, 0);
      for (let k = 0; k < 6; k++) kugel(g, farben[r], 0.06, -0.4 + k * 0.12 + (k > 2 ? 0.25 : 0), 0.2 + r * 0.17, 0);
    }
  },

  // ── Medien durch die Zeit ────────────────────────────────────────────────
  hoehlenwand: g => {
    // Felsplatte mit Ocker-Tieren und Handabdruck
    const fels = q(g, 0x8a7560, 1.3, 1.3, 0.3, 0, 0, -0.4);
    fels.rotation.z = 0.04;
    const OCKER = 0xb45309, ROT = 0x991b1b;
    q(g, OCKER, 0.42, 0.18, 0.02, -0.2, 0.75, -0.24); // Bison
    for (const x of [-0.36, -0.06]) q(g, OCKER, 0.04, 0.16, 0.02, x, 0.6, -0.24);
    kugel(g, OCKER, 0.08, 0.04, 0.9, -0.24);
    q(g, ROT, 0.3, 0.1, 0.02, 0.3, 1.05, -0.24); // Pferd
    kugel(g, ROT, 0.07, 0.35, 0.45, -0.24).scale.set(1, 1.3, 0.3); // Hand
    zyl(g, 0x44403c, 0.05, 0.07, 0.3, 0.45, 0, 0.1); // Farbtopf
  },
  tontafel: g => {
    q(g, HOLZ, 0.7, 0.5, 0.5, 0, 0, 0);
    const tafel = q(g, 0xc2a27a, 0.5, 0.65, 0.08, 0, 0.5, -0.05);
    tafel.rotation.x = -0.25;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      const keil = q(g, 0x7c5a3a, 0.06, 0.03, 0.02, -0.15 + c * 0.1, 0.62 + r * 0.1, 0.01 + r * 0.02);
      keil.rotation.z = (r + c) % 2 ? 0.6 : -0.3;
    }
  },
  schriftrolle: g => {
    const h = tisch(g, 1.2, 0.7, 0.7, 0x92400e);
    q(g, 0xf1e3b8, 0.7, 0.01, 0.4, 0, h, 0); // ausgerollter Papyrus
    for (const s of [-0.37, 0.37]) {
      const rolle = zyl(g, 0xe8d5a0, 0.06, 0.06, 0.46);
      rolle.rotation.x = Math.PI / 2;
      rolle.position.set(s, h + 0.06, 0);
    }
    for (let r = 0; r < 4; r++) q(g, 0x44403c, 0.4, 0.005, 0.02, 0, h + 0.012, -0.12 + r * 0.08);
    for (let i = 0; i < 3; i++) { // Rollen im Korb
      const r = zyl(g, 0xe8d5a0, 0.05, 0.05, 0.4, 0.5, 0.15 + i * 0.1, 0.45);
      r.rotation.z = 0.2 * (i - 1);
    }
    zyl(g, 0x78350f, 0.18, 0.15, 0.3, 0.5, 0, 0.45);
  },
  buch: g => {
    // Lesepult mit aufgeschlagener Handschrift, bunte Initiale, Kerze
    q(g, DUNKEL, 0.12, 0.9, 0.12, 0, 0, 0);
    q(g, DUNKEL, 0.5, 0.05, 0.4, 0, 0, 0);
    const pult = new THREE.Group();
    pult.position.set(0, 0.95, 0);
    pult.rotation.x = -0.45;
    g.add(pult);
    q(pult, HOLZ, 0.8, 0.05, 0.55, 0, 0, 0);
    for (const s of [-0.19, 0.19]) q(pult, 0xfaf3dc, 0.36, 0.04, 0.46, s, 0.05, 0);
    q(pult, 0xb91c1c, 0.08, 0.01, 0.08, -0.3, 0.09, -0.14);
    q(pult, 0x1d4ed8, 0.1, 0.01, 0.02, 0.15, 0.09, -0.15);
    zyl(g, 0xfef9c3, 0.03, 0.03, 0.25, 0.45, 0.9, -0.1);
    kugel(g, 0xfbbf24, 0.035, 0.45, 1.18, -0.1);
  },
  druckerpresse: g => {
    // zwei Pfosten, Querbalken, Spindel, Druckplatte; ein gedrucktes Blatt
    for (const s of [-0.45, 0.45]) q(g, HOLZ, 0.14, 1.7, 0.14, s, 0, -0.1);
    q(g, HOLZ, 1.05, 0.16, 0.2, 0, 1.55, -0.1);
    q(g, HOLZ, 1.05, 0.12, 0.6, 0, 0.6, -0.1);
    zyl(g, METALL, 0.05, 0.05, 0.6, 0, 0.95, -0.1);
    q(g, DUNKEL, 0.6, 0.1, 0.4, 0, 0.85, -0.1);
    const hebel = zyl(g, METALL, 0.025, 0.025, 0.6, 0.25, 1.3, -0.1);
    hebel.rotation.z = Math.PI / 2;
    q(g, 0xfaf3dc, 0.35, 0.01, 0.45, 0, 0.72, -0.1);
    q(g, 0x1f2937, 0.25, 0.012, 0.03, 0, 0.72, -0.2);
  },
  zeitung: g => {
    // Zeitungsständer mit Stapel und einem aufgeklappten Blatt
    q(g, 0x374151, 0.8, 0.7, 0.5, 0, 0, 0);
    for (let i = 0; i < 4; i++) q(g, i % 2 ? 0xe5e7eb : 0xf8fafc, 0.6, 0.03, 0.4, 0, 0.7 + i * 0.03, 0);
    const blatt = q(g, 0xf8fafc, 0.6, 0.8, 0.02, 0, 0.85, -0.2);
    blatt.rotation.x = -0.2;
    q(g, 0x111827, 0.5, 0.09, 0.01, 0, 1.47, -0.33); // Schlagzeile
    for (let r = 0; r < 4; r++) q(g, 0x9ca3af, 0.22, 0.03, 0.01, -0.13, 1.35 - r * 0.1, -0.31 + r * 0.02);
    q(g, 0x6b7280, 0.22, 0.25, 0.01, 0.14, 1.1, -0.26);
  },
  telegraph: g => {
    const h = tisch(g, 1.1, 0.7);
    q(g, HOLZ, 0.3, 0.04, 0.2, -0.2, h, 0.1); // Morsetaste
    const taste = q(g, METALL, 0.25, 0.02, 0.04, -0.2, h + 0.08, 0.1);
    taste.rotation.z = 0.08;
    kugel(g, SCHWARZ, 0.04, -0.3, h + 0.11, 0.1);
    q(g, 0x78350f, 0.4, 0.3, 0.3, 0.25, h, -0.1); // Empfänger mit Papierstreifen
    zyl(g, 0xf8fafc, 0.07, 0.07, 0.12, 0.25, h + 0.3, -0.1).rotation.x = Math.PI / 2;
    q(g, 0xf8fafc, 0.5, 0.005, 0.05, 0.1, h + 0.05, 0.25);
    zyl(g, METALL, 0.01, 0.01, 0.9, 0.5, h, -0.25); // Leitung
  },
  telefon: g => {
    // Holzkasten-Wandtelefon mit Kurbel und Hörer am Haken
    q(g, DUNKEL, 0.1, 1.0, 0.1, 0, 0, -0.35);
    q(g, HOLZ, 0.45, 0.6, 0.18, 0, 1.0, -0.3);
    for (const s of [-0.1, 0.1]) kugel(g, 0xfacc15, 0.06, s, 1.5, -0.2);
    const sprech = zyl(g, SCHWARZ, 0.07, 0.04, 0.18, 0, 1.2, -0.12);
    sprech.rotation.x = Math.PI / 2;
    const kurbel = zyl(g, METALL, 0.015, 0.015, 0.2, 0.28, 1.25, -0.25);
    kurbel.rotation.z = Math.PI / 2;
    const hoerer = zyl(g, SCHWARZ, 0.05, 0.03, 0.22, -0.3, 1.15, -0.25);
    hoerer.rotation.z = 0.3;
    zyl(g, SCHWARZ, 0.005, 0.005, 0.3, -0.26, 0.95, -0.25);
  },
  radio: g => {
    // Röhrenradio mit rundem Oberteil und Stoffbespannung
    const h = tisch(g, 0.9, 0.6, 0.6);
    q(g, 0x7c2d12, 0.7, 0.5, 0.35, 0, h, -0.05);
    const bogen = zyl(g, 0x7c2d12, 0.35, 0.35, 0.35, 0, h + 0.5, -0.05);
    bogen.rotation.x = Math.PI / 2;
    bogen.scale.set(1, 1, 0.55);
    q(g, 0xd6c29c, 0.5, 0.4, 0.01, 0, h + 0.2, 0.13);
    for (let i = 0; i < 5; i++) q(g, 0x7c2d12, 0.02, 0.38, 0.012, -0.2 + i * 0.1, h + 0.21, 0.135);
    for (const s of [-0.2, 0.2]) zyl(g, 0xfacc15, 0.04, 0.04, 0.04, s, h + 0.05, 0.13).rotation.x = Math.PI / 2;
  },
  filmprojektor: g => {
    const h = tisch(g, 1.0, 0.6, 0.75, 0x374151);
    q(g, SCHWARZ, 0.5, 0.3, 0.25, 0, h, 0);
    for (const [x, y] of [[-0.12, 0.55], [0.18, 0.5]]) {
      const spule = zyl(g, 0x9ca3af, 0.17, 0.17, 0.04, x, h + y, 0);
      spule.rotation.x = Math.PI / 2;
      spule.position.set(x, h + y, 0);
    }
    const linse = zyl(g, METALL, 0.07, 0.09, 0.2, 0, h + 0.15, 0.2);
    linse.rotation.x = Math.PI / 2;
    linse.position.set(0, h + 0.15, 0.22);
    // Lichtkegel
    const licht = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfef9c3, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    licht.rotation.x = -Math.PI / 2;
    licht.position.set(0, h + 0.15, 0.72);
    g.add(licht);
  },
  fernseher: g => {
    // Fernseher der 50er mit Beinen, gewölbtem Bildschirm und Zimmerantenne
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.15, 0.15]) q(g, DUNKEL, 0.05, 0.4, 0.05, sx, 0, sz);
    q(g, 0x92400e, 0.8, 0.65, 0.5, 0, 0.4, 0);
    q(g, 0x6b7280, 0.55, 0.45, 0.02, -0.06, 0.5, 0.25);
    q(g, 0xcbd5e1, 0.45, 0.35, 0.01, -0.06, 0.55, 0.26);
    for (const y of [0.85, 0.7]) kugel(g, 0xfacc15, 0.035, 0.3, y - 0.2, 0.26);
    for (const s of [-1, 1]) {
      const ant = zyl(g, METALL, 0.01, 0.01, 0.5, s * 0.12, 1.2, 0);
      ant.rotation.z = -s * 0.5;
    }
    kugel(g, SCHWARZ, 0.07, 0, 1.07, 0);
  },
  grossrechner: g => {
    // Schränke voller Röhren und Lämpchen, Lochkarten davor
    for (const x of [-0.45, 0, 0.45]) {
      q(g, 0x475569, 0.42, 1.7, 0.4, x, 0, -0.35);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
        const an = (r * 3 + c + Math.round(x * 10)) % 3 === 0;
        kugel(g, an ? 0xfbbf24 : 0x1f2937, 0.025, x - 0.1 + c * 0.1, 0.5 + r * 0.17, -0.14);
      }
      q(g, 0x1f2937, 0.3, 0.2, 0.01, x, 1.4, -0.14);
    }
    q(g, 0xfde68a, 0.3, 0.12, 0.2, 0.2, 0, 0.3);
  },
  laptop: g => {
    const h = tisch(g);
    q(g, 0x9ca3af, 0.6, 0.03, 0.4, 0, h, 0.05);
    q(g, 0x374151, 0.5, 0.005, 0.25, 0, h + 0.03, 0.08);
    const deckel = new THREE.Group();
    deckel.position.set(0, h + 0.03, -0.15);
    deckel.rotation.x = -0.3;
    g.add(deckel);
    q(deckel, 0x9ca3af, 0.6, 0.4, 0.02, 0, 0, 0);
    q(deckel, 0x60a5fa, 0.54, 0.34, 0.005, 0, 0.03, 0.012);
    q(deckel, 0xf8fafc, 0.2, 0.03, 0.002, -0.1, 0.3, 0.016); // Profil-Zeile
    q(deckel, 0xf8fafc, 0.3, 0.12, 0.002, 0, 0.12, 0.016);
  },
  smartphone: g => {
    // großes Handy auf einem Sockel, Bildschirm mit Kacheln
    q(g, 0x374151, 0.5, 0.6, 0.5, 0, 0, 0);
    const handy = new THREE.Group();
    handy.position.set(0, 0.6, 0);
    handy.rotation.x = -0.15;
    g.add(handy);
    q(handy, SCHWARZ, 0.42, 0.8, 0.06, 0, 0, 0);
    q(handy, 0x1e3a8a, 0.36, 0.7, 0.005, 0, 0.05, 0.032);
    const farben = [0xef4444, 0x22c55e, 0xeab308, 0x3b82f6, 0xa855f7, 0xf97316];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) q(handy, farben[(r * 3 + c) % 6], 0.08, 0.08, 0.004, -0.11 + c * 0.11, 0.5 - r * 0.12, 0.036);
  },
  tablet: g => {
    const h = tisch(g, 1.0, 0.7, 0.7);
    const t = new THREE.Group();
    t.position.set(0, h + 0.02, -0.05);
    t.rotation.x = -1.1;
    g.add(t);
    q(t, SCHWARZ, 0.6, 0.02, 0.45, 0, 0, 0);
    q(t, 0x0ea5e9, 0.54, 0.005, 0.39, 0, 0.02, 0);
    q(t, 0xf8fafc, 0.1, 0.006, 0.12, 0, 0.022, 0).rotation.y = 0; // Play-Knopf
    q(g, 0x9ca3af, 0.12, 0.2, 0.05, 0, h, -0.2);
  },
  kopfhoerer: g => {
    q(g, 0x1f2937, 0.35, 0.05, 0.35, 0, 0, 0);
    zyl(g, METALL, 0.03, 0.03, 1.1, 0, 0.05);
    const buegel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24, Math.PI), mat(SCHWARZ));
    buegel.position.set(0, 1.15, 0);
    g.add(buegel);
    for (const s of [-1, 1]) {
      const muschel = zyl(g, 0xef4444, 0.11, 0.11, 0.08, s * 0.24, 1.08, 0);
      muschel.rotation.z = Math.PI / 2;
      muschel.position.set(s * 0.24, 1.12, 0);
    }
  },
  grafiktablett: g => {
    // Bildschirm mit Bildbearbeitung (Ebenen), Zeichenbrett und Stift
    const h = tisch(g, 1.3, 0.75);
    q(g, SCHWARZ, 0.8, 0.5, 0.05, 0, h + 0.1, -0.2);
    q(g, 0x1f2937, 0.74, 0.44, 0.005, 0, h + 0.13, -0.172);
    q(g, 0x38bdf8, 0.45, 0.3, 0.006, -0.08, h + 0.2, -0.168);
    kugel(g, 0xfacc15, 0.05, -0.08, h + 0.35, -0.16);
    for (let i = 0; i < 3; i++) q(g, [0x9ca3af, 0x60a5fa, 0xf472b6][i], 0.14, 0.06, 0.006, 0.26, h + 0.4 - i * 0.08, -0.168);
    q(g, SCHWARZ, 0.08, 0.1, 0.08, 0, h, -0.2);
    q(g, 0x374151, 0.45, 0.02, 0.3, 0, h, 0.15);
    const stift = zyl(g, 0xf8fafc, 0.012, 0.008, 0.25, 0.25, h + 0.03, 0.15);
    stift.rotation.z = 1.3;
  },
  lagerfeuer: g => {
    // Steinkreis, Holzscheite, Flammen — hier wurde erzählt, bevor es Schrift gab
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      kugel(g, 0x78716c, 0.09, Math.cos(a) * 0.38, 0.06, Math.sin(a) * 0.38).scale.set(1, 0.6, 1);
    }
    for (let i = 0; i < 4; i++) {
      const scheit = zyl(g, 0x57341c, 0.04, 0.05, 0.5, 0, 0.08);
      scheit.rotation.set(Math.PI / 2 - 0.35, (i / 4) * Math.PI * 2, 0);
      scheit.position.set(0, 0.12, 0);
    }
    const flamme = (farbe: number, r: number, h: number, y: number) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), new THREE.MeshLambertMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 0.9 }));
      m.position.set(0, y + h / 2, 0);
      g.add(m);
    };
    flamme(0xea580c, 0.18, 0.5, 0.1);
    flamme(0xfacc15, 0.1, 0.35, 0.12);
    // ein Fell zum Sitzen
    q(g, 0x92400e, 0.5, 0.03, 0.35, 0, 0, 0.6);
  },
  quipu: g => {
    // Hauptschnur an einem Stab, bunte Knotenschnüre hängen herab
    for (const s of [-0.5, 0.5]) q(g, HOLZ, 0.06, 1.5, 0.06, s, 0, -0.2);
    // gewebtes Tuch dahinter (Inka-Muster) — gibt dem Objekt auch eine Fläche zum Anklicken
    q(g, 0xb45309, 0.94, 1.0, 0.02, 0, 0.35, -0.3);
    for (let r = 0; r < 4; r++) q(g, r % 2 ? 0xfacc15 : 0x7f1d1d, 0.94, 0.06, 0.01, 0, 0.45 + r * 0.25, -0.285);
    const stab = zyl(g, HOLZ, 0.025, 0.025, 1.1, 0, 1.4, -0.2);
    stab.rotation.z = Math.PI / 2;
    stab.position.set(0, 1.4, -0.2);
    const farben = [0xdc2626, 0xfacc15, 0x16a34a, 0xf8fafc, 0x2563eb, 0x92400e, 0xdc2626, 0x16a34a];
    farben.forEach((f, i) => {
      const x = -0.42 + i * 0.12, laenge = 0.55 + ((i * 7) % 4) * 0.12;
      zyl(g, f, 0.012, 0.012, laenge, x, 1.4 - laenge, -0.2);
      for (let k = 0; k < 1 + (i % 3); k++) kugel(g, f, 0.03, x, 1.25 - k * 0.15 - (i % 2) * 0.05, -0.2);
    });
  },
  orakelknochen: g => {
    // Schildkrötenpanzer und Schulterknochen mit Rissen und Zeichen, daneben ein Glutbecken
    const h = tisch(g, 1.2, 0.7, 0.55, 0x57341c);
    const panzer = kugel(g, 0xa8a29e, 0.26, -0.2, h, 0);
    panzer.scale.set(1, 0.25, 0.8);
    for (let i = 0; i < 4; i++) q(g, 0x44403c, 0.18, 0.01, 0.01, -0.25 + (i % 2) * 0.08, h + 0.06, -0.08 + i * 0.05).rotation.y = i * 0.7;
    const knochen = q(g, 0xf5f0e1, 0.2, 0.03, 0.42, 0.25, h, 0);
    knochen.rotation.y = 0.3;
    for (let i = 0; i < 3; i++) q(g, 0x7c2d12, 0.06, 0.005, 0.02, 0.24, h + 0.035, -0.12 + i * 0.1);
    zyl(g, 0x44403c, 0.12, 0.09, 0.12, 0.45, 0, 0.35);
    const glut = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.8 }));
    glut.position.set(0.45, 0.13, 0.35);
    g.add(glut);
  },
  faltbuch: g => {
    // Maya-Codex: zickzack gefaltete Seiten mit roten und schwarzen Zeichen auf einem Steinsockel
    q(g, 0x78716c, 0.9, 0.7, 0.5, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const seite = q(g, 0xf5ecd7, 0.15, 0.45, 0.01, -0.38 + i * 0.15, 0.7, 0);
      seite.rotation.y = i % 2 ? 0.5 : -0.5;
      q(g, i % 2 ? 0xb91c1c : 0x1f2937, 0.08, 0.08, 0.012, -0.38 + i * 0.15, 0.95, 0);
      q(g, 0x1f2937, 0.1, 0.02, 0.012, -0.38 + i * 0.15, 0.8, 0);
    }
  },
  tastenhandy: g => {
    // Handy der 2000er mit Tasten und kleinem grünen Display auf einem Sockel
    q(g, 0x374151, 0.5, 0.6, 0.5, 0, 0, 0);
    const h = new THREE.Group();
    h.position.set(0, 0.6, 0);
    h.rotation.x = -0.2;
    g.add(h);
    q(h, 0x1e3a8a, 0.3, 0.7, 0.08, 0, 0, 0);
    q(h, 0x86efac, 0.22, 0.18, 0.01, 0, 0.44, 0.045);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) q(h, 0xd1d5db, 0.05, 0.035, 0.01, -0.07 + c * 0.07, 0.08 + r * 0.07, 0.045);
    zyl(h, SCHWARZ, 0.015, 0.015, 0.12, 0.1, 0.7, 0);
  },
  retropc: g => {
    // beiger Röhrenmonitor mit grüner Schrift, Rechnergehäuse, Tastatur
    const h = tisch(g, 1.2, 0.75);
    q(g, 0xe7e0c9, 0.6, 0.12, 0.45, 0, h, -0.1);
    q(g, 0xe7e0c9, 0.5, 0.42, 0.42, 0, h + 0.12, -0.12);
    q(g, 0x052e16, 0.4, 0.3, 0.01, 0, h + 0.18, 0.095);
    for (let r = 0; r < 4; r++) q(g, 0x4ade80, 0.1 + ((r * 5) % 3) * 0.08, 0.02, 0.005, -0.1, h + 0.4 - r * 0.06, 0.1);
    q(g, 0xd6cfb4, 0.5, 0.04, 0.16, 0, h, 0.23);
  },
  kikern: g => {
    // Server-Säule mit leuchtendem Netz aus Knoten
    q(g, 0x1f2937, 0.7, 0.6, 0.7, 0, 0, 0);
    for (let r = 0; r < 3; r++) q(g, 0x22d3ee, 0.5, 0.02, 0.01, 0, 0.15 + r * 0.15, 0.351);
    const leucht = (farbe: number, r: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshLambertMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 0.7 }));
      m.position.set(x, y, z);
      g.add(m);
    };
    const knoten: [number, number, number][] = [];
    for (let schicht = 0; schicht < 3; schicht++) for (let k = 0; k < 3; k++) {
      knoten.push([-0.25 + k * 0.25, 0.85 + schicht * 0.25, (schicht - 1) * 0.1]);
    }
    for (const [x, y, z] of knoten) leucht(0xa78bfa, 0.05, x, y, z);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 3; b++) {
      const p = knoten[a], ziel = knoten[3 * (Math.floor(a / 3) + 1) + b];
      const von = new THREE.Vector3(...p), nach = new THREE.Vector3(...ziel);
      const linie = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, von.distanceTo(nach), 4),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
      linie.position.copy(von.clone().add(nach).multiplyScalar(0.5));
      linie.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nach.clone().sub(von).normalize());
      g.add(linie);
    }
    leucht(0x22d3ee, 0.12, 0, 0.72, 0);
  },
};

/** Ein Monster aus Kugeln: Körper, Augen, Hörner, Arme. `gross` = Boss. */
function ungeheuer(g: THREE.Group, haut: number, gross: boolean) {
  const k = gross ? 1.55 : 1;
  kugel(g, haut, 0.42 * k, 0, 0.5 * k).scale.set(1, 1.1, 0.9);
  for (const s of [-1, 1]) {
    kugel(g, 0xffffff, 0.1 * k, s * 0.15 * k, 0.68 * k, 0.33 * k);
    kugel(g, gross ? 0xfacc15 : SCHWARZ, 0.05 * k, s * 0.15 * k, 0.68 * k, 0.42 * k);
    const horn = zyl(g, gross ? 0x1f2937 : 0xe5e7eb, 0.01, 0.07 * k, 0.3 * k);
    horn.position.set(s * 0.25 * k, 0.95 * k, 0);
    horn.rotation.z = -s * 0.5;
    const arm = zyl(g, haut, 0.06 * k, 0.08 * k, 0.4 * k);
    arm.position.set(s * 0.45 * k, 0.45 * k, 0.1);
    arm.rotation.z = s * 0.9;
    zyl(g, haut, 0.09 * k, 0.1 * k, 0.2 * k, s * 0.18 * k, 0, 0);
  }
  q(g, 0x7f1d1d, 0.3 * k, 0.05 * k, 0.05, 0, 0.4 * k, 0.38 * k); // Maul
  if (gross) {
    // Krone und Keule
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      zyl(g, 0xfacc15, 0.01, 0.06, 0.2, Math.cos(a) * 0.22, 1.25, Math.sin(a) * 0.22);
    }
    zyl(g, 0xfacc15, 0.26, 0.26, 0.08, 0, 1.2, 0);
    const keule = zyl(g, 0x78350f, 0.05, 0.12, 1.0);
    keule.position.set(0.95, 0.7, 0.2);
    keule.rotation.z = -0.5;
  }
}

BAU.monster = g => ungeheuer(g, 0x65a30d, false);
BAU.boss = g => ungeheuer(g, 0x9f1239, true);

/**
 * `besiegt`: Monster und Boss liegen grau am Boden — so sieht man im Verlies,
 * welche Aufgabe schon gelöst ist. Monster und Bosse sind Quaternius-Modelle
 * (`variante` wählt welches); bis sie geladen sind, steht das Kugel-Ungeheuer da.
 */
export function baueObjekt(art: Objekt, besiegt = false, variante = 0): THREE.Group {
  if (art !== "monster" && art !== "boss") return baueGebaut(art, besiegt);
  const platz = new THREE.Group(), ersatz = baueGebaut(art, besiegt);
  platz.add(ersatz);
  if (besiegt) platz.userData.besiegt = true;
  const liste = art === "boss" ? VERLIES_WAECHTER : VERLIES_MONSTER;
  ladeMonster(liste[variante % liste.length], art === "boss" ? 1.9 : 1.0).then((m) => {
    platz.remove(ersatz);
    entsorgeGebaut(ersatz);
    platz.add(m.modell);
    if (besiegt) {
      m.eigeneMaterialien();
      m.modell.traverse((o) => { const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mat?.color) mat.color.lerp(new THREE.Color(0x6b7280), 0.7); });
      m.spiele("tod");
    }
  }).catch(() => { /* ohne Modell bleibt das Kugel-Ungeheuer */ });
  return platz;
}

function entsorgeGebaut(o: THREE.Object3D) {
  o.traverse((k) => { const m = k as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
}

function baueGebaut(art: Objekt, besiegt: boolean): THREE.Group {
  const g = new THREE.Group();
  (BAU[art] ?? BAU.pult)(g);
  if (besiegt && (art === "monster" || art === "boss")) {
    g.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (m?.color) m.color.lerp(new THREE.Color(0x6b7280), 0.75);
    });
    const liegend = new THREE.Group();
    g.rotation.x = -Math.PI / 2;
    g.position.y = 0.25;
    liegend.add(g);
    liegend.userData.besiegt = true;
    return liegend;
  }
  return g;
}
