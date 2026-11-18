"use client";
/**
 * Reiter »Aufbau« — Stadtbau wie in Anno, in 2,5D:
 *   Mausrad zoomt vom einzelnen Haus bis zur ganzen Stadt (die Kamera kippt dabei flacher),
 *   rechte Maustaste oder Q/E dreht, ziehen oder W/A/S/D verschiebt.
 *   Gebäude wählen → Geist am Mauszeiger mit Werte-Kärtchen am Bauplatz und Einzugsbereich;
 *   Klick baut. Klick auf ein Gebäude zeigt seine Werte und seinen Einzugsbereich.
 * Häuser und Straßen wachsen feldgenau von selbst (lib/stadt/aufbau.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { BAUTEN, STILE, type BauTyp, type Stil } from "@/lib/stadt/modell";
import { BAUPLAENE, fehlt, jahrVonStand, kapazitaet, lageRegeln } from "@/lib/stadt/bauen";
import {
  baue, bauBei, beduerfnisse, fussabdruck, hausFarben, mitteVon, neueWelt, orteVon, pruefePlatz, reichweite, reisseAb, schritt, stufe,
  type Platzpruefung, type Welt,
} from "@/lib/stadt/aufbau";
import { ladeWeltModelle, weltModelle } from "@/components/gebaeude/frei/modelle";
import { ladeStadtModelle } from "../drei/modelle";
import { baueGelaende, hoeheGlatt } from "./gelaende";
import { AufbauObjekte } from "./objekte";

const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;
const zahl = (n: number) => Math.round(n).toLocaleString("de-DE");
const jahrText = (j: number) => (j < 0 ? `${-j} v. Chr.` : `${j}`);
const NAH = 25, FERN = 2600;
/** Neigung der Kamera über dem Boden je Abstand: nah fast seitlich, weit fast von oben */
const neigung = (d: number) => 0.42 + 0.68 * Math.max(0, Math.min(1, Math.log(d / NAH) / Math.log(FERN / NAH)));

interface Ziel { i: number; j: number; bau: BauTyp; pr: Platzpruefung }
interface Auswahl { id: number }

