"use client";
/**
 * Steilküste im Zellmodell: vier Kliff-Typen, die auf verschiedene Weise
 * zerfallen. Bedienung wie beim übrigen Querschnitt; dazu eine Physik-Tafel
 * mit Biegespannung im Überhang und Standsicherheit der Böschung.
 * Rechnung: `@/lib/kueste/kliff`, Zeichnung: `./kliffZeichnen`.
 */
import { useEffect, useRef, useState } from "react";
import {
  KLIFF_MASSNAHMEN, KLIFF_TYPEN, animieren, kBegriffe, kMassnahme, kNaechstesWetter, kSchritt,
  kStau, kSturmflut, kWasser, kWelle, kWellen, kliffKante, neuesKliff,
  type Kliff, type KliffMassnahmeId, type KliffTyp,
} from "@/lib/kueste/kliff";
import { tide, type Wetter } from "@/lib/kueste/profil";
import type { Begriff } from "@/lib/kueste/begriffe";
import { trefferBei, trefferZeigen, trifft, type Ausschnitt, type QuizTreffer } from "./zeichnen";
import { zeichneKliff } from "./kliffZeichnen";
import { useZoom, ZOOM_KNOPF } from "./zoom";


const TEMPI = [
  { id: "std", label: "1 Std./s", h: 1 },
  { id: "tag", label: "1 Tag/s", h: 24 },
  { id: "woche", label: "1 Woche/s", h: 168 },
  { id: "monat", label: "1 Monat/s", h: 730 },
  { id: "jahr", label: "1 Jahr/s", h: 8766 },
];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const BEAUFORT = ["Windstille", "leiser Zug", "leichte Brise", "schwache Brise", "mäßige Brise", "frische Brise", "starker Wind", "steifer Wind", "stürmischer Wind", "Sturm", "schwerer Sturm", "orkanartiger Sturm", "Orkan"];
const zahl = (v: number, st = 1) => v.toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st });
const monatVon = (h: number) => Math.floor(((h / 24) % 365.25) / 30.44) % 12;
const jahrVon = (h: number) => 2026 + Math.floor(h / 8766);

/** Welche Prozesse an welchem Kliff wie stark wirken (0–3) */
const PROZESSE: { icon: string; name: string; text: string; st: Record<KliffTyp, number> }[] = [
  { icon: "🌊", name: "Brandung und Hohlkehle", text: "Die Wellen schlagen immer auf derselben Höhe an und fressen eine Kerbe in den Fuß. Geröll im Wasser schleift wie Sandpapier.", st: { kreide: 3, moen: 2, mergel: 2, sand: 3 } },
  { icon: "🪨", name: "Abbruch des Überhangs", text: "Über der Kehle hängt die Wand frei wie ein Balken. Wird die Biegespannung größer als die Zugfestigkeit der zerklüfteten Wand, bricht sie ab.", st: { kreide: 3, moen: 2, mergel: 1, sand: 1 } },
  { icon: "🌀", name: "Rutschung", text: "Eine Scholle gleitet auf einer gekrümmten Fläche ab und kippt dabei nach hinten — typisch für Mergel und Ton.", st: { kreide: 1, moen: 2, mergel: 3, sand: 2 } },
  { icon: "↘️", name: "Gleitung auf Schichtflächen", text: "Das Eis hat die Kreide in Schollen zerlegt und schräg gestellt. Auf den Ton- und Mergellagen dazwischen gleiten ganze Pakete ins Meer.", st: { kreide: 0, moen: 3, mergel: 0, sand: 0 } },
  { icon: "❄️", name: "Frostsprengung", text: "Wasser in Poren und Klüften gefriert, dehnt sich aus und sprengt Schalen ab. Kreide ist besonders empfindlich.", st: { kreide: 3, moen: 3, mergel: 1, sand: 0 } },
  { icon: "💧", name: "Quellhorizont", text: "Regenwasser sickert ein, staut sich über dem Ton und tritt an der Wand aus — es spült die Wand von innen aus und macht sie schwer.", st: { kreide: 1, moen: 2, mergel: 3, sand: 1 } },
  { icon: "🌧️", name: "Abspülung", text: "Regen spült an steilen, kahlen Hängen Rinnen aus. Pflanzen schützen.", st: { kreide: 1, moen: 1, mergel: 3, sand: 2 } },
  { icon: "🟤", name: "Schlammstrom", text: "Nasser Mergel- und Tonschutt fließt wie Brei flach aus.", st: { kreide: 0, moen: 1, mergel: 3, sand: 0 } },
  { icon: "⏳", name: "Abrieseln", text: "Lockerer Sand rieselt ab, sobald die Wand steiler als sein Schüttwinkel ist.", st: { kreide: 0, moen: 0, mergel: 1, sand: 3 } },
  { icon: "💨", name: "Wind", text: "Trockener Sand wird vom Kliff geweht und baut oben eine Kliffranddüne.", st: { kreide: 0, moen: 0, mergel: 0, sand: 3 } },
];

