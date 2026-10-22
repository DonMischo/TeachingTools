"use client";
/**
 * Die Wohnung in 3D (three.js, Toon-Look wie die Gebäude): gleicher Grundriss
 * und gleiche Möbelplätze wie der 2D-Plan, hinten hohe Außenwände, vorne
 * niedrige (Puppenhaus-Schnitt). Die Figur ist der Plattform-Avatar und läuft
 * auf einer weichen Kurve durch die Türen zum nächsten Platz; im Bett liegt sie.
 * Ohne WebGL2 (Tests, alte Geräte) zeigt die Hülle den 2D-Plan.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import AvatarWahl from "@/components/gebaeude/AvatarWahl";
import { baueAvatar, ladeAvatar, type Avatar } from "@/components/gebaeude/avatar";
import { beendeAvatar, bewegeAvatar, tickAvatare } from "@/components/gebaeude/avatarModell";
import { entsorge } from "@/components/gebaeude/szene";
import { toonStil } from "@/lib/angriffe/toon";
import { effekt } from "@/lib/leben/kern";
import type { Spielstand } from "@/lib/leben/typen";
import { einrichtung, grundriss, Wohnungsbild, zielPunkt, type Gestellt, type Platz, type Raum } from "./Wohnungsbild";

type Props = { s: Spielstand; platz: Platz; onVerschieben?: (uid: number, x: number, y: number, drehen?: boolean) => void };

const ANSICHT = "hp_leben_ansicht";
const HOCH = 2.5, NIEDRIG = 0.35, WAND = 0.12, TUER = 0.9;
const TEMPO = 1.9; // Meter pro Sekunde
const FIGUR = 1.55; // Körpergröße in Metern
const FOLGEN = 0.15; // so weit schwenkt die Kamera der Figur nach (Anteil)

/** Hülle: 3D, wenn das Gerät es kann und niemand auf den Plan umgeschaltet hat */
export function Wohnung3D(p: Props) {
  const [dreiD, setDreiD] = useState<boolean | null>(null);
  useEffect(() => {
    let an = typeof window !== "undefined" && "WebGL2RenderingContext" in window;
    try { if (localStorage.getItem(ANSICHT) === "plan") an = false; } catch { /* egal */ }
    setDreiD(an);
  }, []);
  const umschalten = (an: boolean) => { setDreiD(an); try { localStorage.setItem(ANSICHT, an ? "3d" : "plan"); } catch { /* egal */ } };
  const kann = typeof window !== "undefined" && "WebGL2RenderingContext" in window;
  return (
    <div className="relative h-full w-full">
      {dreiD ? <Szene {...p} /> : <Wohnungsbild {...p} />}
      {kann && dreiD !== null && (
        <button type="button" onClick={() => umschalten(!dreiD)}
          className={`absolute top-2 ${dreiD ? "left-20" : "left-2"} rounded-lg bg-slate-900/85 px-2 py-1 text-xs font-bold text-white ring-1 ring-white/15 hover:bg-slate-800`}>
          {dreiD ? "🗺️ Plan" : "🧊 3D"}
        </button>
      )}
    </div>
  );
}

// ── Bausteine ────────────────────────────────────────────────────────────

function mat(farbe: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color: farbe, ...extra });
}
/** Quader mit Unterkante bei y, Mitte bei x/z */
function q(g: THREE.Object3D, farbe: number | THREE.Material, b: number, h: number, t: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), typeof farbe === "number" ? mat(farbe) : farbe);
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}
function zyl(g: THREE.Object3D, farbe: number, r: number, h: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat(farbe));
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

const emojiTex = new Map<string, THREE.CanvasTexture>();
function emoji(z: string, groesse: number) {
  if (!emojiTex.has(z)) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.font = "100px serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(z, 64, 72);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData.geteilt = true;
    emojiTex.set(z, t);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex.get(z)!, depthWrite: false }));
  sp.scale.setScalar(groesse);
  return sp;
}

const HOLZ = 0xb07a4a, DUNKELHOLZ = 0x6b4426, WEISS = 0xf1f5f9, GRAU = 0x94a3b8, SCHWARZ = 0x1f2937, METALL = 0xcbd5e1;

