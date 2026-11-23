"use client";
/**
 * Spiel »Zahlen-Detektiv«: Zu jeder Zahl alle Bereiche antippen, zu denen sie
 * gehört (7 → ℕ, ℤ, ℚ, ℝ). Zehn Zahlen oder 60 Sekunden, drei Stufen.
 */
import { useEffect, useRef, useState } from "react";
import { BEREICHE, begruendung, bereicheVon, FARBE, pruefeAuswahl, wuerfleZahl, ZEICHEN, type Bereich, type Zahl } from "@/lib/zahlenbereiche";
import { ZahlAnzeige } from "./teile";

const BEST = "hp_zahlenbereiche_detektiv_best";
const lies = () => { try { return Number(localStorage.getItem(BEST)) || 0; } catch { return 0; } };

type Modus = "zehn" | "zeit";

export default function Sortierer() {
  const [stufe, setStufe] = useState<1 | 2 | 3>(1);
  const [modus, setModus] = useState<Modus>("zehn");
  const [laeuft, setLaeuft] = useState(false);
  const [zahl, setZahl] = useState<Zahl>(() => wuerfleZahl(Math.random, 1));
  const [wahl, setWahl] = useState<Set<Bereich>>(new Set());
  const [rueck, setRueck] = useState<{ ok: boolean; text: string } | null>(null);
  const [stand, setStand] = useState({ punkte: 0, aufgaben: 0, richtig: 0, serie: 0 });
  const [zeit, setZeit] = useState(60);
  const [best, setBest] = useState(0);
  const fertig = laeuft && ((modus === "zehn" && stand.aufgaben >= 10 && !rueck) || (modus === "zeit" && zeit <= 0));
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setBest(lies()); }, []);
  useEffect(() => {
    if (!laeuft || modus !== "zeit") return;
    uhr.current = setInterval(() => setZeit(z => Math.max(0, z - 1)), 1000);
    return () => { if (uhr.current) clearInterval(uhr.current); };
  }, [laeuft, modus]);
  useEffect(() => {
    if (!fertig) return;
    if (stand.punkte > best) { setBest(stand.punkte); try { localStorage.setItem(BEST, String(stand.punkte)); } catch { /* egal */ } }
  }, [fertig]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    setStand({ punkte: 0, aufgaben: 0, richtig: 0, serie: 0 }); setZeit(60); setRueck(null); setWahl(new Set());
    setZahl(wuerfleZahl(Math.random, stufe)); setLaeuft(true);
  };
  const umschalten = (b: Bereich) => { if (rueck) return; setWahl(w => { const n = new Set(w); if (n.has(b)) n.delete(b); else n.add(b); return n; }); };
  const pruefen = () => {
    const p = pruefeAuswahl(zahl, wahl);
    setStand(s => {
      const serie = p.richtig ? s.serie + 1 : 0;
      return { punkte: s.punkte + (p.richtig ? 10 + Math.min(serie - 1, 5) * 2 : 0), aufgaben: s.aufgaben + 1, richtig: s.richtig + (p.richtig ? 1 : 0), serie };
    });
    setRueck({ ok: p.richtig, text: p.richtig ? begruendung(zahl)
      : `Richtig wäre: ${bereicheVon(zahl).map(b => ZEICHEN[b]).join(", ")}. ${begruendung(zahl)}` });
  };
  const weiter = () => { setRueck(null); setWahl(new Set()); setZahl(wuerfleZahl(Math.random, stufe)); };

  if (!laeuft || fertig) return (
    <div className="flex flex-col gap-3 items-start">
      <h3 className="font-black text-lg">🕵️ Zahlen-Detektiv</h3>
      <p className="text-sm text-muted max-w-xl">Zu jeder Zahl <b>alle</b> Bereiche antippen, zu denen sie gehört — die 7 ist natürlich, aber eben auch ganz, rational und reell. Vorsicht ab Stufe 2: √16, 12/4 oder 0,9 periodisch sehen nur so aus, als wären sie keine ganzen Zahlen.</p>
      {fertig && <p className="font-bold">Geschafft: {stand.punkte} Punkte, {stand.richtig} von {stand.aufgaben} richtig.{stand.punkte >= best && stand.punkte > 0 ? " 🏆 Neuer Rekord!" : ""}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm">Stufe:</span>
        {([1, 2, 3] as const).map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => setStufe(s)}>{s}</button>)}
        <span className="text-sm ml-3">Modus:</span>
        <button className={`chip ${modus === "zehn" ? "chip-on" : ""}`} onClick={() => setModus("zehn")}>10 Zahlen</button>
        <button className={`chip ${modus === "zeit" ? "chip-on" : ""}`} onClick={() => setModus("zeit")}>60 Sekunden</button>
      </div>
      <button className="btn-primary" onClick={start}>▶ Los</button>
      {best > 0 && <p className="text-xs text-muted">Rekord in diesem Browser: {best} Punkte</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="flex gap-4 text-sm font-bold">
        <span>{stand.punkte} Punkte</span>
        <span>{modus === "zehn" ? `Zahl ${Math.min(stand.aufgaben + 1, 10)} / 10` : `⏱ ${zeit} s`}</span>
        {stand.serie >= 2 && <span>🔥 {stand.serie}er-Serie</span>}
      </div>
      <div className="rounded-2xl border-2 border-line px-8 py-5 bg-page"><ZahlAnzeige x={zahl} gross /></div>
      <div className="flex gap-2" role="group" aria-label="Zahlenbereiche wählen">
        {BEREICHE.map(b => {
          const an = wahl.has(b);
          return (
            <button key={b} type="button" aria-pressed={an} onClick={() => umschalten(b)}
              className="w-16 h-16 rounded-2xl text-3xl font-black border-4 transition-transform active:scale-95"
              style={{ borderColor: FARBE[b], background: an ? FARBE[b] : "transparent", color: an ? "white" : FARBE[b] }}>{ZEICHEN[b]}</button>
          );
        })}
      </div>
      {!rueck
        ? <button className="btn-primary" onClick={pruefen}>Prüfen</button>
        : <>
            <p className={`text-sm max-w-xl text-center ${rueck.ok ? "text-ok" : "text-bad"}`}>{rueck.ok ? "✔ " : "✘ "}{rueck.text}</p>
            {!(modus === "zehn" && stand.aufgaben >= 10) && <button className="btn-primary" onClick={weiter} autoFocus>Nächste Zahl →</button>}
            {modus === "zehn" && stand.aufgaben >= 10 && <button className="btn-primary" onClick={() => setRueck(null)} autoFocus>Auswertung</button>}
          </>}
    </div>
  );
}