const FAKTEN: Record<KliffTyp, { titel: string; punkte: string[] }> = {
  kreide: { titel: "Echt: Jasmund auf Rügen", punkte: [
    "Die Kreide entstand vor rund 70 Millionen Jahren aus winzigen Kalkschalen. Am Königsstuhl ist das Kliff fast 120 m hoch.",
    "Die Küste weicht im Mittel etwa 30 cm pro Jahr zurück (Nationalpark Jasmund) — aber nicht gleichmäßig, sondern in Abbrüchen.",
    "Am 24. Februar 2005 stürzten die Wissower Klinken ins Meer: rund 50 000 m³ Kreide in wenigen Minuten.",
    "Die Feuersteine am Strand stammen aus den dunklen Bändern in der Kreide.",
  ] },
  moen: { titel: "Echt: Møns Klint (Dänemark)", punkte: [
    "6 km lang und bis 128 m hoch. Das Eis hat die Kreide in Schollen zerbrochen, übereinander geschoben und schräg gestellt — dazwischen liegen Ton, Sand und Mergel.",
    "In der Nacht vom 26. auf den 27. Januar 2007 rutschten an der Store Taler über 100 000 m³ Kreide, Sand und Ton auf einer alten Überschiebungsfläche ab und bildeten eine rund 300 m lange Halbinsel mit umgestürzten Bäumen.",
    "1998 stürzte die Felsnadel Sommerspiret ins Meer.",
  ] },
  mergel: { titel: "Echt: Brodtener Ufer (Travemünde)", punkte: [
    "Ein Steilufer aus Geschiebemergel, den das Eis hinterlassen hat, mit Findlingen darin.",
    "Es weicht im Mittel 50 cm bis 1 m pro Jahr zurück; von 1810 bis 1900 gingen rund 100 m Land verloren.",
    "Abbrüche kommen vor allem im Winterhalbjahr: durch Sturmwellen und nach Starkregen, wenn Wasser aus einzelnen Schichten austritt und Teile abrutschen.",
  ] },
  sand: { titel: "Echt: Rotes Kliff auf Sylt", punkte: [
    "Rund 4 km lang und etwa 30 m hoch, zwischen Wenningstedt und Kampen.",
    "Unten weißer Kaolinsand, den Flüsse vor 2–3 Millionen Jahren abgelagert haben; die rote Farbe kommt von Eisenoxid.",
    "Nordsee: Sturmfluten greifen den weichen Sand direkt an. Seit den 1970er-Jahren wird deshalb Sand vor das Kliff gespült.",
  ] },
};

function Balken({ wert, max, farbe, marke }: { wert: number; max: number; farbe: string; marke?: number }) {
  return (
    <div className="relative h-2.5 rounded-full bg-[var(--border)] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (wert / max) * 100)}%`, background: farbe }} />
      {marke !== undefined && <div className="absolute top-0 bottom-0 w-0.5 bg-black/70" style={{ left: `${(marke / max) * 100}%` }} />}
    </div>
  );
}