/** Ein Möbel aus einfachen Körpern; Ursprung = Mitte der Grundfläche auf dem Boden, b entlang x, t entlang z */
function baueMoebel(m: Gestellt, farbe: number): THREE.Group {
  const g = new THREE.Group();
  const b = m.b / 100, t = m.t / 100, id = m.id;
  const hat = (...w: string[]) => w.some((x) => id.includes(x));
  const quer = b > t; // lange Seite entlang x → Rückseite/Kopf an -z, sonst an -x
  const rueck = (dicke: number, h: number, y = 0) => quer ? q(g, DUNKELHOLZ, b, h, dicke, 0, y, -t / 2 + dicke / 2) : q(g, DUNKELHOLZ, dicke, h, t, -b / 2 + dicke / 2, y, 0);

  if (hat("schlafsofa", "sofa")) {
    const stoff = 0x64748b;
    q(g, stoff, b, 0.42, t);
    const lehne = quer ? q(g, stoff, b, 0.45, 0.22, 0, 0.42, -t / 2 + 0.11) : q(g, stoff, 0.22, 0.45, t, -b / 2 + 0.11, 0.42, 0);
    lehne.userData.lehne = true;
    for (const s of [-1, 1]) quer ? q(g, stoff, 0.18, 0.2, t, s * (b / 2 - 0.09), 0.42, 0) : q(g, stoff, b, 0.2, 0.18, 0, 0.42, s * (t / 2 - 0.09));
    for (const s of [-0.25, 0.25]) quer ? q(g, farbe, 0.35, 0.3, 0.12, s * b, 0.45, -t / 2 + 0.3) : q(g, farbe, 0.12, 0.3, 0.35, -b / 2 + 0.3, 0.45, s * t);
  } else if (hat("bett", "matratze")) {
    const rahmen = hat("matratze") ? 0 : 0.25;
    if (rahmen) q(g, HOLZ, b, rahmen, t);
    q(g, WEISS, b - 0.06, 0.2, t - 0.06, 0, rahmen);
    const kopf = quer ? new THREE.Vector3(-b / 2 + 0.3, 0, 0) : new THREE.Vector3(0, 0, -t / 2 + 0.3);
    quer ? q(g, 0xffffff, 0.35, 0.12, t * 0.7, kopf.x, rahmen + 0.2, 0) : q(g, 0xffffff, b * 0.7, 0.12, 0.35, 0, rahmen + 0.2, kopf.z);
    quer ? q(g, farbe, b * 0.6, 0.08, t - 0.04, b * 0.18, rahmen + 0.18, 0) : q(g, farbe, b - 0.04, 0.08, t * 0.6, 0, rahmen + 0.18, t * 0.18);
    if (rahmen) rueck(0.08, 0.8);
  } else if (hat("schrank-pax", "e-schrank", "kleiderschrank")) {
    q(g, WEISS, b, 2.0, t);
    for (const s of [-1, 1]) quer ? q(g, GRAU, 0.04, 0.25, 0.03, s * 0.06, 1.0, t / 2) : q(g, GRAU, 0.03, 0.25, 0.04, b / 2, 1.0, s * 0.06);
  } else if (hat("kommode", "tv-board", "schuhregal", "badezimmerschrank", "regal")) {
    const h = hat("regal-kallax") ? 1.47 : hat("tv-board") ? 0.45 : hat("schuhregal") ? 0.5 : 0.8;
    const y = hat("badezimmerschrank") ? 1.1 : 0;
    q(g, hat("regal", "tv-board") ? WEISS : HOLZ, b, hat("badezimmerschrank") ? 0.6 : h, t, 0, y);
    if (hat("regal-kallax")) for (const s of [-1, 1]) quer ? q(g, s < 0 ? 0xef4444 : 0x3b82f6, 0.25, 0.28, 0.02, s * 0.15, 0.4, t / 2) : q(g, s < 0 ? 0xef4444 : 0x3b82f6, 0.02, 0.28, 0.25, b / 2, 0.4, s * 0.15);
  } else if (hat("kleiderstange")) {
    for (const s of [-1, 1]) zyl(g, METALL, 0.02, 1.6, quer ? s * b / 2 : 0, 0, quer ? 0 : s * t / 2);
    if (quer) q(g, METALL, b, 0.03, 0.03, 0, 1.55); else q(g, METALL, 0.03, 0.03, t, 0, 1.55);
    for (const s of [-0.25, 0, 0.25]) quer ? q(g, farbe, 0.08, 0.7, 0.4, s * b, 0.8) : q(g, farbe, 0.4, 0.7, 0.08, 0, 0.8, s * t);
  } else if (hat("burostuhl")) {
    zyl(g, SCHWARZ, 0.03, 0.45);
    zyl(g, SCHWARZ, 0.24, 0.07, 0, 0.45);
    q(g, SCHWARZ, 0.42, 0.45, 0.06, 0, 0.52, -0.2);
  } else if (hat("tisch", "e-tisch")) {
    const h = hat("couchtisch") ? 0.42 : 0.75;
    q(g, hat("couchtisch") ? DUNKELHOLZ : HOLZ, b, 0.05, t, 0, h - 0.05);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) q(g, DUNKELHOLZ, 0.05, h - 0.05, 0.05, sx * (b / 2 - 0.05), 0, sz * (t / 2 - 0.05));
    if (hat("schreibtisch") || id === "e-tisch") {
      q(g, SCHWARZ, 0.55, 0.34, 0.04, 0, h + 0.1, -t / 2 + 0.12);
      q(g, 0x38bdf8, 0.5, 0.29, 0.01, 0, h + 0.125, -t / 2 + 0.145).userData.bildschirm = true;
      q(g, SCHWARZ, 0.06, 0.1, 0.06, 0, h, -t / 2 + 0.12);
    }
    if (hat("esstisch", "e-tisch2")) {
      for (const s of [-1, 1]) {
        const st = new THREE.Group();
        q(st, HOLZ, 0.4, 0.04, 0.4, 0, 0.44);
        q(st, HOLZ, 0.4, 0.45, 0.04, 0, 0.48, -0.18);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) q(st, DUNKELHOLZ, 0.04, 0.44, 0.04, sx * 0.17, 0, sz * 0.17);
        if (quer) { st.position.x = s * (b / 2 + 0.15); st.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; }
        else { st.position.z = s * (t / 2 + 0.15); st.rotation.y = s > 0 ? Math.PI : 0; }
        g.add(st);
      }
    }
  } else if (hat("fernseher")) {
    q(g, WEISS, b, 0.45, t);
    q(g, SCHWARZ, b * 0.95, 0.55, 0.05, 0, 0.5, 0);
    q(g, 0x1e3a8a, b * 0.9, 0.5, 0.01, 0, 0.525, 0.03).userData.bildschirm = true;
  } else if (hat("teppich")) {
    q(g, 0xc4b5fd, b, 0.015, t);
  } else if (hat("fussmatte", "badematte")) {
    q(g, hat("bade") ? 0x7dd3fc : 0x92400e, b, 0.015, t);
  } else if (hat("stehlampe")) {
    zyl(g, SCHWARZ, 0.12, 0.03);
    zyl(g, SCHWARZ, 0.015, 1.5);
    const schirm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 18), mat(0xfef3c7));
    schirm.position.y = 1.55; schirm.userData.leuchte = true;
    g.add(schirm);
  } else if (hat("spiegel")) {
    quer ? q(g, 0xbae6fd, b, 0.8, 0.03, 0, 1.0, -t / 2) : q(g, 0xbae6fd, 0.03, 0.8, t, -b / 2, 1.0, 0);
  } else if (hat("kuehlschrank", "e-kuehl")) {
    const h = hat("mini") ? 0.85 : 1.8;
    q(g, WEISS, b, h, t);
    q(g, GRAU, b, 0.015, 0.01, 0, h * 0.62, t / 2);
  } else if (hat("standherd")) {
    q(g, WEISS, b, 0.85, t);
    q(g, SCHWARZ, b, 0.02, t, 0, 0.85);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) zyl(g, 0x475569, 0.08, 0.01, sx * b / 4, 0.87, sz * t / 4);
    q(g, SCHWARZ, b * 0.8, 0.4, 0.01, 0, 0.25, t / 2);
  } else if (hat("einbaukueche", "e-kueche")) {
    zeile(g, b, t);
  } else if (hat("spuelmaschine", "waschmaschine", "waschetrockner", "e-wm")) {
    q(g, WEISS, b, 0.85, t);
    if (!hat("spuel")) {
      const tuer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), mat(0x334155));
      tuer.rotation.x = Math.PI / 2; tuer.position.set(0, 0.45, t / 2 + 0.01);
      g.add(tuer);
    }
  } else if (hat("mikrowelle", "kaffeemaschine")) {
    q(g, HOLZ, b, 0.75, t);
    q(g, hat("kaffee") ? SCHWARZ : WEISS, b * 0.9, hat("kaffee") ? 0.35 : 0.3, t * 0.85, 0, 0.75);
  } else if (hat("e-dusche")) {
    dusche(g, b, t);
  } else if (hat("waeschekorb")) {
    zyl(g, 0xd6d3d1, b / 2, 0.5);
  } else if (hat("waeschestaender")) {
    for (const s of [-1, 1]) q(g, METALL, 0.02, 0.9, t, s * b / 2, 0, 0);
    for (let i = 0; i < 4; i++) q(g, METALL, b, 0.01, 0.01, 0, 0.9, -t / 2 + (i + 0.5) * t / 4);
  } else if (hat("staubsauger")) {
    q(g, 0xef4444, b, 0.25, t);
    zyl(g, SCHWARZ, 0.015, 0.9, 0, 0.25, 0);
  } else if (hat("muelleimer")) {
    [0xfacc15, 0x3b82f6, 0x6b7280].forEach((f, i) => zyl(g, f, 0.07, 0.4, -b / 3 + (i * b) / 3, 0, 0));
  } else if (hat("garderobe")) {
    zyl(g, DUNKELHOLZ, 0.03, 1.8);
    for (const s of [-1, 1]) q(g, farbe, 0.3, 0.6, 0.1, s * 0.1, 1.0, 0);
  } else if (hat("fahrrad")) {
    for (const s of [-1, 1]) {
      const rad = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 24), mat(SCHWARZ));
      rad.position.set(quer ? s * 0.35 : 0, 0.3, quer ? 0 : s * 0.35);
      if (!quer) rad.rotation.y = Math.PI / 2;
      g.add(rad);
    }
    quer ? q(g, farbe, 0.7, 0.04, 0.04, 0, 0.55) : q(g, farbe, 0.04, 0.04, 0.7, 0, 0.55);
  } else {
    q(g, HOLZ, b, 0.5, t);
  }
  if (m.defekt) { const w = emoji("⚠️", 0.45); w.position.y = 1.3; g.add(w); }
  return g;
}

