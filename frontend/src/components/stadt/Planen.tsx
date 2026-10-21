"use client";
/**
 * Reiter »Planen« und »Sandkasten«: Straßen, Mauern, Viertel und Bauwerke
 * selbst setzen. Bei Aufträgen prüft »✔ Prüfen« den Plan nach den Regeln
 * des Stils und erklärt jede Regel. »💡 Beispiel« zeigt, wie die Stadt im
 * Wachstum-Reiter auf demselben Gelände aussieht.
 */
import type { GelaendeBilder } from "@/components/gelaende/leinwand";
import { useEffect, useMemo, useState } from "react";
import { istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, flaeche, geschlossen, inPoly, schwerpunkt, zurLinie, type P } from "@/lib/stadt/geometrie";
import { haeuser } from "@/lib/stadt/haeuser";
import { BAUTEN, kopie, leereStadt, STILE, STRASSEN, ZONEN, type BauTyp, type Stadt, type Stil, type StrassenArt, type ZonenTyp } from "@/lib/stadt/modell";
import { AUFTRAEGE, pruefe, REGELSAETZE, sterne, type Auftrag, type Werkzeug } from "@/lib/stadt/regeln";
import { wachse, zerschneiden } from "@/lib/stadt/wachstum";
import Karte from "./Karte";
import Stadt3D from "./Stadt3D";

type Wahl = { werkzeug: Werkzeug } | { bau: BauTyp } | { radierer: true } | null;

const WERKZEUG_TEXT: Record<Werkzeug, { icon: string; label: string; hilfe: string }> = {
  fernstrasse: { icon: "🛤️", label: STRASSEN.fernstrasse.label, hilfe: "Klicken setzt Punkte, Doppelklick oder Enter beendet. Umschalt = gerade (0°/90°)." },
  haupt: { icon: "🛣️", label: STRASSEN.haupt.label, hilfe: "Klicken setzt Punkte, Doppelklick oder Enter beendet. Umschalt = gerade (0°/90°)." },
  neben: { icon: "➖", label: STRASSEN.neben.label, hilfe: "Klicken setzt Punkte, Doppelklick oder Enter beendet. Umschalt = gerade (0°/90°)." },
  gasse: { icon: "〰️", label: STRASSEN.gasse.label, hilfe: "Klicken setzt Punkte, Doppelklick oder Enter beendet." },
  ring: { icon: "⭕", label: STRASSEN.ring.label, hilfe: "Klicken setzt Punkte, Klick auf den ersten Punkt schließt den Ring." },
  autobahn: { icon: "🚗", label: STRASSEN.autobahn.label, hilfe: "Klicken setzt Punkte, Doppelklick oder Enter beendet." },
  bahn: { icon: "🚆", label: STRASSEN.bahn.label, hilfe: "Klicken setzt Punkte, Doppelklick oder Enter beendet. Bahnen mögen es gerade und flach." },
  aquaedukt: { icon: "💧", label: STRASSEN.aquaedukt.label, hilfe: "Von der Quelle (hoch) zur Stadt (tiefer) klicken, Doppelklick beendet." },
  mauer: { icon: "🧱", label: "Mauer", hilfe: "Eckpunkte klicken, Klick auf den ersten Punkt oder Doppelklick schließt die Mauer." },
  rechteckmauer: { icon: "▭", label: "Rechteck-Mauer", hilfe: "Ein Rechteck aufziehen." },
  raster: { icon: "#️⃣", label: "Straßenraster", hilfe: "Ein Rechteck aufziehen — es füllt sich mit Nebenstraßen im eingestellten Abstand." },
  zone: { icon: "🎨", label: "Viertel malen", hilfe: "Eckpunkte klicken, Klick auf den ersten Punkt schließt. Das Viertel bestimmt, welche Häuser entstehen." },
};