export default function Aufbau({ g, stil, setStil, aktiv = true }: { g: Gelaende; stil: Stil; setStil: (s: Stil) => void; aktiv?: boolean }) {
  const plan = BAUPLAENE[stil];
  const huelle = useRef<HTMLDivElement>(null);
  const karte = useRef<HTMLDivElement>(null);
  const welt = useRef<Welt>(neueWelt(g, stil, g.wahl.seed));
  const [, setVersion] = useState(0);
  const neuZeichnen = () => setVersion(v => v + 1);
  const [wahl, setWahl] = useState<BauTyp | "abriss" | null>(null);
  const [ziel, setZiel] = useState<Ziel | null>(null);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(1);
  const [raster, setRaster] = useState(true);
  const [laedt, setLaedt] = useState(true);
  const [ohneWebGL, setOhneWebGL] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const wahlRef = useRef(wahl); wahlRef.current = wahl;
  const rasterRef = useRef(raster); rasterRef.current = raster;
  const zielRef = useRef(ziel); zielRef.current = ziel;
  const auswahlRef = useRef(auswahl); auswahlRef.current = auswahl;
  const aktivRef = useRef(aktiv); aktivRef.current = aktiv;
  const drei = useRef<{
    renderer: THREE.WebGLRenderer; szene: THREE.Scene; kamera: THREE.PerspectiveCamera; sonne: THREE.DirectionalLight;
    gelaende: ReturnType<typeof baueGelaende> | null; objekte: AufbauObjekte | null; freiSumme: number;
    rig: { x: number; z: number; yaw: number; d: number; ziel: { x: number; z: number; yaw: number; d: number } }; tasten: Set<string>;
  } | null>(null);

  // neue Welt bei neuem Stadttyp oder Gelände
  useEffect(() => {
    welt.current = neueWelt(g, stil, g.wahl.seed);
    setWahl(null); setZiel(null); setAuswahl(null); setLaeuft(false); setMeldung(null);
    const d = drei.current;
    if (d?.objekte) d.objekte.aktualisiere(welt.current);
    if (d?.gelaende) { d.gelaende.setzeFrei(welt.current.frei); d.freiSumme = -1; }
    neuZeichnen();
  }, [g, stil]);

  // ── Renderer, Kamera, Eingaben, Schleife ──
  useEffect(() => {
    const el = karte.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setOhneWebGL(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = "none";
    renderer.domElement.style.touchAction = "none";
    el.appendChild(renderer.domElement);
    const szene = new THREE.Scene();
    szene.background = new THREE.Color(0xb7d4ea);
    szene.fog = new THREE.Fog(0xb7d4ea, 2500, 6000);
    const kamera = new THREE.PerspectiveCamera(42, 1, 1, 12000);
    szene.add(new THREE.HemisphereLight(0xeaf3ff, 0x5f6b45, 0.95));
    const sonne = new THREE.DirectionalLight(0xfff0d8, 2.8);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    sonne.shadow.bias = -0.0004;
    szene.add(sonne, sonne.target);
    const rig = { x: 0, z: 0, yaw: 0.6, d: 1400, ziel: { x: 0, z: 0, yaw: 0.6, d: 1400 } };
    drei.current = { renderer, szene, kamera, sonne, gelaende: null, objekte: null, freiSumme: -1, rig, tasten: new Set() };

    const groesse = () => { renderer.setSize(el.clientWidth, el.clientHeight); kamera.aspect = el.clientWidth / Math.max(1, el.clientHeight); kamera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(groesse);
    ro.observe(el);
    groesse();

    const strahl = new THREE.Raycaster(), maus = new THREE.Vector2();
    /** Bodenpunkt unter dem Zeiger (Karte in Metern) */
    const bodenBei = (cx: number, cy: number): { x: number; y: number } | null => {
      const d = drei.current;
      if (!d?.gelaende) return null;
      const r = renderer.domElement.getBoundingClientRect();
      maus.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      strahl.setFromCamera(maus, kamera);
      const t = strahl.intersectObjects(d.gelaende.gruppe.children.filter(o => o.userData.gelaende), false)[0];
      return t ? { x: t.point.x + g.breite / 2, y: t.point.z + g.breite / 2 } : null;
    };
    const zielFeld = (p: { x: number; y: number }, b: BauTyp) => {
      const { w, h } = fussabdruck(b);
      return { i: Math.round(p.x / g.zelle - w / 2), j: Math.round(p.y / g.zelle - h / 2) };
    };

    let griff: { x: number; y: number; knopf: number; weit: number } | null = null;
    const druck = (e: PointerEvent) => { renderer.domElement.focus(); griff = { x: e.clientX, y: e.clientY, knopf: e.button, weit: 0 }; renderer.domElement.setPointerCapture(e.pointerId); };
    const zug = (e: PointerEvent) => {
      const d = drei.current!;
      if (griff) {
        const dx = e.clientX - griff.x, dy = e.clientY - griff.y;
        griff.weit += Math.abs(dx) + Math.abs(dy);
        griff.x = e.clientX; griff.y = e.clientY;
        if (griff.knopf === 2 || griff.knopf === 1) d.rig.ziel.yaw -= dx * 0.006;
        else if (griff.weit > 5) {
          // verschieben: Bildschirmbewegung in Bodenrichtung, so weit wie der Abstand
          const f = d.rig.d / 900, s = Math.sin(d.rig.yaw), c = Math.cos(d.rig.yaw);
          d.rig.ziel.x -= (dx * c + dy * s) * f;
          d.rig.ziel.z -= (-dx * s + dy * c) * f;
        }
        return;
      }
      const b = wahlRef.current;
      if (!b || b === "abriss") return;
      const p = bodenBei(e.clientX, e.clientY);
      if (!p) return;
      const { i, j } = zielFeld(p, b);
      const z0 = zielRef.current;
      if (z0 && z0.i === i && z0.j === j && z0.bau === b) return;
      setZiel({ i, j, bau: b, pr: pruefePlatz(g, welt.current, b, i, j) });
    };
    const los = (e: PointerEvent) => {
      const gr = griff;
      griff = null;
      if (!gr || gr.weit > 5 || gr.knopf !== 0) return;
      const p = bodenBei(e.clientX, e.clientY);
      if (!p) return;
      const w = welt.current, b = wahlRef.current;
      if (b === "abriss") {
        const o = bauBei(w, Math.floor(p.x / g.zelle), Math.floor(p.y / g.zelle));
        if (o) { reisseAb(g, w, o.id); setMeldung(`🧽 ${BAUTEN[o.bau].label} abgerissen.`); drei.current?.objekte?.aktualisiere(w); neuZeichnen(); }
        return;
      }
      if (b) {
        const { i, j } = zielFeld(p, b);
        const pr = pruefePlatz(g, w, b, i, j);
        if (!pr.ok) { setMeldung(`❌ ${BAUTEN[b].label}: ${pr.gruende.filter(x => !x.ok).map(x => x.text).slice(0, 2).join(", ")}`); return; }
        const neu = baue(g, w, b, i, j)!;
        setMeldung(pr.faktor < 1 ? `⚠️ ${BAUTEN[b].label} steht ungünstig — wirkt nur zu ${Math.round(pr.faktor * 100)} %.` : `✅ ${BAUTEN[b].label} gebaut.`);
        setAuswahl({ id: neu.id });
        setWahl(null); setZiel(null);
        if (w.bauten.length === 1) setLaeuft(true);
        drei.current?.objekte?.aktualisiere(w);
        neuZeichnen();
        return;
      }
      const o = bauBei(w, Math.floor(p.x / g.zelle), Math.floor(p.y / g.zelle));
      setAuswahl(o ? { id: o.id } : null);
    };
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const d = drei.current!, alt = d.rig.ziel.d;
      const neu = Math.max(NAH, Math.min(FERN, alt * (e.deltaY > 0 ? 1.18 : 1 / 1.18)));
      // beim Hineinzoomen zum Zeiger hin
      const p = bodenBei(e.clientX, e.clientY);
      if (p && neu < alt) {
        const f = 1 - neu / alt;
        d.rig.ziel.x += (p.x - g.breite / 2 - d.rig.ziel.x) * f;
        d.rig.ziel.z += (p.y - g.breite / 2 - d.rig.ziel.z) * f;
      }
      d.rig.ziel.d = neu;
    };
    const runter = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") { setWahl(null); setZiel(null); setAuswahl(null); return; }
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); drei.current?.tasten.add(k); }
    };
    const hoch = (e: KeyboardEvent) => drei.current?.tasten.delete(e.key.toLowerCase());
    const c = renderer.domElement;
    const kein = (e: Event) => e.preventDefault();
    c.addEventListener("pointerdown", druck);
    c.addEventListener("pointermove", zug);
    c.addEventListener("pointerup", los);
    c.addEventListener("wheel", rad, { passive: false });
    c.addEventListener("contextmenu", kein);
    c.addEventListener("keydown", runter);
    c.addEventListener("keyup", hoch);
    c.addEventListener("blur", () => drei.current?.tasten.clear());

    const licht = new THREE.Vector3(-0.6, 0.6, -0.35).normalize(), blick = new THREE.Vector3(), bildschirm = new THREE.Vector3();
    let id = 0, zuletzt = performance.now();
    const bild = (jetzt: number) => {
      id = requestAnimationFrame(bild);
      const d = drei.current;
      if (!d || !aktivRef.current) return;
      const dt = Math.min(0.1, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      const r = d.rig, t = d.tasten, sp = r.ziel.d * 0.9 * dt;
      const vw = (t.has("w") || t.has("arrowup") ? 1 : 0) - (t.has("s") || t.has("arrowdown") ? 1 : 0);
      const sw = (t.has("d") || t.has("arrowright") ? 1 : 0) - (t.has("a") || t.has("arrowleft") ? 1 : 0);
      r.ziel.x += (-Math.sin(r.yaw) * vw + Math.cos(r.yaw) * sw) * sp;
      r.ziel.z += (-Math.cos(r.yaw) * vw - Math.sin(r.yaw) * sw) * sp;
      r.ziel.yaw += ((t.has("q") ? 1 : 0) - (t.has("e") ? 1 : 0)) * dt * 1.4;
      const h2 = g.breite / 2;
      r.ziel.x = Math.max(-h2, Math.min(h2, r.ziel.x)); r.ziel.z = Math.max(-h2, Math.min(h2, r.ziel.z));
      // weich nachführen
      const k = Math.min(1, dt * 9);
      r.x += (r.ziel.x - r.x) * k; r.z += (r.ziel.z - r.z) * k; r.yaw += (r.ziel.yaw - r.yaw) * k; r.d += (r.ziel.d - r.d) * k;
      const by = hoeheGlatt(g, r.x + h2, r.z + h2), p = neigung(r.d);
      kamera.position.set(r.x + Math.sin(r.yaw) * Math.cos(p) * r.d, by + Math.sin(p) * r.d, r.z + Math.cos(r.yaw) * Math.cos(p) * r.d);
      const unten = hoeheGlatt(g, kamera.position.x + h2, kamera.position.z + h2) + 3;
      if (kamera.position.y < unten) kamera.position.y = unten;
      kamera.lookAt(r.x, by, r.z);
      // Raster beim Bauen und nah dran, ausgeblendet von weit weg
      if (d.gelaende) d.gelaende.uniforms.uRaster.value = rasterRef.current ? Math.max(0, Math.min(1, (900 - r.d) / 500)) * (wahlRef.current ? 1 : 0.5) : 0;
      // Einzugsbereich: Geist oder gewähltes Gebäude
      const z0 = zielRef.current, a0 = auswahlRef.current, w = welt.current;
      let kreis: { x: number; y: number; r: number } | null = null;
      if (z0) { const { w: fw, h: fh } = fussabdruck(z0.bau); const m = mitteVon(w, { i: z0.i, j: z0.j, w: fw, h: fh }); kreis = { ...m, r: reichweite(z0.bau) }; }
      else if (a0) { const o = w.bauten.find(x => x.id === a0.id); if (o) kreis = { ...mitteVon(w, o), r: reichweite(o.bau) }; }
      if (d.gelaende) d.gelaende.uniforms.uKreis.value.set(kreis ? kreis.x - h2 : 0, kreis ? kreis.y - h2 : 0, kreis?.r ?? 0, kreis ? 1 : 0);
      // Werte-Kärtchen über dem Bauplatz
      const karteEl = huelle.current?.querySelector<HTMLDivElement>("[data-kaertchen]");
      if (karteEl) {
        if (kreis) {
          bildschirm.set(kreis.x - h2, hoeheGlatt(g, kreis.x, kreis.y) + 25, kreis.y - h2).project(kamera);
          const x = (bildschirm.x * 0.5 + 0.5) * el.clientWidth, y = (-bildschirm.y * 0.5 + 0.5) * el.clientHeight;
          karteEl.style.transform = `translate(${Math.round(x + 18)}px, ${Math.round(y - 20)}px)`;
          karteEl.style.visibility = bildschirm.z < 1 ? "visible" : "hidden";
        } else karteEl.style.visibility = "hidden";
      }
      // Schatten um den Blickpunkt
      const sr = Math.min(1600, Math.max(120, r.d * 0.9)), sc = d.sonne.shadow.camera;
      if (Math.abs(sc.right - sr) > sr * 0.1) { sc.left = -sr; sc.right = sr; sc.top = sr; sc.bottom = -sr; sc.far = 6000; sc.updateProjectionMatrix(); }
      blick.set(r.x, by, r.z);
      d.sonne.target.position.copy(blick);
      d.sonne.position.copy(blick).addScaledVector(licht, 2500);
      renderer.render(szene, kamera);
    };
    id = requestAnimationFrame(bild);

    // Gelände und Modelle
    let ab = false;
    Promise.all([ladeStadtModelle(), ladeWeltModelle()]).then(([teile]) => {
      if (ab || !drei.current) return;
      const d = drei.current;
      d.gelaende = baueGelaende(g, welt.current.frei);
      d.objekte = new AufbauObjekte(g, teile, weltModelle(), hausFarben(welt.current.stil));
      szene.add(d.gelaende.gruppe, d.objekte.gruppe);
      d.objekte.aktualisiere(welt.current);
      // Start: Blick auf die Kartenmitte bzw. den Fluss
      const f = g.flussLinie[Math.floor(g.flussLinie.length / 2)];
      if (f) { rig.ziel.x = rig.x = Math.max(-1200, Math.min(1200, f.x - g.breite / 2)); rig.ziel.z = rig.z = Math.max(-1200, Math.min(1200, f.y - g.breite / 2)); }
      setLaedt(false);
    });

    return () => {
      ab = true;
      cancelAnimationFrame(id);
      ro.disconnect();
      c.removeEventListener("wheel", rad);
      drei.current?.gelaende?.entsorge();
      drei.current?.objekte?.entsorge();
      drei.current = null;
      renderer.dispose();
      el.removeChild(c);
    };
  }, [g]);

  // Geist zeigen
  useEffect(() => {
    const o = drei.current?.objekte;
    if (!o) return;
    if (!ziel) { o.zeigeGeist(null, 0, 0, "nein"); return; }
    o.zeigeGeist(ziel.bau, ziel.i, ziel.j, !ziel.pr.ok ? "nein" : ziel.pr.faktor < 1 ? "schwach" : "gut");
  }, [ziel]);

  // Zeit
  useEffect(() => {
    if (!laeuft || !aktiv) return;
    const t = setInterval(() => {
      const w = welt.current, d = drei.current, alt = stufe(w);
      schritt(g, w);
      if (stufe(w) > alt) setMeldung(`🎉 Neue Stufe: ${plan.stufen[stufe(w)].name} — mehr Land ist erschlossen.`);
      if (d?.objekte) d.objekte.aktualisiere(w);
      if (d?.gelaende) {
        const s = w.frei.reduce((a, x) => a + x, 0);
        if (s !== d.freiSumme) { d.gelaende.setzeFrei(w.frei); d.freiSumme = s; }
      }
      neuZeichnen();
    }, 450 / tempo);
    return () => clearInterval(t);
  }, [laeuft, aktiv, tempo, g, plan]);

  const w = welt.current;
  const i = stufe(w);
  const { kap } = kapazitaet(g, stil, { orte: orteVon(w), einwohner: w.einwohner, tick: w.tick });
  const fehlend = fehlt(plan, { orte: orteVon(w), einwohner: w.einwohner, tick: 0 });
  const naechste = plan.stufen[i + 1];
  const bed = beduerfnisse(w);
  const deckung = useMemo(() => bed.map(b => ({ b, anteil: w.haeuser.length ? w.haeuser.filter(h => w.bauten.some(o => o.bau === b && Math.hypot(mitteVon(w, o).x - (h.i + 1) * g.zelle, mitteVon(w, o).y - (h.j + 1) * g.zelle) <= reichweite(b))).length / w.haeuser.length : 0 })), [bed.join(), w.haeuser.length, w.bauten.length]);
  const gewaehlt = auswahl ? w.bauten.find(o => o.id === auswahl.id) ?? null : null;
  const kaertchen = ziel
    ? { bau: ziel.bau, pr: ziel.pr, neu: true }
    : gewaehlt ? { bau: gewaehlt.bau, pr: pruefePlatzVorhanden(g, w, gewaehlt.id), neu: false } : null;

  if (ohneWebGL) return <div className="flex h-[640px] items-center justify-center rounded-xl border border-line text-muted">Der Aufbau braucht WebGL — dein Browser bietet es gerade nicht an.</div>;
  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex flex-wrap self-start rounded-xl border border-line bg-surface p-1">
        {STILE.map(s => <button key={s.id} onClick={() => setStil(s.id)} className={chip(stil === s.id)}>{s.icon} {s.kurz}</button>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div ref={huelle} className="relative h-[640px] overflow-hidden rounded-xl border border-line bg-[#b7d4ea]">
          <div ref={karte} className="absolute inset-0" />
          {laedt && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">⏳ Gelände wird geformt …</div>}
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-black/45 px-2 py-1 text-xs text-white">
            Mausrad: Haus ↔ Stadt · rechte Maustaste / Q E: drehen · ziehen / W A S D: schieben · Esc: abbrechen
          </div>
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button className={`chip ${raster ? "chip-on" : ""}`} onClick={() => setRaster(r => !r)}># Raster</button>
          </div>
          <div data-kaertchen className="pointer-events-none absolute left-0 top-0 w-64 rounded-lg border border-line bg-surface/95 p-2 text-xs shadow-lg" style={{ visibility: "hidden" }}>
            {kaertchen && <Kaertchen stil={stil} {...kaertchen} />}
          </div>
        </div>
        <aside className="card flex flex-col gap-3 p-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Stufe {i + 1} von {plan.stufen.length} · Jahr {jahrText(jahrVonStand(plan, w.einwohner))}</div>
            <h2 className="text-lg font-black">{plan.stufen[i].name}</h2>
          </div>
          <div className="text-xs">
            <div className="flex justify-between"><span>👥 {zahl(w.einwohner)} in {zahl(w.haeuser.length)} Häusern</span><span className="text-muted">Platz für {zahl(kap)}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (w.einwohner / Math.max(1, naechste?.ab ?? kap)) * 100)}%` }} /></div>
            {naechste && <p className="mt-1 text-muted">Nächste Stufe »{naechste.name}« ab {zahl(naechste.ab)} Einwohnern — erschließt neues Land.</p>}
            {!w.bauten.length && <p className="mt-1 font-bold">👉 Wähle {BAUTEN[plan.stufen[0].braucht[0]].icon} {BAUTEN[plan.stufen[0].braucht[0]].label} und setze es in die Landschaft. Die Farbe am Boden zeigt, ob der Platz passt.</p>}
            {fehlend.length > 0 && w.bauten.length > 0 && <p className="mt-1">Für den Aufstieg fehlt: {fehlend.map(b => `${BAUTEN[b].icon} ${BAUTEN[b].label}`).join(", ")}</p>}
          </div>
          {deckung.length > 0 && w.haeuser.length > 0 && (
            <div className="text-xs">
              <div className="mb-1 font-bold text-muted">Versorgung der Häuser</div>
              {deckung.map(x => (
                <div key={x.b} className="flex items-center gap-2">
                  <span className="w-32 truncate">{BAUTEN[x.b].icon} {BAUTEN[x.b].label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-line"><div className="h-full" style={{ width: `${x.anteil * 100}%`, background: x.anteil > 0.8 ? "#16a34a" : x.anteil > 0.4 ? "#d97706" : "#dc2626" }} /></div>
                  <span className="w-9 text-right">{Math.round(x.anteil * 100)} %</span>
                </div>
              ))}
              <p className="mt-1 text-muted">Gut versorgte Häuser wachsen und haben mehr Bewohner.</p>
            </div>
          )}
          {meldung && <div className="rounded-lg bg-surface-hover/70 p-2 text-sm">{meldung}</div>}
          <div className="flex flex-col gap-2">
            {plan.stufen.map((st, k) => {
              const liste = plan.orte.filter(o => o.stufe === k);
              if (!liste.length) return null;
              const zu = k > i;
              return (
                <div key={k}>
                  <div className="mb-1 text-xs font-bold text-muted">{zu ? "🔒 " : ""}{st.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {liste.map(o => (
                      <button key={o.bau} disabled={zu} title={BAUTEN[o.bau].text} onClick={() => { setWahl(x => (x === o.bau ? null : o.bau)); setZiel(null); setAuswahl(null); }}
                        className={`chip ${wahl === o.bau ? "chip-on" : ""} ${zu ? "opacity-40" : ""}`}>
                        {BAUTEN[o.bau].icon} {BAUTEN[o.bau].label}{w.bauten.filter(x => x.bau === o.bau).length ? " ✓" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button className={`chip self-start ${wahl === "abriss" ? "chip-on" : ""}`} onClick={() => { setWahl(x => (x === "abriss" ? null : "abriss")); setZiel(null); }}>🧽 Abreißen</button>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={!w.bauten.length} onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Zeit läuft"}</button>
            {[1, 2, 4].map(t => <button key={t} className={`chip ${tempo === t ? "chip-on" : ""}`} onClick={() => setTempo(t)}>{t}×</button>)}
            <button className="btn-secondary" onClick={() => { welt.current = neueWelt(g, stil, g.wahl.seed); setLaeuft(false); setMeldung(null); setAuswahl(null); drei.current?.objekte?.aktualisiere(welt.current); drei.current?.gelaende?.setzeFrei(welt.current.frei); neuZeichnen(); }}>↺ Neu</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Werte eines gebauten Gebäudes (Lage neu geprüft, ohne sich selbst als Hindernis) */
function pruefePlatzVorhanden(g: Gelaende, w: Welt, id: number): Platzpruefung {
  const o = w.bauten.find(x => x.id === id)!;
  const r = reichweite(o.bau), m = mitteVon(w, o);
  return {
    ok: true, faktor: o.faktor, gruende: [],
    versorgt: w.haeuser.filter(h => Math.hypot((h.i + 1) * g.zelle - m.x, (h.j + 1) * g.zelle - m.y) <= r).length,
  };
}

/** Werte-Kärtchen am Bauplatz */
function Kaertchen({ stil, bau, pr, neu }: { stil: Stil; bau: BauTyp; pr: Platzpruefung; neu: boolean }) {
  const s = BAUPLAENE[stil].orte.find(o => o.bau === bau);
  const regeln = lageRegeln(stil, bau);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-black">{BAUTEN[bau].icon} {BAUTEN[bau].label}</div>
      <div className="grid grid-cols-2 gap-x-2">
        <span className="text-muted">Einzugsbereich</span><span>{reichweite(bau)} m</span>
        <span className="text-muted">Häuser darin</span><span>{pr.versorgt}</span>
        <span className="text-muted">Platz für</span><span>{s ? `${zahl(s.kap * pr.faktor)} Einw.` : "–"}</span>
        <span className="text-muted">Wirkung</span><span className={pr.faktor >= 1 ? "text-ok font-bold" : pr.faktor > 0 ? "font-bold text-[#ca8a04]" : "text-bad font-bold"}>{Math.round(pr.faktor * 100)} %</span>
      </div>
      {neu ? (
        <ul className="mt-1">{pr.gruende.map((x, k) => <li key={k}>{x.ok ? "✅" : "❌"} {x.text}</li>)}</ul>
      ) : (
        <ul className="mt-1 text-muted">{regeln.soll.map(t => <li key={t}>• {t}</li>)}</ul>
      )}
    </div>
  );
}