function zeile(g: THREE.Object3D, b: number, t: number) {
  q(g, WEISS, b, 0.86, t);
  q(g, 0x78350f, b + 0.02, 0.04, t + 0.02, 0, 0.86);
  q(g, METALL, 0.5, 0.01, t * 0.6, b * 0.1, 0.9, 0);
  q(g, SCHWARZ, 0.6, 0.01, t * 0.7, -b / 2 + 0.45, 0.9, 0);
  q(g, WEISS, b, 0.6, 0.35, 0, 1.5, -t / 2 + 0.175);
  for (let x = -b / 2 + 0.3; x < b / 2; x += 0.6) q(g, GRAU, 0.02, 0.5, 0.01, x, 0.15, t / 2 + 0.005);
}

function dusche(g: THREE.Object3D, b: number, t: number) {
  q(g, WEISS, b, 0.08, t);
  const glas = mat(0x7dd3fc, { transparent: true, opacity: 0.35 });
  q(g, glas, b, 1.2, 0.02, 0, 0.08, t / 2);
  q(g, glas, 0.02, 1.2, t, -b / 2, 0.08, 0);
  q(g, METALL, b, 0.04, 0.04, 0, 1.28, t / 2);
  q(g, METALL, 0.04, 0.04, t, -b / 2, 1.28, 0);
  zyl(g, METALL, 0.015, 1.9, b / 2 - 0.08, 0, -t / 2 + 0.08);
  zyl(g, METALL, 0.09, 0.03, b / 2 - 0.2, 1.85, -t / 2 + 0.2);
}

