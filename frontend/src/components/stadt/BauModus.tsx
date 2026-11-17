"use client";
/**
 * Reiter »Bauen« (wie Anno): Wichtige Orte setzen, die Zeit laufen lassen —
 * Häuser, Straßen und Viertel wachsen von selbst, je nach Stadttyp. Jeder Ort
 * zeigt beim Zielen, ob die Lage passt; die nächste Stufe beginnt erst, wenn
 * die geforderten Orte stehen.
 */
import type { GelaendeBilder } from "@/components/gelaende/leinwand";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, type P } from "@/lib/stadt/geometrie";
import { haeuser } from "@/lib/stadt/haeuser";
import { BAUTEN, STILE, type BauTyp, type Stil } from "@/lib/stadt/modell";
import { erschliessung } from "@/lib/stadt/oepnv";
import { BAUPLAENE, fehlt, jahrVonStand, kapazitaet, leererStand, pruefeOrt, schritt, stadtAus, stufeVon, type BauStand } from "@/lib/stadt/bauen";
import Karte from "./Karte";
import Stadt3D from "./Stadt3D";

const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;
const zahl = (n: number) => Math.round(n).toLocaleString("de-DE");
const jahrText = (j: number) => (j < 0 ? `${-j} v. Chr.` : `${j}`);