const LINIEN: Werkzeug[] = ["fernstrasse", "haupt", "neben", "gasse", "ring", "autobahn", "bahn", "aquaedukt"];
const BEISPIEL: Record<string, number> = { kolonie: 1, marktstadt: 1, eisenbahnstadt: 0, industrie: 3, autostadt: 2 };

const SANDKASTEN_BAUTEN: Record<Stil, BauTyp[]> = {
  roemisch: ["forum", "tempel", "thermen", "theater", "amphitheater", "nekropole", "castellum", "hafen", "villa", "tor"],
  europaeisch: ["markt", "kirche", "rathaus", "burg", "kloster", "muehle", "spital", "friedhof", "tor", "bahnhof", "fabrik", "mietshaus", "schule", "einkauf"],
  amerikanisch: ["depot", "gericht", "silo", "kirche", "schule", "fabrik", "hochhaus", "einkauf", "buero"],
  residenz: ["schloss", "kirche", "rathaus", "markt", "theater", "kaserne", "tor", "bahnhof"],
  festung: ["paradeplatz", "kirche", "kaserne", "zitadelle", "tor", "rathaus", "markt", "bahnhof"],
  sozialistisch: ["werk", "aufmarschplatz", "kulturhaus", "schule", "kaufhalle", "poliklinik", "einkauf", "bahnhof"],
  lateinamerika: ["plaza", "kathedrale", "cabildo", "kirche", "fabrik", "einkauf", "hochhaus", "schule"],
  orientalisch: ["moschee", "kasbah", "hammam", "karawanserei", "tor", "friedhof", "bahnhof", "einkauf"],
};
const ALLE_WERKZEUGE: Werkzeug[] = ["fernstrasse", "haupt", "neben", "gasse", "ring", "autobahn", "bahn", "aquaedukt", "mauer", "rechteckmauer", "raster", "zone"];