/** WC und Waschbecken (stehen in jedem Bad) */
function badFest(r: Raum, eltern: boolean): THREE.Group {
  const g = new THREE.Group();
  const x0 = r.x / 100, z0 = r.y / 100, b = r.b / 100, t = r.t / 100;
  const wc = new THREE.Group();
  q(wc, WEISS, 0.38, 0.4, 0.5); q(wc, WEISS, 0.4, 0.35, 0.16, 0, 0.4, -0.2);
  wc.position.set(x0 + b - 0.35, 0, z0 + t - 0.4); wc.rotation.y = -Math.PI / 2;
  const becken = new THREE.Group();
  zyl(becken, WEISS, 0.06, 0.8); q(becken, WEISS, 0.55, 0.12, 0.42, 0, 0.8); q(becken, 0xbae6fd, 0.45, 0.6, 0.02, 0, 1.0, -0.2);
  becken.position.set(x0 + b * 0.62, 0, z0 + 0.3);
  g.add(wc, becken);
  if (!eltern) { const d = new THREE.Group(); dusche(d, 0.9, 0.9); d.position.set(x0 + b - 0.5, 0, z0 + 0.5); g.add(d); }
  return g;
}

// ── Grundriss → Türen, Wände ────────────────────────────────────────────

type Tuer = { a: string; b: string; x: number; z: number; quer: boolean }; // Mitte in m; quer = Wand läuft entlang x

function tueren(raeume: Raum[]): Tuer[] {
  const kand: (Tuer & { laenge: number })[] = [];
  for (let i = 0; i < raeume.length; i++) for (let j = i + 1; j < raeume.length; j++) {
    const A = raeume[i], B = raeume[j];
    const senk = [A.x + A.b, A.x].find((x) => Math.abs(x - B.x) < 1 || Math.abs(x - (B.x + B.b)) < 1);
    if (senk !== undefined) {
      const lo = Math.max(A.y, B.y), hi = Math.min(A.y + A.t, B.y + B.t);
      if (hi - lo >= 100) kand.push({ a: A.id, b: B.id, x: senk / 100, z: (lo + hi) / 200, quer: false, laenge: hi - lo });
    }
    const waag = [A.y + A.t, A.y].find((y) => Math.abs(y - B.y) < 1 || Math.abs(y - (B.y + B.t)) < 1);
    if (waag !== undefined) {
      const lo = Math.max(A.x, B.x), hi = Math.min(A.x + A.b, B.x + B.b);
      if (hi - lo >= 100) kand.push({ a: A.id, b: B.id, x: (lo + hi) / 200, z: waag / 100, quer: true, laenge: hi - lo });
    }
  }
  // Der Flur verbindet alles, was an ihn grenzt; übrige Räume hängen am längsten gemeinsamen Wandstück
  const wahl = kand.filter((k) => k.a === "flur" || k.b === "flur");
  const drin = new Set(["flur", ...wahl.flatMap((k) => [k.a, k.b])]);
  for (;;) {
    const k = kand.filter((c) => drin.has(c.a) !== drin.has(c.b)).sort((x, y) => y.laenge - x.laenge)[0];
    if (!k) break;
    wahl.push(k); drin.add(k.a); drin.add(k.b);
  }
  return wahl;
}

function raumVon(raeume: Raum[], x: number, z: number) {
  return raeume.find((r) => x >= r.x / 100 - 0.01 && x <= (r.x + r.b) / 100 + 0.01 && z >= r.y / 100 - 0.01 && z <= (r.y + r.t) / 100 + 0.01) ?? raeume[0];
}

/** Wegpunkte von a nach b durch die Türen (Breitensuche über Räume) */
function weg(raeume: Raum[], tuer: Tuer[], von: THREE.Vector3, nach: THREE.Vector3): THREE.Vector3[] {
  const start = raumVon(raeume, von.x, von.z).id, ziel = raumVon(raeume, nach.x, nach.z).id;
  const vor = new Map<string, { raum: string; tuer: Tuer } | null>([[start, null]]);
  const schlange = [start];
  while (schlange.length) {
    const r = schlange.shift()!;
    if (r === ziel) break;
    for (const t of tuer) {
      const n = t.a === r ? t.b : t.b === r ? t.a : null;
      if (n && !vor.has(n)) { vor.set(n, { raum: r, tuer: t }); schlange.push(n); }
    }
  }
  const kette: { tuer: Tuer; nach: string }[] = [];
  for (let r = ziel; vor.get(r); r = vor.get(r)!.raum) kette.unshift({ tuer: vor.get(r)!.tuer, nach: r });
  const punkte = [von.clone()];
  for (const { tuer: t, nach: n } of kette) {
    const rn = raeume.find((r) => r.id === n)!;
    const rein = t.quer ? Math.sign(rn.y / 100 + rn.t / 200 - t.z) : Math.sign(rn.x / 100 + rn.b / 200 - t.x);
    const d = 0.45;
    punkte.push(t.quer ? new THREE.Vector3(t.x, 0, t.z - rein * d) : new THREE.Vector3(t.x - rein * d, 0, t.z));
    punkte.push(t.quer ? new THREE.Vector3(t.x, 0, t.z + rein * d) : new THREE.Vector3(t.x + rein * d, 0, t.z));
  }
  punkte.push(nach.clone());
  return punkte.filter((p, i) => i === 0 || p.distanceTo(punkte[i - 1]) > 0.05);
}

