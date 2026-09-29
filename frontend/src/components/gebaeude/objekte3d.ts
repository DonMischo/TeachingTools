/**
 * Die Dinge in den Zimmern, aus einfachen Körpern gebaut. Jedes Objekt steht
 * mit y = 0 auf dem Zimmerboden, mittig, Grundfläche höchstens ~1,4 × 1,4.
 */
import * as THREE from "three";
import type { Objekt } from "@/lib/gebaeude/objekte";

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
};

export function baueObjekt(art: Objekt): THREE.Group {
  const g = new THREE.Group();
  (BAU[art] ?? BAU.pult)(g);
  return g;
}