export default function Planen({ g, bild, sandkasten, aktiv = true }: { g: Gelaende; bild: GelaendeBilder; sandkasten?: boolean; aktiv?: boolean }) {
  const [auftragId, setAuftragId] = useState<string>(AUFTRAEGE[0].id);
  const [stilFrei, setStilFrei] = useState<Stil>("europaeisch");
  const [regelsatz, setRegelsatz] = useState<string>("");
  const auftrag: Auftrag | null = sandkasten ? null : AUFTRAEGE.find(a => a.id === auftragId)!;
  const stil = auftrag?.stil ?? stilFrei;

  const start = useMemo(() => (auftrag?.start ? wachse(auftrag.stil, g, g.wahl.seed)[auftrag.start.epoche].stadt : null), [auftrag, g]);
  const [plan, setPlan] = useState<Stadt>(() => leereStadt(stil));
  const [verlauf, setVerlauf] = useState<Stadt[]>([]);
  const [wahl, setWahl] = useState<Wahl>(null);
  const [punkte, setPunkte] = useState<P[]>([]);
  const [maus, setMaus] = useState<P | null>(null);
  const [rahmen, setRahmen] = useState<[P, P] | null>(null);
  const [abstandRaster, setAbstandRaster] = useState(80);
  const [zoneTyp, setZoneTyp] = useState<ZonenTyp>("altstadt");
  const [ergebnis, setErgebnis] = useState<ReturnType<typeof pruefe> | null>(null);
  const [marke, setMarke] = useState<P | null>(null);
  const [beispiel, setBeispiel] = useState(false);
  const [drei, setDrei] = useState(false);
  const [zonen, setZonen] = useState(false);

  // neuer Auftrag oder neues Gelände bei Erweiterungsaufgaben: neu anfangen
  useEffect(() => {
    setPlan(start ? kopie(start) : leereStadt(stil));
    setVerlauf([]); setErgebnis(null); setPunkte([]); setWahl(null); setBeispiel(false);
    setAbstandRaster(stil === "amerikanisch" ? 100 : 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftragId, start, sandkasten]);
  useEffect(() => { if (sandkasten) setPlan(p => ({ ...p, stil: stilFrei })); }, [stilFrei, sandkasten]);

  const beispielStadt = useMemo(() => (auftrag && beispiel ? wachse(auftrag.stil, g, g.wahl.seed)[BEISPIEL[auftrag.id]].stadt : null), [auftrag, beispiel, g]);
  const gezeigt = beispielStadt ?? plan;
  const hs = useMemo(() => haeuser(gezeigt, g, 7), [gezeigt, g]);

  const aendere = (f: (s: Stadt) => void) => {
    setVerlauf(v => [...v.slice(-40), plan]);
    const neu = kopie(plan);
    f(neu);
    setPlan(neu);
    setErgebnis(null);
  };
  const zurueck = () => { const v = verlauf[verlauf.length - 1]; if (v) { setPlan(v); setVerlauf(verlauf.slice(0, -1)); setErgebnis(null); } };

  const istLinie = wahl && "werkzeug" in wahl && LINIEN.includes(wahl.werkzeug);
  const istPoly = wahl && "werkzeug" in wahl && (wahl.werkzeug === "mauer" || wahl.werkzeug === "zone");
  const istRahmen = wahl && "werkzeug" in wahl && (wahl.werkzeug === "rechteckmauer" || wahl.werkzeug === "raster");

  /** Fang: an vorhandene Punkte, mit Umschalt gerade zum letzten Punkt */
  const fange = (p: P, shift: boolean): P => {
    let q = p;
    if (shift && punkte.length) {
      const l = punkte[punkte.length - 1];
      q = Math.abs(p.x - l.x) > Math.abs(p.y - l.y) ? { x: p.x, y: l.y } : { x: l.x, y: p.y };
    }
    let best: P | null = null, bd = 18;
    for (const st of plan.strassen) for (const s of st.punkte) { const d = abstand(s, q); if (d < bd) { bd = d; best = s; } }
    for (const m of plan.mauern) for (const s of m) { const d = abstand(s, q); if (d < bd) { bd = d; best = s; } }
    if (best) return { ...best };
    // sonst auf eine Straße
    for (const st of plan.strassen) { const r = zurLinie(q, st.punkte); if (r.d < 10) return r.q; }
    return q;
  };

  const fertigLinie = (pts: P[]) => {
    if (!wahl || !("werkzeug" in wahl)) return;
    const w = wahl.werkzeug;
    if (istLinie && pts.length >= 2) aendere(s => { s.strassen.push({ art: w as StrassenArt, punkte: pts }); });
    if (w === "mauer" && pts.length >= 3) aendere(s => { s.mauern.push(pts); });
    if (w === "zone" && pts.length >= 3) aendere(s => { s.zonen.push({ typ: zoneTyp, poly: pts }); });
    setPunkte([]);
  };

  const radiere = (p: P) => {
    const r = 25;
    const b = plan.bauten.map((x, i) => ({ i, d: abstand(x, p) - Math.max(BAUTEN[x.typ].b, BAUTEN[x.typ].h) / 2 })).sort((a, c) => a.d - c.d)[0];
    if (b && b.d < r) return aendere(s => { s.bauten.splice(b.i, 1); });
    const st = plan.strassen.map((x, i) => ({ i, d: zurLinie(p, x.punkte).d - STRASSEN[x.art].breite / 2 })).sort((a, c) => a.d - c.d)[0];
    if (st && st.d < r) return aendere(s => { s.strassen.splice(st.i, 1); });
    const m = plan.mauern.map((x, i) => ({ i, d: zurLinie(p, geschlossen(x)).d })).sort((a, c) => a.d - c.d)[0];
    if (m && m.d < r) return aendere(s => { s.mauern.splice(m.i, 1); });
    const z = plan.zonen.map((x, i) => ({ i, f: inPoly(p, x.poly) ? flaeche(x.poly) : Infinity })).sort((a, c) => a.f - c.f)[0];
    if (z && z.f < Infinity) aendere(s => { s.zonen.splice(z.i, 1); });
  };

  const klick = (p0: P, info: { doppel: boolean; shift: boolean }) => {
    if (!wahl) return;
    if ("radierer" in wahl) return radiere(p0);
    if ("bau" in wahl) {
      const t = wahl.bau;
      return aendere(s => { s.bauten.push({ typ: t, x: p0.x, y: p0.y, dreh: 0 }); });
    }
    if (istLinie || istPoly) {
      const p = fange(p0, info.shift);
      if (info.doppel) return fertigLinie(punkte);
      const schliessbar = istPoly || wahl.werkzeug === "ring";
      if (schliessbar && punkte.length >= 3 && abstand(p, punkte[0]) < 25) {
        return fertigLinie(wahl.werkzeug === "ring" ? [...punkte, punkte[0]] : punkte);
      }
      setPunkte(v => (v.length && abstand(v[v.length - 1], p) < 2 ? v : [...v, p]));
    }
  };

  const ziehe = (a: P, b: P, fertig: boolean) => {
    if (!fertig) return setRahmen([a, b]);
    setRahmen(null);
    if (!wahl || !("werkzeug" in wahl)) return;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    if (x1 - x0 < 20 || y1 - y0 < 20) return;
    if (wahl.werkzeug === "rechteckmauer") aendere(s => { s.mauern.push([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]); });
    if (wahl.werkzeug === "raster") aendere(s => {
      const d = abstandRaster;
      const neu: P[][] = [];
      const xs = Math.max(1, Math.round((x1 - x0) / d)), ys = Math.max(1, Math.round((y1 - y0) / d));
      for (let i = 0; i <= xs; i++) { const x = x0 + ((x1 - x0) * i) / xs; neu.push([{ x, y: y0 }, { x, y: y1 }]); }
      for (let j = 0; j <= ys; j++) { const y = y0 + ((y1 - y0) * j) / ys; neu.push([{ x: x0, y }, { x: x1, y }]); }
      for (const l of neu) for (const st of zerschneiden(l, g)) s.strassen.push({ art: "neben", punkte: [st[0], st[st.length - 1]] });
    });
  };

  useEffect(() => {
    if (!aktiv) return;
    const t = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      if (e.key === "Enter" && punkte.length) { e.preventDefault(); fertigLinie(punkte); }
      if (e.key === "Escape") { setPunkte([]); setWahl(null); }
      if (e.key === "Backspace" && punkte.length) { e.preventDefault(); setPunkte(v => v.slice(0, -1)); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); zurueck(); }
    };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  });

  const vorschau = useMemo(() => {
    if (rahmen) {
      const [a, b] = rahmen;
      return { punkte: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], art: "zone" as const };
    }
    if (!punkte.length || !wahl || !("werkzeug" in wahl)) return undefined;
    const pts = maus ? [...punkte, maus] : punkte;
    const w = wahl.werkzeug;
    return { punkte: pts, art: (w === "mauer" ? "mauer" : w === "zone" ? "zone" : w) as StrassenArt | "mauer" | "zone" };
  }, [punkte, maus, wahl, rahmen]);

  const marken = useMemo(() => (marke ? [{ p: marke, r: 50, farbe: "#dc2626" }] : undefined), [marke]);

  const werkzeuge = auftrag?.werkzeuge ?? ALLE_WERKZEUGE;
  const bauten = auftrag?.bauten ?? SANDKASTEN_BAUTEN[stilFrei];
  const regeln = auftrag?.regeln ?? REGELSAETZE.find(r => r.id === regelsatz)?.regeln ?? null;
  const pruefen = () => { if (regeln) { setErgebnis(pruefe(regeln, plan, g, start)); setMarke(null); } };
  const fokus = useMemo(() => {
    if (start) { const pts = start.zonen.flatMap(z => z.poly); const c = schwerpunkt(pts); return { x: c.x, y: c.y, r: 900 }; }
    return null;
  }, [start]);
  const sternZahl = ergebnis ? sterne(ergebnis) : 0;
  const hilfe = wahl && "werkzeug" in wahl ? WERKZEUG_TEXT[wahl.werkzeug].hilfe : wahl && "bau" in wahl ? `Klicke, um ${BAUTEN[wahl.bau].label} zu setzen. ${BAUTEN[wahl.bau].text}` : wahl && "radierer" in wahl ? "Klicke auf Straße, Mauer, Bauwerk oder Viertel, um es zu entfernen." : "Ziehen verschiebt die Karte, Mausrad zoomt. Wähle links ein Werkzeug.";

  const knopf = (an: boolean) => `flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors ${an ? "border-accent bg-accent/15" : "border-line hover:bg-surface-hover"}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!sandkasten ? (
          <select className="input w-auto py-1.5" value={auftragId} onChange={e => setAuftragId(e.target.value)} aria-label="Auftrag">
            {AUFTRAEGE.map(a => <option key={a.id} value={a.id}>{a.icon} {a.titel}</option>)}
          </select>
        ) : (
          <>
            <select className="input w-auto py-1.5" value={stilFrei} onChange={e => setStilFrei(e.target.value as Stil)} aria-label="Stil">
              {STILE.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
            </select>
            <select className="input w-auto py-1.5" value={regelsatz} onChange={e => { setRegelsatz(e.target.value); setErgebnis(null); }} aria-label="Prüfen als">
              <option value="">Ohne Prüfung</option>
              {REGELSAETZE.map(r => <option key={r.id} value={r.id}>Prüfen als: {r.label}</option>)}
            </select>
          </>
        )}
        <button className="btn-secondary py-1.5" disabled={!verlauf.length} onClick={zurueck} title="Strg+Z">↶ Rückgängig</button>
        <button className="btn-secondary py-1.5" onClick={() => aendere(s => { const n = start ? kopie(start) : leereStadt(stil); Object.assign(s, n); })}>🗑 Neu</button>
        <label className="flex items-center gap-1.5 text-sm text-muted"><input type="checkbox" checked={zonen} onChange={x => setZonen(x.target.checked)} /> Viertel farbig</label>
        <button className={drei ? "btn-primary py-1.5" : "btn-secondary py-1.5"} onClick={() => setDrei(d => !d)}>🛩️ 3D-Flug</button>
        {auftrag && <button className={beispiel ? "btn-primary py-1.5" : "btn-secondary py-1.5"} onClick={() => setBeispiel(b => !b)} title="So wächst die Stadt im Reiter »Wachstum« auf diesem Gelände">💡 Beispiel</button>}
      </div>
      {auftrag && <p className="card p-3 text-sm"><b>{auftrag.icon} Auftrag:</b> {auftrag.auftrag}</p>}
      <div className="grid gap-3 lg:grid-cols-[200px_1fr_320px]">
        <aside className="flex flex-col gap-1">
          <button className={knopf(!wahl)} onClick={() => { setWahl(null); setPunkte([]); }}>✋ Verschieben</button>
          <div className="mt-1 text-xs font-bold text-muted">Zeichnen</div>
          {werkzeuge.map(w => (
            <button key={w} className={knopf(!!wahl && "werkzeug" in wahl && wahl.werkzeug === w)} onClick={() => { setWahl({ werkzeug: w }); setPunkte([]); }}>
              <span>{WERKZEUG_TEXT[w].icon}</span>{WERKZEUG_TEXT[w].label}
            </button>
          ))}
          {wahl && "werkzeug" in wahl && wahl.werkzeug === "raster" && (
            <label className="text-xs text-muted">Blockgröße {abstandRaster} m
              <input type="range" min={40} max={160} step={10} value={abstandRaster} onChange={e => setAbstandRaster(Number(e.target.value))} className="w-full" />
            </label>
          )}
          {wahl && "werkzeug" in wahl && wahl.werkzeug === "zone" && (
            <select className="input py-1 text-xs" value={zoneTyp} onChange={e => setZoneTyp(e.target.value as ZonenTyp)}>
              {(Object.keys(ZONEN) as ZonenTyp[]).map(z => <option key={z} value={z}>{ZONEN[z].label}</option>)}
            </select>
          )}
          <div className="mt-1 text-xs font-bold text-muted">Bauwerke</div>
          {bauten.map(b => (
            <button key={b} className={knopf(!!wahl && "bau" in wahl && wahl.bau === b)} onClick={() => { setWahl({ bau: b }); setPunkte([]); }} title={BAUTEN[b].text}>
              <span>{BAUTEN[b].icon}</span>{BAUTEN[b].label}
            </button>
          ))}
          <button className={`${knopf(!!wahl && "radierer" in wahl)} mt-1`} onClick={() => { setWahl({ radierer: true }); setPunkte([]); }}>🧽 Entfernen</button>
        </aside>
        <div className="min-w-0">
          {drei ? <Stadt3D g={g} stadt={gezeigt} haeuser={hs} bild={bild} mitte={fokus} /> : (
            <Karte g={g} bild={bild} stadt={gezeigt} haeuser={hs} zonen={zonen} fokus={fokus}
              werkzeug={beispiel || !wahl ? null : istRahmen ? "ziehen" : "klick"}
              vorschau={beispiel ? undefined : vorschau} marken={marken}
              onKlick={klick} onZiehen={ziehe} onBewegung={(p, shift) => setMaus(p && punkte.length ? fange(p, shift) : null)} />
          )}
          <p className="mt-1.5 text-xs text-muted">{beispiel ? "💡 Das Beispiel zeigt die Stadt aus dem Reiter »Wachstum« auf demselben Gelände. Noch einmal klicken, um zum eigenen Plan zurückzukehren." : hilfe}</p>
        </div>
        <aside className="card flex flex-col gap-2 p-4">
          {!regeln && <p className="text-sm text-muted">Freies Bauen. Wähle oben »Prüfen als …«, um deinen Plan mit den Regeln eines Stadttyps zu vergleichen.</p>}
          {regeln && !ergebnis && (
            <>
              <div className="text-xs font-bold text-muted">Das wird geprüft</div>
              <ul className="flex flex-col gap-1 text-sm">{regeln.map(r => <li key={r.id}>◻️ {r.text}</li>)}</ul>
            </>
          )}
          {ergebnis && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl">{"⭐".repeat(sternZahl)}{"☆".repeat(3 - sternZahl)}</span>
                <span className="text-sm font-bold">{ergebnis.filter(e => e.ok).length} / {ergebnis.length}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {ergebnis.map(e => (
                  <li key={e.id}>
                    <details className="rounded-lg border border-line px-2 py-1 text-sm" onToggle={x => { if ((x.target as HTMLDetailsElement).open && e.ort) setMarke(e.ort); }}>
                      <summary className="cursor-pointer">{e.ok ? "✅" : "❌"} {e.text}</summary>
                      <p className={`mt-1 ${e.ok ? "text-ok" : "text-bad"}`}>{e.hinweis}</p>
                      <p className="mt-1 text-muted">💬 {e.warum}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}
          {regeln && <button className="btn-primary mt-auto" disabled={beispiel} onClick={pruefen}>✔ Prüfen</button>}
          <WasserWarnung g={g} plan={plan} />
        </aside>
      </div>
    </div>
  );
}

/** kleiner Hinweis, wenn Bauwerke im Wasser stehen */
function WasserWarnung({ g, plan }: { g: Gelaende; plan: Stadt }) {
  const nass = plan.bauten.filter(b => istWasser(g, b.x, b.y) && b.typ !== "hafen");
  if (!nass.length) return null;
  return <p className="text-xs text-bad">⚠️ {nass.map(b => BAUTEN[b.typ].label).join(", ")} steht im Wasser.</p>;
}