function baueWelt(s: Spielstand, raeume: Raum[], gestellt: Gestellt[], kisten: string[], tuer: Tuer[]) {
  const welt = new THREE.Group();
  const breite = Math.max(...raeume.map((r) => r.x + r.b)) / 100, tiefe = Math.max(...raeume.map((r) => r.y + r.t)) / 100;
  // Bodenplatte unter allem (Wanddicke)
  q(welt, 0x475569, breite + WAND * 2, 0.08, tiefe + WAND * 2, breite / 2, -0.09, tiefe / 2);
  for (const r of raeume) {
    const boden = q(welt, Number.parseInt(r.boden.slice(1), 16), r.b / 100, 0.02, r.t / 100, (r.x + r.b / 2) / 100, -0.02, (r.y + r.t / 2) / 100);
    boden.userData.boden = true;
  }
  // Wände: jede Raumkante, an Türen unterbrochen; die hinteren Außenwände hoch
  const flur = raeume.find((r) => r.id === "flur");
  const eingang = flur && Math.abs((flur.y + flur.t) / 100 - tiefe) < 0.01 ? { x: (flur.x + flur.b / 2) / 100, z: tiefe } : null;
  const wandMat = mat(0xe7e5e4), aussenMat = mat(0xd6d3d1), fensterMat = mat(0x7dd3fc);
  const gezogen = new Set<string>();
  const stueck = (x1: number, z1: number, x2: number, z2: number) => {
    const quer = Math.abs(z1 - z2) < 1e-6;
    const lo = quer ? Math.min(x1, x2) : Math.min(z1, z2), hi = quer ? Math.max(x1, x2) : Math.max(z1, z2);
    const fest = quer ? z1 : x1;
    const loecher = [...tuer.filter((t) => t.quer === quer && Math.abs((quer ? t.z : t.x) - fest) < 0.01).map((t) => (quer ? t.x : t.z)),
      ...(eingang && quer && Math.abs(fest - eingang.z) < 0.01 ? [eingang.x] : [])].filter((m) => m > lo && m < hi).sort((a, b) => a - b);
    const hinten = (quer && fest < 0.01) || (!quer && fest < 0.01);
    const h = hinten ? HOCH : NIEDRIG;
    let a = lo;
    for (const m of [...loecher, null]) {
      const e = m === null ? hi : m - TUER / 2;
      if (e - a > 0.02) {
        const key = `${quer}|${fest.toFixed(2)}|${a.toFixed(2)}|${e.toFixed(2)}`;
        if (!gezogen.has(key)) {
          gezogen.add(key);
          const len = e - a + (hinten ? WAND : 0);
          const w = quer ? q(welt, hinten ? aussenMat : wandMat, len, h, WAND, (a + e) / 2, 0, fest) : q(welt, hinten ? aussenMat : wandMat, WAND, h, len, fest, 0, (a + e) / 2);
          w.userData.wand = true;
          // Fenster in der hinteren Wand
          if (hinten && e - a > 1.6) {
            const fb = Math.min(1.4, (e - a) * 0.4);
            const f = quer ? q(welt, fensterMat, fb, 1.1, WAND + 0.02, (a + e) / 2, 0.95, fest) : q(welt, fensterMat, WAND + 0.02, 1.1, fb, fest, 0.95, (a + e) / 2);
            f.userData.fenster = true;
          }
        }
      }
      if (m !== null) a = m + TUER / 2;
    }
  };
  for (const r of raeume) {
    const x1 = r.x / 100, z1 = r.y / 100, x2 = (r.x + r.b) / 100, z2 = (r.y + r.t) / 100;
    stueck(x1, z1, x2, z1); stueck(x1, z2, x2, z2); stueck(x1, z1, x1, z2); stueck(x2, z1, x2, z2);
  }
  if (eingang) q(welt, 0x92400e, 0.8, 0.015, 0.4, eingang.x, 0, eingang.z - 0.3);

  // Möbel
  const moebel: THREE.Group[] = [];
  for (const m of gestellt) {
    const g = baueMoebel(m, Number.parseInt(s.figur.farbe.slice(1), 16) || 0xf59e0b);
    g.position.set((m.x + m.b / 2) / 100, 0, (m.y + m.t / 2) / 100);
    g.userData.moebel = m;
    welt.add(g); moebel.push(g);
  }
  // Einbauküche (eigene Wohnung) und feste Badsachen
  const kueche = raeume.find((r) => r.id === "kueche"), bad = raeume.find((r) => r.id === "bad");
  if (kueche && s.wohnung.ebk && s.wohnung.form !== "eltern") {
    const g = new THREE.Group(); zeile(g, kueche.b / 100 - 0.2, 0.6);
    g.position.set((kueche.x + kueche.b / 2) / 100, 0, kueche.y / 100 + 0.4);
    welt.add(g);
  }
  if (bad) welt.add(badFest(bad, s.wohnung.form === "eltern"));
  // Kleinkram ohne Stellfläche: Umzugskartons in der Küche
  if (kisten.length && kueche) {
    for (let i = 0; i < Math.min(6, Math.ceil(kisten.length / 3)); i++) {
      const k = q(welt, 0xc8a165, 0.45, 0.32, 0.35, kueche.x / 100 + 0.4 + (i % 3) * 0.5, Math.floor(i / 3) * 0.32, (kueche.y + kueche.t) / 100 - 0.35);
      k.rotation.y = (i % 2) * 0.2;
    }
  }
  toonStil(welt, 0.012);
  // Unordnung (nach dem Toon-Stil: Sprites haben keinen Umriss)
  const ordnung = s.beduerfnisse.ordnung;
  const n = ordnung < 15 ? 12 : ordnung < 30 ? 8 : ordnung < 50 ? 4 : 0;
  const zeichen = ["🧦", "📦", "🍕", "🥤", "👕", "🗞️", "🍌", "🧃"];
  const zufall = (i: number) => ((Math.sin(i * 12.9898 + s.wohnung.einzug) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < n; i++) {
    const rm = raeume[Math.floor(zufall(i) * raeume.length)];
    const sp = emoji(zeichen[i % zeichen.length], 0.32);
    sp.position.set((rm.x + 30 + zufall(i + 7) * (rm.b - 60)) / 100, 0.14, (rm.y + 30 + zufall(i + 13) * (rm.t - 60)) / 100);
    welt.add(sp);
  }
  if (ordnung < 15) { const f = emoji("🪰", 0.3); f.position.set(raeume[0].x / 100 + raeume[0].b / 200, 1.4, raeume[0].y / 100 + 0.8); welt.add(f); }
  // Licht je Raum (nachts an, wenn es Lampen gibt)
  const lampen: THREE.PointLight[] = [];
  for (const r of raeume) {
    const l = new THREE.PointLight(0xffd59a, 0, 7, 1.4);
    l.position.set((r.x + r.b / 2) / 100, 2.2, (r.y + r.t / 2) / 100);
    welt.add(l); lampen.push(l);
  }
  return { welt, moebel, lampen, breite, tiefe };
}

// ── Szene ────────────────────────────────────────────────────────────────

function Szene({ s, platz, onVerschieben }: Props) {
  const huelle = useRef<HTMLDivElement>(null);
  const [avatar, setAvatar] = useState<Avatar>(() => ladeAvatar());
  const raeume = useMemo(() => grundriss(s), [s.wohnung.id, s.wohnung.qm, s.wohnung.form, s.wohnung.zimmer, s.wohnung.ebk]); // eslint-disable-line react-hooks/exhaustive-deps
  const { gestellt, kisten } = useMemo(() => einrichtung(s, raeume), [s.moebel, raeume, s.wohnung.form]); // eslint-disable-line react-hooks/exhaustive-deps
  const tuer = useMemo(() => tueren(raeume), [raeume]);
  const ziel = zielPunkt(platz, gestellt, raeume);
  const ordnungsStufe = s.beduerfnisse.ordnung < 15 ? 3 : s.beduerfnisse.ordnung < 30 ? 2 : s.beduerfnisse.ordnung < 50 ? 1 : 0;

  // Alles, was die Zeichenschleife liest
  const lage = useRef({
    s, platz, onVerschieben, raeume, tuer,
    kurve: null as THREE.CatmullRomCurve3 | null, t: 0, laenge: 0,
    liegen: null as null | { y: number; drehung: number },
    blickZiel: 0,
    /** Blickrichtung nach der Ankunft (vor dem Sofa) */
    endBlick: null as number | null,
  });
  Object.assign(lage.current, { s, platz, onVerschieben, raeume, tuer });

  const drei = useRef<{
    szene: THREE.Scene; traeger: THREE.Group; figur: THREE.Group | null; blase: THREE.Sprite | null;
    welt: ReturnType<typeof baueWelt> | null; himmel: THREE.HemisphereLight; sonne: THREE.DirectionalLight;
    passe: () => void;
  } | null>(null);

  // ── einmalig: Renderer, Kamera, Schleife, Ziehen ─────────────────────────
  useEffect(() => {
    const el = huelle.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });

    const szene = new THREE.Scene();
    const himmel = new THREE.HemisphereLight(0xffffff, 0x8b7355, 1.5);
    const sonne = new THREE.DirectionalLight(0xfff1d6, 1.3);
    szene.add(himmel, sonne, sonne.target);
    const traeger = new THREE.Group(); // Ort + Blickrichtung; darin die Figur (Liegen kippt nur die Figur)
    szene.add(traeger);
    const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    const richtung = new THREE.Vector3(1, 1.25, 1.55).normalize();
    const blick = new THREE.Vector3(), blickSoll = new THREE.Vector3();
    let halb = { b: 5, h: 3 };

    const passe = () => {
      const b = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(b, h, false);
      const w = drei.current?.welt;
      if (!w) return;
      // Kamera so, dass die ganze Wohnung (mit hohen Wänden) hineinpasst
      const mitte = new THREE.Vector3(w.breite / 2, 0.6, w.tiefe / 2);
      kamera.position.copy(mitte).addScaledVector(richtung, 40);
      kamera.lookAt(mitte);
      kamera.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const x of [0, w.breite]) for (const y of [0, HOCH]) for (const z of [0, w.tiefe]) {
        const p = new THREE.Vector3(x, y, z).applyMatrix4(kamera.matrixWorldInverse);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      const rand = 0.35 + FOLGEN * Math.max(w.breite, w.tiefe) / 2;
      let hb = (maxX - minX) / 2 + rand, hh = (maxY - minY) / 2 + rand;
      if (hb / hh > b / h) hh = hb / (b / h); else hb = hh * (b / h);
      halb = { b: hb, h: hh };
      blick.copy(mitte); blickSoll.copy(mitte);
    };
    const ro = new ResizeObserver(passe);
    ro.observe(el);
    drei.current = { szene, traeger, figur: null, blase: null, welt: null, himmel, sonne, passe };

    // Möbel ziehen (Boden-Ebene), Doppelklick dreht
    const strahl = new THREE.Raycaster(), boden = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const zeiger = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      strahl.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), kamera);
    };
    const getroffen = (e: PointerEvent | MouseEvent) => {
      zeiger(e as PointerEvent);
      const moebel = drei.current?.welt?.moebel.filter((g) => (g.userData.moebel as Gestellt).uid > 0) ?? [];
      const hit = strahl.intersectObjects(moebel, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData.moebel) o = o.parent;
      return o as THREE.Group | null;
    };
    let zug: { g: THREE.Group; dx: number; dz: number } | null = null;
    const runter = (e: PointerEvent) => {
      if (!lage.current.onVerschieben) return;
      const g = getroffen(e);
      if (!g) return;
      const p = strahl.ray.intersectPlane(boden, new THREE.Vector3());
      if (!p) return;
      zug = { g, dx: g.position.x - p.x, dz: g.position.z - p.z };
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const ziehen = (e: PointerEvent) => {
      if (!zug) {
        renderer.domElement.style.cursor = lage.current.onVerschieben && getroffen(e) ? "grab" : "";
        return;
      }
      zeiger(e);
      const p = strahl.ray.intersectPlane(boden, new THREE.Vector3());
      if (p) zug.g.position.set(p.x + zug.dx, 0, p.z + zug.dz);
    };
    const hoch = () => {
      if (!zug) return;
      const m = zug.g.userData.moebel as Gestellt;
      lage.current.onVerschieben?.(m.uid, Math.round(zug.g.position.x * 100 - m.b / 2), Math.round(zug.g.position.z * 100 - m.t / 2));
      zug = null;
      renderer.domElement.style.cursor = "";
    };
    const doppel = (e: MouseEvent) => {
      const g = getroffen(e);
      if (!g) return;
      const m = g.userData.moebel as Gestellt;
      lage.current.onVerschieben?.(m.uid, m.x, m.y, true);
    };
    renderer.domElement.addEventListener("pointerdown", runter);
    renderer.domElement.addEventListener("pointermove", ziehen);
    renderer.domElement.addEventListener("pointerup", hoch);
    renderer.domElement.addEventListener("dblclick", doppel);

    const uhr = new THREE.Clock();
    let bild = 0;
    const takt = () => {
      bild = requestAnimationFrame(takt);
      const dt = Math.min(0.1, uhr.getDelta());
      const l = lage.current, d = drei.current!;
      tickAvatare();
      // Laufen auf der Kurve
      if (l.kurve) {
        l.t = Math.min(1, l.t + (dt * TEMPO) / Math.max(0.01, l.laenge));
        // weich anfahren und abbremsen
        const u = l.t < 1 ? l.t * l.t * (3 - 2 * l.t) * 0.35 + l.t * 0.65 : 1;
        const p = l.kurve.getPointAt(u), tan = l.kurve.getTangentAt(Math.min(0.999, u));
        traeger.position.set(p.x, 0, p.z);
        if (tan.lengthSq() > 1e-6) l.blickZiel = Math.atan2(tan.x, tan.z);
        if (l.t >= 1) {
          l.kurve = null;
          if (d.figur) bewegeAvatar(d.figur.userData.avatar as THREE.Group, "idle");
        }
      }
      // Drehen (kürzester Weg)
      const soll = l.kurve ? l.blickZiel : l.liegen?.drehung ?? l.endBlick ?? l.blickZiel;
      let diff = soll - traeger.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      traeger.rotation.y += diff * Math.min(1, dt * 10);
      // Liegen: Figur kippt sanft aufs Bett
      if (d.figur) {
        const liegt = !l.kurve && !!l.liegen;
        d.figur.rotation.x += ((liegt ? -Math.PI / 2 : 0) - d.figur.rotation.x) * Math.min(1, dt * 6);
        d.figur.position.y += ((liegt ? l.liegen!.y : 0) - d.figur.position.y) * Math.min(1, dt * 6);
      }
      if (d.blase) d.blase.position.set(traeger.position.x, FIGUR + 0.35, traeger.position.z);
      // Kamera folgt der Figur ein Stück (weicher Schwenk in den nächsten Raum)
      if (d.welt) {
        blickSoll.set(d.welt.breite / 2 + (traeger.position.x - d.welt.breite / 2) * FOLGEN, 0.6, d.welt.tiefe / 2 + (traeger.position.z - d.welt.tiefe / 2) * FOLGEN);
        blick.lerp(blickSoll, Math.min(1, dt * 2.5));
        kamera.position.copy(blick).addScaledVector(richtung, 40);
        kamera.lookAt(blick);
        kamera.left = -halb.b; kamera.right = halb.b; kamera.top = halb.h; kamera.bottom = -halb.h;
        kamera.updateProjectionMatrix();
      }
      renderer.render(szene, kamera);
    };
    bild = requestAnimationFrame(takt);

    return () => {
      cancelAnimationFrame(bild);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", runter);
      renderer.domElement.removeEventListener("pointermove", ziehen);
      renderer.domElement.removeEventListener("pointerup", hoch);
      renderer.domElement.removeEventListener("dblclick", doppel);
      const d = drei.current;
      if (d?.figur) { beendeAvatar(d.figur); entsorge(d.figur); }
      if (d?.welt) entsorge(d.welt.welt);
      renderer.dispose();
      renderer.domElement.remove();
      drei.current = null;
    };
  }, []);

  // ── Welt neu bauen, wenn sich Grundriss, Möbel oder Unordnung ändern ──────
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    if (d.welt) { d.szene.remove(d.welt.welt); entsorge(d.welt.welt); }
    d.welt = baueWelt(lage.current.s, raeume, gestellt, kisten, tuer);
    d.szene.add(d.welt.welt);
    d.passe();
  }, [raeume, gestellt, kisten, tuer, ordnungsStufe, s.figur.farbe]);

  // ── Figur (neu bei anderer Avatar-Wahl) ─────────────────────────────────
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    if (d.figur) { beendeAvatar(d.figur); d.traeger.remove(d.figur); entsorge(d.figur); }
    const f = baueAvatar(avatar);
    // auf Körpergröße bringen (die gebaute Figur ist so hoch wie das Modell)
    const h = new THREE.Box3().setFromObject(f).getSize(new THREE.Vector3()).y || 1;
    const k = FIGUR / h;
    const innen = new THREE.Group();
    innen.add(f); innen.scale.setScalar(k);
    // Figur in der Gruppe f; Kippen beim Liegen dreht die äußere Gruppe um die Füße
    d.figur = innen;
    d.traeger.add(innen);
    bewegeAvatar(f, lage.current.kurve ? "lauf" : "idle");
    innen.userData.avatar = f;
    if (d.traeger.position.lengthSq() === 0) {
      const z = zielPunkt(lage.current.platz, gestellt, raeume);
      d.traeger.position.set(z.x / 100, 0, z.y / 100);
    }
  }, [avatar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zum neuen Platz laufen ───────────────────────────────────────────────
  const zielKey = `${platz}|${Math.round(ziel.x)}|${Math.round(ziel.y)}`;
  useEffect(() => {
    const d = drei.current, l = lage.current;
    if (!d) return;
    const m = ziel.moebel;
    let nach = new THREE.Vector3(ziel.x / 100, 0, ziel.y / 100);
    l.liegen = null; l.endBlick = null;
    if (m && platz === "bett") {
      // Die Figur kippt um die Füße nach hinten: Füße ans Fußende, Kopf landet auf dem Kissen (Kopfende an -z bzw. -x)
      const quer = m.b > m.t;
      l.liegen = { y: m.id.includes("matratze") ? 0.22 : 0.47, drehung: quer ? Math.PI / 2 : 0 };
      nach = quer ? new THREE.Vector3((m.x + m.b - 20) / 100, 0, (m.y + m.t / 2) / 100) : new THREE.Vector3((m.x + m.b / 2) / 100, 0, (m.y + m.t - 20) / 100);
    } else if (platz === "kueche") {
      // an die Arbeitsplatte (Küchenzeile an der hinteren Wand), Blick zur Wand
      const k = raeume.find((r) => r.id === "kueche");
      if (k) { nach = new THREE.Vector3((k.x + k.b * 0.3) / 100, 0, (k.y + 100) / 100); l.endBlick = Math.PI; }
    } else if (m && platz === "sofa") {
      // vor das Sofa stellen, Rücken zur Lehne
      const quer = m.b > m.t;
      nach = quer ? new THREE.Vector3((m.x + m.b / 2) / 100, 0, (m.y + m.t) / 100 + 0.35) : new THREE.Vector3((m.x + m.b) / 100 + 0.35, 0, (m.y + m.t / 2) / 100);
      l.endBlick = quer ? 0 : Math.PI / 2;
    }
    const von = d.traeger.position.clone();
    if (von.lengthSq() === 0) { d.traeger.position.copy(nach); return; }
    const punkte = weg(raeume, tuer, von, nach);
    if (punkte.length < 2) return;
    l.kurve = new THREE.CatmullRomCurve3(punkte, false, "centripetal", 0.5);
    l.laenge = l.kurve.getLength(); l.t = 0;
    const f = d.figur?.userData.avatar as THREE.Group | undefined;
    if (f) bewegeAvatar(f, l.laenge > 3 ? "rennen" : "lauf");
  }, [zielKey, raeume, tuer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tageszeit, Lampen, Bildschirme, Zustand über dem Kopf ────────────────
  const nacht = s.stunde < 6 || s.stunde >= 21;
  // bei den Eltern gibt es Lampen, sonst nur, wenn welche gekauft sind
  const licht = s.wohnung.form === "eltern" ? 1 : effekt(s, "licht");
  const blaseZeichen = platz === "bett" && nacht ? "💤" : s.zustand.kater && s.zustand.kater >= s.tag ? "🤕" : s.zustand.krank && s.zustand.krank.bis >= s.tag ? "🤒" : "";
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    const abend = s.stunde >= 18 && s.stunde < 21;
    d.himmel.intensity = nacht ? (licht > 0 ? 0.35 : 0.2) : abend ? 1.0 : 1.5;
    d.himmel.color.set(nacht ? 0x4455aa : abend ? 0xffd2a8 : 0xffffff);
    d.sonne.intensity = nacht ? 0.05 : abend ? 0.8 : 1.3;
    d.sonne.color.set(nacht ? 0x8899ff : abend ? 0xffb070 : 0xfff1d6);
    const w = d.welt;
    if (w) {
      // Sonne wandert von Ost nach West
      const a = ((s.stunde - 6) / 15) * Math.PI;
      d.sonne.position.set(w.breite / 2 + Math.cos(a) * 8, 10, w.tiefe / 2 - 6);
      d.sonne.target.position.set(w.breite / 2, 0, w.tiefe / 2);
      for (const l of w.lampen) l.intensity = nacht && licht > 0 ? 9 : 0;
      // Leuchten und Fenster (Markierung am Mesh — der Toon-Stil tauscht die Materialien)
      w.welt.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
        if (!m || !("emissive" in m)) return;
        if (o.userData.leuchte) { m.emissive.set(0xfde68a); m.emissiveIntensity = nacht && licht > 0 ? 1 : 0; }
        if (o.userData.fenster) { m.emissive.set(nacht ? 0x1e3a8a : 0xbae6fd); m.emissiveIntensity = nacht ? 0.3 : 0.5; }
      });
    }
    if (d.blase) { d.szene.remove(d.blase); d.blase.material.dispose(); d.blase = null; }
    if (blaseZeichen) { d.blase = emoji(blaseZeichen, 0.45); d.szene.add(d.blase); }
  }, [nacht, s.stunde, licht, blaseZeichen, raeume, gestellt, kisten, ordnungsStufe]); // eslint-disable-line react-hooks/exhaustive-deps

  const ohneKueche = s.wohnung.form === "wohnung" && !s.wohnung.ebk && !s.moebel.some((m) => ["standherd-backofen", "doppelkochplatte", "einbaukueche-kuchenzeile"].includes(m.id));
  return (
    <div className="relative h-full w-full bg-linear-to-b from-sky-200 to-amber-50" style={nacht ? { background: "linear-gradient(#0f172a, #1e293b)" } : undefined}>
      <div ref={huelle} className="h-full w-full" role="img" aria-label={`Wohnung in 3D: ${s.wohnung.titel}`} />
      <div className="absolute left-2 top-2 text-fg"><AvatarWahl avatar={avatar} onWahl={setAvatar} /></div>
      {ohneKueche && <div className="absolute bottom-2 left-2 rounded-lg bg-rose-600/90 px-2 py-1 text-xs font-bold text-white">Keine Küche: kochen unmöglich</div>}
    </div>
  );
}