export default function KliffAnsicht() {
  const [typ, setTyp] = useState<KliffTyp>("kreide");
  const kliff = useRef<Kliff>(neuesKliff("kreide"));
  const [, setTick] = useState(0);
  const [laeuft, setLaeuft] = useState(true);
  const [tempo, setTempo] = useState("tag");
  const [modus, setModus] = useState<"hand" | "jahr">("hand");
  const [hand, setHand] = useState<Wetter>({ bft: 5, auflandig: true, regen: false, frost: false });
  const [schilderAn, setSchilderAn] = useState(true);
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<{ frage: Begriff | null; richtig: number; gefragt: number; rueck: string | null } | null>(null);
  const [offen, setOffen] = useState<KliffMassnahmeId | null>(null);

  const canvas = useRef<HTMLCanvasElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const lage = useRef<{ wetter: Wetter; bisStunde: number } | null>(null);
  const zustand = useRef({ laeuft, tempo, modus, hand, schilderAn, markiert, quiz });
  zustand.current = { laeuft, tempo, modus, hand, schilderAn, markiert, quiz };
  const quizTreffer = useRef<(QuizTreffer & { bis: number }) | null>(null);
  const zuletzt = useRef<{ W: number; begriffe: Begriff[] }>({ W: 0, begriffe: [] });

  /** Ganzes Kliff, unverzerrt, eingepasst in die Bühne */
  const gesamt = (): Ausschnitt => {
    const k = kliff.current;
    const c = canvas.current;
    const A = c && c.height ? c.width / c.height : 2;
    const B = k.nx * k.dx, H = k.nz * k.dx;
    if (B / H > A) return { x0: 0, x1: B, z0: k.z0, z1: k.z0 + B / A };
    const breite = H * A;
    const x0 = Math.max(0, Math.min(B - breite, kliffKante(k) - breite * 0.55));
    return { x0, x1: x0 + breite, z0: k.z0, z1: k.z0 + H };
  };
  const zoom = useZoom(canvas, gesamt);

  function wetterJetzt(): Wetter {
    const z = zustand.current;
    const w = z.modus === "jahr" ? (lage.current?.wetter ?? z.hand) : z.hand;
    if (kliff.current.flut) return { ...w, bft: Math.max(w.bft, 9), auflandig: true };
    return w;
  }

  function wasserlinie(): Ausschnitt {
    const k = kliff.current;
    const w = wetterJetzt();
    const W = kWasser(k, w);
    const u = kWellen(k, W, kWelle(k, w)).ufer * k.dx;
    const c = canvas.current;
    const A = c && c.height ? c.width / c.height : 2;
    const breite = 28;
    return { x0: u - breite * 0.6, x1: u + breite * 0.4, z0: W - breite / A * 0.3, z1: W + breite / A * 0.7 };
  }

  function neu(t: KliffTyp) {
    kliff.current = neuesKliff(t);
    lage.current = null;
    zoom.setzen(null);
    setTyp(t);
    setMarkiert(null);
    setQuiz(null);
    setTick(x => x + 1);
  }

  useEffect(() => {
    let raf = 0, vorher = performance.now(), rest = 0, bild = 0;
    const t0 = performance.now();
    const frame = (jetzt: number) => {
      const dtReal = Math.min(0.1, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const z = zustand.current;
      const k = kliff.current;
      const tempoH = TEMPI.find(x => x.id === z.tempo)!.h;
      // Stürze und Rutschungen laufen in Echtzeit; solange steht die Uhr.
      if (k.bewegungen.length || k.unruhig) animieren(k, dtReal, tempoH > 168 ? 6 : 2);
      if (z.laeuft && !k.bewegungen.length) {
        rest += dtReal * tempoH;
        const schritt = tempoH <= 24 ? Math.max(0.05, Math.min(1, rest)) : tempoH <= 730 ? 6 : 12;
        const ende = performance.now() + 12;
        while (rest >= schritt && performance.now() < ende && !k.bewegungen.length) {
          if (z.modus === "jahr" && (!lage.current || k.stunde >= lage.current.bisStunde)) lage.current = kNaechstesWetter(k);
          kSchritt(k, wetterJetzt(), schritt);
          rest -= schritt;
        }
        rest = Math.min(rest, schritt * 4);
      }
      const w = wetterJetzt();
      const W = tempoH > 168 ? kStau(k, w) : kWasser(k, w);
      const H0 = kWelle(k, w);
      const wl = kWellen(k, W, H0);
      const liste = kBegriffe(k, W);
      zuletzt.current = { W, begriffe: liste };
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const b = { ctx, w: c.width / dpr, h: c.height / dpr, a: zoom.aktuell() };
        zeichneKliff(b, {
          k, wetter: w, W, H0, wl, t: (jetzt - t0) / 1000, dt: dtReal,
          begriffe: z.quiz ? null : z.schilderAn ? liste : null,
          markiert: z.markiert, quizTreffer: null,
        });
        const tr = quizTreffer.current;
        if (tr && tr.bis > jetzt) trefferZeigen(b, tr);
      }
      if (++bild % 8 === 0) setTick(x => x + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = canvas.current, h = huelle.current;
    if (!c || !h) return;
    const passen = () => {
      const breite = h.clientWidth;
      const hoehe = Math.round(Math.min(560, Math.max(320, breite * 0.55)));
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(breite * dpr); c.height = Math.round(hoehe * dpr);
      c.style.width = `${breite}px`; c.style.height = `${hoehe}px`;
    };
    passen();
    const ro = new ResizeObserver(passen);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  function neueFrage(nicht?: string): Begriff | null {
    const liste = zuletzt.current.begriffe.filter(b => b.id !== nicht && !["mhw", "mnw", "mw"].includes(b.id));
    return liste.length ? liste[Math.floor(Math.random() * liste.length)] : null;
  }

  function klick(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvas.current;
    if (!c || !zoom.klickZaehlt()) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const b = { ctx: c.getContext("2d")!, w: c.width / dpr, h: c.height / dpr, a: zoom.aktuell() };
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const best = trefferBei(b, zuletzt.current.begriffe, mx, my);
    if (quiz?.frage) {
      // Der aktuelle Stand des Begriffs — das Kliff kann sich seit der Frage verändert haben
      const ziel = zuletzt.current.begriffe.find(x => x.id === quiz.frage!.id) ?? quiz.frage;
      const ok = trifft(b, ziel, mx, my);
      quizTreffer.current = { ...ziel, ok, bis: performance.now() + 1800 };
      setQuiz({
        ...quiz, richtig: quiz.richtig + (ok ? 1 : 0), gefragt: quiz.gefragt + 1, frage: neueFrage(ziel.id),
        rueck: ok ? `Richtig: ${ziel.name}!` : best ? `Das war »${best.name}«. Das rote Oval zeigt, wo ${ziel.name} liegt.` : `Daneben — das rote Oval zeigt, wo ${ziel.name} liegt.`,
      });
      return;
    }
    setMarkiert(best?.id ?? null);
  }

  const k = kliff.current;
  const w = wetterJetzt();
  const W = kWasser(k, w);
  const H0 = kWelle(k, w);
  const zurueck = kliffKante(k) - k.startKante;
  const fs = k.analyse.fs;
  const fsFarbe = fs < 1 ? "#dc2626" : fs < 1.3 ? "#f59e0b" : "#16a34a";
  const sp = k.analyse.spannung;
  const markierterBegriff = zuletzt.current.begriffe.find(b => b.id === markiert) ?? null;
  const bewegung = k.bewegungen[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        {KLIFF_TYPEN.map(t => (
          <button key={t.id} onClick={() => neu(t.id)} title={t.ort}
            className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${typ === t.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"}`}>
            {t.icon} {t.name}
          </button>
        ))}
        <span className="text-xs text-[var(--text-muted)]">{KLIFF_TYPEN.find(t => t.id === typ)!.ort}</span>
      </div>

      <div ref={huelle} className="relative rounded-2xl overflow-hidden border border-[var(--border)] touch-none">
        <canvas ref={canvas} onClick={klick} className="block w-full cursor-crosshair" aria-label="Querschnitt durch das Kliff" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 text-xs font-bold pointer-events-none">
          <span className="px-2 py-1 rounded-lg bg-black/55 text-white">{MONATE[monatVon(k.stunde)]} {jahrVon(k.stunde)}</span>
          <span className="px-2 py-1 rounded-lg bg-black/55 text-white">💨 {w.bft} Bft {w.auflandig ? "→ auflandig" : "← ablandig"}</span>
          <span className="px-2 py-1 rounded-lg bg-black/55 text-white">🌊 {W >= 0 ? "+" : "−"}{zahl(Math.abs(W))} m</span>
          <span className="px-2 py-1 rounded-lg bg-black/55 text-white">💧 Grundwasser {Math.round(k.saettigung * 100)} %</span>
          {k.flut && <span className="px-2 py-1 rounded-lg bg-red-600/90 text-white animate-pulse">Sturmflut!</span>}
          {bewegung && <span className="px-2 py-1 rounded-lg bg-amber-500 text-black animate-pulse">
            {bewegung.art === "fall" ? "Abbruch!" : bewegung.art === "rutsch" ? "Rutschung!" : "Gleitung!"} — die Zeit steht, bis alles liegt
          </span>}
        </div>
        {quiz && (
          <div className="absolute top-2 right-2 max-w-[55%] px-3 py-2 rounded-xl bg-white/95 text-gray-900 text-sm shadow">
            {quiz.frage ? <div className="font-black">Tippe auf: {quiz.frage.name}</div> : <div>Keine Begriffe sichtbar.</div>}
            <div className="text-xs text-gray-600">{quiz.richtig} von {quiz.gefragt} richtig</div>
            {quiz.rueck && <div className="text-xs mt-1">{quiz.rueck}</div>}
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1">
          <button className={ZOOM_KNOPF} onClick={() => zoom.setzen(null)}>⤢ Ganzes Kliff</button>
          <button className={ZOOM_KNOPF} onClick={() => zoom.setzen(wasserlinie())}>🔍 Wasserlinie</button>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] -mt-2">Mausrad zoomt, Ziehen verschiebt. Maßstab 1:1 — so steil ist das Kliff wirklich.</p>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setLaeuft(!laeuft)} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)]">{laeuft ? "⏸ Pause" : "▶ Weiter"}</button>
        <div className="inline-flex flex-wrap rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
          {TEMPI.map(t => (
            <button key={t.id} onClick={() => setTempo(t.id)} className={`px-2 py-1 rounded-lg text-xs font-bold ${tempo === t.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>{t.label}</button>
          ))}
        </div>
        <button onClick={() => kSturmflut(kliff.current, 0.6)} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)]">🌊 Sturmflut</button>
        <button onClick={() => kSturmflut(kliff.current, 1)} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-red-500/50 text-red-600 dark:text-red-400 hover:bg-[var(--surface-hover)]">🌪️ Schwere Sturmflut</button>
        <button onClick={() => { kliff.current.saettigung = 1; setModus("hand"); setHand({ ...hand, regen: true }); }} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)]" title="Wochenlanger Regen: das Grundwasser steigt auf 100 %">🌧️ Dauerregen</button>
        <button onClick={() => neu(typ)} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)]">↺ Neu</button>
        <label className="flex items-center gap-1.5 text-sm ml-auto"><input type="checkbox" checked={schilderAn} onChange={e => setSchilderAn(e.target.checked)} /> Begriffe</label>
        <button onClick={() => setQuiz(quiz ? null : { frage: neueFrage(), richtig: 0, gefragt: 0, rueck: null })}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${quiz ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-[var(--accent)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}>❓ Beschriften-Quiz</button>
      </div>

      {markierterBegriff && !quiz && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm"><b>{markierterBegriff.name}:</b> {markierterBegriff.text}</div>
      )}
      {schilderAn && !quiz && (
        <div className="flex flex-wrap gap-1.5">
          {zuletzt.current.begriffe.map(b => (
            <button key={b.id} onClick={() => setMarkiert(markiert === b.id ? null : b.id)}
              className={`px-2 py-0.5 rounded-full text-xs border ${markiert === b.id ? "bg-amber-400 text-black border-amber-500" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}>{b.name}</button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black">🌦️ Wetter</h3>
            <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-xs font-bold">
              <button onClick={() => setModus("hand")} className={`px-2 py-1 rounded-md ${modus === "hand" ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : ""}`}>von Hand</button>
              <button onClick={() => { setModus("jahr"); if (tempo === "std" || tempo === "tag") setTempo("monat"); }} className={`px-2 py-1 rounded-md ${modus === "jahr" ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : ""}`}>Jahreslauf</button>
            </div>
          </div>
          {modus === "hand" ? (
            <>
              <label className="text-sm">Wind: <b>{hand.bft} Bft</b> <span className="text-[var(--text-muted)]">({BEAUFORT[hand.bft]})</span>
                <input type="range" min={0} max={12} value={hand.bft} onChange={e => setHand({ ...hand, bft: Number(e.target.value) })} className="w-full" />
              </label>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1"><input type="radio" checked={hand.auflandig} onChange={() => setHand({ ...hand, auflandig: true })} /> vom Meer</label>
                <label className="flex items-center gap-1"><input type="radio" checked={!hand.auflandig} onChange={() => setHand({ ...hand, auflandig: false })} /> vom Land</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={hand.regen} onChange={e => setHand({ ...hand, regen: e.target.checked })} /> 🌧️ Regen</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={hand.frost} onChange={e => setHand({ ...hand, frost: e.target.checked })} /> ❄️ Frost</label>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Wetter wie im echten Jahr: Winterstürme, Dauerregen im Spätherbst, Frost im Winter, trockene Sommer. Gerade: <b className="text-[var(--text)]">{w.bft} Bft{w.regen ? ", Regen" : ""}{w.frost ? ", Frost" : ""}</b>.</p>
          )}
          <div className="text-xs text-[var(--text-muted)] grid grid-cols-2 gap-x-3 gap-y-1">
            <span>Wellen draußen</span><b className="text-[var(--text)]">{zahl(H0)} m</b>
            <span>Tide</span><b className="text-[var(--text)]">{zahl(tide(k.hub, k.stunde), 2)} m</b>
            <span>Windstau/Sturmflut</span><b className="text-[var(--text)]">{zahl(kStau(k, w))} m</b>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2.5">
          <h3 className="font-black">🧮 Physik der Wand</h3>
          <div className="text-sm">
            <div className="flex justify-between"><span>Biegespannung im Überhang</span><b>{Math.round(sp * 100)} %</b></div>
            <Balken wert={sp} max={1.5} farbe={sp >= 1 ? "#dc2626" : sp > 0.7 ? "#f59e0b" : "#16a34a"} marke={1} />
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Hohlkehle {zahl(k.analyse.kehle)} m tief. Bei 100 % der Zugfestigkeit bricht der Überhang ab.</p>
          </div>
          <div className="text-sm">
            <div className="flex justify-between"><span>Standsicherheit (FS)</span><b style={{ color: fsFarbe }}>{fs > 9 ? "hoch" : zahl(fs, 2)}</b></div>
            <Balken wert={Math.min(fs, 2)} max={2} farbe={fsFarbe} marke={1} />
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">FS = haltende ÷ treibende Kräfte auf der ungünstigsten {k.analyse.fsArt === "ebene" ? "Schichtfläche" : "Gleitfläche"}. Unter 1 rutscht es.</p>
          </div>
          <div className="text-sm">
            <div className="flex justify-between"><span>Grundwasser</span><b>{Math.round(k.saettigung * 100)} %</b></div>
            <Balken wert={k.saettigung} max={1} farbe="#3b82f6" />
          </div>
          <div className="text-sm">
            <div className="flex justify-between"><span>Klüfte und Risse</span><b>{Math.round(k.risse * 100)} %</b></div>
            <Balken wert={k.risse} max={1} farbe="#a16207" />
          </div>
          <div className="text-xs text-[var(--text-muted)] grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
            <span>Kante zurückgewichen</span><b className="text-[var(--text)]">{zahl(Math.max(0, zurueck))} m</b>
            <span>Abgestürzt/abgerutscht</span><b className="text-[var(--text)]">{Math.round(k.bilanz.abgestuerzt)} m³/m</b>
            <span>Vom Meer fortgespült</span><b className="text-[var(--text)]">{Math.round(k.bilanz.weggespuelt)} m³/m</b>
            <span>Kosten / Schäden</span><b className="text-[var(--text)]">{zahl(k.kosten, 2)} / {zahl(k.schadenEuro, 1)} Mio. €</b>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2 max-h-[360px] overflow-y-auto">
          <h3 className="font-black">📰 Meldungen</h3>
          {k.meldungen.length === 0 && <p className="text-sm text-[var(--text-muted)]">Noch ist alles ruhig. Dreh den Wind auf, lass es regnen oder frieren — oder nimm den Jahreslauf.</p>}
          {[...k.meldungen].reverse().slice(0, 12).map((m, i) => (
            <div key={`${m.stunde}-${i}`} className={`text-sm rounded-lg px-2 py-1 border-l-4 ${m.art === "schaden" ? "border-red-500 bg-red-500/10" : m.art === "warnung" ? "border-amber-500 bg-amber-500/10" : m.art === "gut" ? "border-green-500 bg-green-500/10" : "border-sky-500 bg-sky-500/10"}`}>
              <span className="text-[11px] text-[var(--text-muted)] mr-1">{MONATE[monatVon(m.stunde)].slice(0, 3)} {jahrVon(m.stunde)}</span>{m.text}
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
        <h3 className="font-black">🔨 Was dieses Kliff zerstört</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...PROZESSE].filter(p => p.st[typ] > 0).sort((a, b) => b.st[typ] - a.st[typ]).map(p => (
            <div key={p.name} className="rounded-xl border border-[var(--border)] p-2.5 text-sm">
              <div className="flex justify-between gap-2"><b>{p.icon} {p.name}</b><span className="text-amber-500 tracking-widest" title="Wie wichtig an diesem Kliff">{"●".repeat(p.st[typ])}<span className="opacity-25">{"●".repeat(3 - p.st[typ])}</span></span></div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
        <h3 className="font-black">🏗️ Schutz — oder nicht?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {KLIFF_MASSNAHMEN.filter(m => m.typen.includes(typ)).map(m => (
            <div key={m.id} className="rounded-xl border border-[var(--border)] p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2"><b>{m.icon} {m.name}</b><span className="text-xs text-[var(--text-muted)] whitespace-nowrap">≈ {zahl(m.kosten, m.kosten < 1 ? 2 : 0)} Mio. €/km</span></div>
              <p className="text-xs text-[var(--text-muted)]">{m.was}</p>
              {offen === m.id && <div className="text-xs flex flex-col gap-1"><p><b className="text-green-600 dark:text-green-400">＋</b> {m.plus}</p><p><b className="text-red-600 dark:text-red-400">－</b> {m.minus}</p></div>}
              <div className="flex gap-2 mt-1">
                <button onClick={() => { kMassnahme(kliff.current, m.id); setTick(x => x + 1); }} className="px-3 py-1 rounded-lg text-sm font-bold bg-[var(--accent)] text-[var(--accent-text,#111)]">Bauen</button>
                <button onClick={() => setOffen(offen === m.id ? null : m.id)} className="px-3 py-1 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)]">{offen === m.id ? "weniger" : "Vor- und Nachteile"}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="font-black mb-2">📍 {FAKTEN[typ].titel}</h3>
          <ul className="text-sm list-disc pl-5 flex flex-col gap-1">{FAKTEN[typ].punkte.map(t => <li key={t}>{t}</li>)}</ul>
        </section>
        <section className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
          <h3 className="font-black mb-2">⚠️ Regeln an der Steilküste</h3>
          <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
            <li>Abstand zur Kante halten — sie kann unterhöhlt sein und ohne Warnung abbrechen.</li>
            <li>Nicht direkt unter dem Kliff sitzen oder spielen: Steine und Erde können herabstürzen.</li>
            <li>Gesperrte Wege und Warnschilder beachten.</li>
            <li>Besonders gefährlich nach Dauerregen, Frost, Tauwetter und Sturm.</li>
            <li>Nicht am Kliff klettern und keine Steine herausbrechen.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