export default function BauModus({ g, bild, stil, setStil, aktiv = true }: { g: Gelaende; bild: GelaendeBilder; stil: Stil; setStil: (s: Stil) => void; aktiv?: boolean }) {
  const plan = BAUPLAENE[stil];
  const [stand, setStand] = useState<BauStand>(leererStand);
  const [wahl, setWahl] = useState<BauTyp | "radierer" | null>(null);
  const [maus, setMaus] = useState<P | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(1);
  const [drei, setDrei] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  // neuer Stadttyp oder neues Gelände: von vorn
  useEffect(() => { setStand(leererStand()); setWahl(null); setLaeuft(false); setMeldung(null); }, [stil, g]);

  // Zeit
  const standRef = useRef(stand);
  standRef.current = stand;
  useEffect(() => {
    if (!laeuft || !aktiv) return;
    const t = setInterval(() => {
      const alt = standRef.current;
      const neu = schritt(g, stil, alt);
      const a = stufeVon(plan, alt.einwohner), b = stufeVon(plan, neu.einwohner);
      if (b > a) setMeldung(`🎉 Neue Stufe: ${plan.stufen[b].name}`);
      setStand(neu);
    }, 700 / tempo);
    return () => clearInterval(t);
  }, [laeuft, aktiv, tempo, g, stil, plan]);

  // Stadt nur bei spürbarer Änderung neu bauen (Einwohner in ~5-%-Stufen)
  const stufeEw = stand.einwohner ? Math.round(Math.log(stand.einwohner) * 20) : -1;
  const stadtStand = useMemo(() => ({ ...stand, einwohner: stufeEw < 0 ? 0 : Math.exp(stufeEw / 20) }), [stand.orte, stufeEw]); // eslint-disable-line react-hooks/exhaustive-deps
  const stadt = useMemo(() => stadtAus(g, stil, stadtStand, g.wahl.seed), [g, stil, stadtStand]);
  const hs = useMemo(() => haeuser(stadt, g, g.wahl.seed), [stadt, g]);
  const oepnv = useMemo(() => (stadt.bauten.some(b => b.typ === "haltestelle") ? erschliessung(stadt, hs) : null), [stadt, hs]);

  const i = stufeVon(plan, stand.einwohner);
  const { kap, gedeckelt } = kapazitaet(g, stil, stand);
  const fehlend = fehlt(plan, stand);
  const naechste = plan.stufen[i + 1];
  const jahr = jahrVonStand(plan, stand.einwohner);
  const ziel = wahl && wahl !== "radierer" && maus ? pruefeOrt(g, stil, wahl, maus, stand.orte) : null;
  const fokus = useMemo(() => (stand.orte[0] ? { x: stand.orte[0].p.x, y: stand.orte[0].p.y, r: 1200 } : null), [stand.orte]);

  const setze = (p: P) => {
    if (wahl === "radierer") {
      const k = stand.orte.findIndex(o => abstand(o.p, p) < Math.max(30, BAUTEN[o.bau].b * 0.6));
      if (k >= 0) setStand(s => ({ ...s, orte: s.orte.filter((_, j) => j !== k) }));
      return;
    }
    if (!wahl) return;
    const e = pruefeOrt(g, stil, wahl, p, stand.orte);
    if (!e.erlaubt) { setMeldung(`❌ ${BAUTEN[wahl].label}: ${e.gruende.filter(x => !x.ok).map(x => x.text).join(", ")}`); return; }
    setStand(s => ({ ...s, orte: [...s.orte, { bau: wahl, p }] }));
    setMeldung(e.faktor < 1 ? `⚠️ ${BAUTEN[wahl].label} steht ungünstig — wirkt nur zu ${Math.round(e.faktor * 100)} %.` : `✅ ${BAUTEN[wahl].label} gebaut.`);
    if (!laeuft && stand.orte.length === 0) setLaeuft(true);
  };

  const marken = ziel && maus ? [{ p: maus, r: 30, farbe: !ziel.erlaubt ? "#dc2626" : ziel.faktor < 1 ? "#d97706" : "#16a34a" }] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-line bg-surface p-1">
          {STILE.map(s => <button key={s.id} onClick={() => setStil(s.id)} className={chip(stil === s.id)}>{s.icon} {s.kurz}</button>)}
        </div>
        <button className={drei ? "btn-primary py-1.5" : "btn-secondary py-1.5"} onClick={() => setDrei(d => !d)}>🛩️ 3D</button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {drei ? (
            <Stadt3D g={g} stadt={stadt} haeuser={hs} bild={bild} mitte={fokus} />
          ) : (
            <Karte g={g} bild={bild} stadt={stadt} haeuser={hs} fokus={fokus} marken={marken}
              werkzeug={wahl ? "klick" : null} onBewegung={p => setMaus(p)} onKlick={p => setze(p)} />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={!stand.orte.length} onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Zeit läuft"}</button>
            {[1, 2, 4].map(t => <button key={t} className={`chip ${tempo === t ? "chip-on" : ""}`} onClick={() => setTempo(t)}>{t}×</button>)}
            <button className="btn-secondary" onClick={() => { setStand(leererStand()); setLaeuft(false); setMeldung(null); }}>↺ Neu anfangen</button>
            <span className="ml-auto text-sm text-muted">Jahr {jahrText(jahr)} · {zahl(stand.einwohner)} Einwohner</span>
          </div>
        </div>
        <aside className="card flex flex-col gap-3 p-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Stufe {i + 1} von {plan.stufen.length}</div>
            <h2 className="text-lg font-black">{plan.stufen[i].name}</h2>
          </div>
          <div className="text-xs">
            <div className="flex justify-between"><span>👥 {zahl(stand.einwohner)}</span><span className="text-muted">Platz für {zahl(kap)}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (stand.einwohner / Math.max(1, naechste?.ab ?? kap)) * 100)}%` }} /></div>
            {naechste && <p className="mt-1 text-muted">Nächste Stufe »{naechste.name}« ab {zahl(naechste.ab)} Einwohnern.</p>}
            {!stand.orte.length && <p className="mt-1 font-bold">👉 Wähle unten {BAUTEN[plan.stufen[0].braucht[0]].icon} {BAUTEN[plan.stufen[0].braucht[0]].label} und setze es in die Karte.</p>}
            {fehlend.length > 0 && stand.orte.length > 0 && (
              <p className={`mt-1 ${gedeckelt ? "font-bold text-bad" : ""}`}>{gedeckelt ? "⛔ Wachstum gestoppt — " : ""}Für den Aufstieg fehlt: {fehlend.map(b => `${BAUTEN[b].icon} ${BAUTEN[b].label}`).join(", ")}</p>
            )}
            {oepnv && <p className="mt-1">🚏 {Math.round(oepnv.anteil * 100)} % der Wohnhäuser an Bus und Bahn</p>}
          </div>
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
                    {liste.map(o => {
                      const zahlGesetzt = stand.orte.filter(x => x.bau === o.bau).length;
                      return (
                        <button key={o.bau} disabled={zu} title={BAUTEN[o.bau].text} onClick={() => setWahl(w => (w === o.bau ? null : o.bau))}
                          className={`chip ${wahl === o.bau ? "chip-on" : ""} ${zu ? "opacity-40" : ""}`}>
                          {BAUTEN[o.bau].icon} {BAUTEN[o.bau].label}{zahlGesetzt ? ` ✓${zahlGesetzt > 1 ? zahlGesetzt : ""}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button className={`chip self-start ${wahl === "radierer" ? "chip-on" : ""}`} onClick={() => setWahl(w => (w === "radierer" ? null : "radierer"))}>🧽 Abreißen</button>
          </div>
          {wahl && wahl !== "radierer" && (
            <div className="rounded-lg border border-line p-2 text-xs">
              <div className="font-bold">{BAUTEN[wahl].icon} {BAUTEN[wahl].label}</div>
              <p className="text-muted">{BAUTEN[wahl].text}</p>
              {ziel ? (
                <ul className="mt-1">{ziel.gruende.map((x, k) => <li key={k}>{x.ok ? "✅" : "❌"} {x.text}</li>)}</ul>
              ) : <p className="mt-1">Fahre mit der Maus über die Karte, um die Lage zu prüfen.</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
