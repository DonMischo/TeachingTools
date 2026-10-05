"use client";
/**
 * Küste im Querschnitt: drei Küstenarten, Wetter von Hand oder im
 * Jahreslauf, Zeitraffer bis ein Jahr je Sekunde, Sturmfluten auf Knopfdruck
 * und die Schutzmaßnahmen des Menschen. Das Modell steckt in
 * `@/lib/kueste/profil`; hier wird nur gezeichnet und bedient.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  STUNDEN_JAHR, jahrVon, kennzahlen, monatVon, naechstesWetter, neuesProfil, schritt, stau,
  sturmflut, tide, wasserstand, wellen, wellenhoehe,
  type KuestenArt, type Profil, type Wetter, type WetterLage,
} from "@/lib/kueste/profil";
import { anwenden, massnahmenFuer, type MassnahmeId } from "@/lib/kueste/massnahmen";
import { begriffe as begriffeVon, type Begriff } from "@/lib/kueste/begriffe";
import { AUSSCHNITT, trefferBei, trifft, zeichne, type Ausschnitt, type QuizTreffer } from "./zeichnen";
import { useZoom, ZOOM_KNOPF, ZOOM_KNOPF_AN } from "./zoom";
import KliffAnsicht from "./KliffAnsicht";

const ARTEN: { id: KuestenArt; icon: string; name: string; ort: string }[] = [
  { id: "flach", icon: "🏖️", name: "Flachküste", ort: "Sandstrand und Düne, Vorbild: Sylt (Nordsee)" },
  { id: "steil", icon: "🪨", name: "Steilküste", ort: "Kliff aus Kreide und Mergel, Vorbild: Kap Arkona auf Rügen (Ostsee)" },
  { id: "marsch", icon: "🛡️", name: "Marsch mit Deich", ort: "Watt, Salzwiese, Deich und Koog an der Nordsee" },
];

const TEMPI = [
  { id: "min", label: "1 Min./s", h: 1 / 60 },
  { id: "std", label: "1 Std./s", h: 1 },
  { id: "tag", label: "1 Tag/s", h: 24 },
  { id: "woche", label: "1 Woche/s", h: 168 },
  { id: "monat", label: "1 Monat/s", h: 730 },
  { id: "jahr", label: "1 Jahr/s", h: STUNDEN_JAHR },
];

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const BEAUFORT = ["Windstille", "leiser Zug", "leichte Brise", "schwache Brise", "mäßige Brise", "frische Brise", "starker Wind", "steifer Wind", "stürmischer Wind", "Sturm", "schwerer Sturm", "orkanartiger Sturm", "Orkan"];

const zahl = (v: number, st = 1) => v.toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st });
const vz = (v: number, st = 1) => (v >= 0 ? "+" : "−") + zahl(Math.abs(v), st);

const BEISPIEL: Record<KuestenArt, { titel: string; punkte: string[] }> = {
  flach: {
    titel: "Echt: Sylt",
    punkte: [
      "Die Westküste von Sylt verliert jedes Jahr rund 1 Million m³ Sand an Strömung und Sturmfluten.",
      "Seit 1972 wird deshalb Sand aufgespült: bis Ende 2024 rund 61 Mio. m³ für rund 289 Mio. € — im Mittel etwa 1,2 Mio. m³ im Jahr.",
      "Früher baute man Tetrapoden und Betonmauern (z. B. in Hörnum und Westerland). Davor verschwand der Strand — heute setzt man auf Sand.",
      "Tidenhub vor Westerland: knapp 2 m.",
    ],
  },
  steil: {
    titel: "Echt: Kap Arkona (Rügen)",
    punkte: [
      "Von der slawischen Tempelburg auf dem Kap (Jaromarsburg) ist nur noch ein Rest übrig — der Rest ist mit dem Kliff ins Meer gestürzt.",
      "Nach einer Sturmflut im Oktober 2023 brach dort auf über 100 m Länge ein Stück Kliff ab, geschätzt rund 15 000 m³.",
      "Abbrüche kommen vor allem im Winter und Frühjahr: nach Sturm, Dauerregen und Frost.",
      "Die Ostsee hat kaum Gezeiten; gefährlich sind Sturmhochwasser, wenn der Wind das Wasser gegen die Küste drückt.",
    ],
  },
  marsch: {
    titel: "Echt: Sturmflut 1962",
    punkte: [
      "In der Nacht zum 17. Februar 1962 stieg das Wasser in Hamburg auf 5,70 m über Normalnull. Viele Deiche brachen, 315 Menschen starben in Hamburg.",
      "Die alten Deiche waren zu niedrig und innen zu steil: Überlaufendes Wasser spülte die Binnenböschung weg.",
      "Heute: Außenböschung 1:6, Binnenböschung 1:3, Sandkern mit 1–1,5 m Kleidecke. Neue »Klimadeiche« bekommen einen Zuschlag für den steigenden Meeresspiegel.",
      "Tidenhub an der Festlandsküste: etwa 3 bis 4 m.",
    ],
  },
};

export default function ProfilAnsicht() {
  const [art, setArt] = useState<KuestenArt>("flach");
  const profil = useRef<Profil>(neuesProfil("flach"));
  const [, setTick] = useState(0);
  const [laeuft, setLaeuft] = useState(true);
  const [tempo, setTempo] = useState("std");
  const [modus, setModus] = useState<"hand" | "jahr">("hand");
  const [hand, setHand] = useState<Wetter>({ bft: 4, auflandig: true, regen: false, frost: false });
  const [schilderAn, setSchilderAn] = useState(true);
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<{ frage: Begriff | null; richtig: number; gefragt: number; rueck: string | null } | null>(null);
  const [offen, setOffen] = useState<MassnahmeId | null>(null);

  const canvas = useRef<HTMLCanvasElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const lage = useRef<WetterLage | null>(null);
  const zustand = useRef({ laeuft, tempo, modus, hand, schilderAn, markiert, quiz, art });
  zustand.current = { laeuft, tempo, modus, hand, schilderAn, markiert, quiz, art };
  const quizTreffer = useRef<(QuizTreffer & { bis: number }) | null>(null);
  const zoom = useZoom(canvas, () => AUSSCHNITT[profil.current.art]);
  const abbruchSeit = useRef<{ stunde: number; t: number } | null>(null);
  const zuletzt = useRef<{ W: number; H0: number; begriffe: Begriff[] }>({ W: 0, H0: 0, begriffe: [] });

  const p = profil.current;

  function wetterJetzt(): Wetter {
    const z = zustand.current;
    const w = z.modus === "jahr" ? (lage.current?.wetter ?? z.hand) : z.hand;
    // Eine Sturmflut kommt nie bei Flaute: der Sturm treibt das Wasser.
    if (profil.current.flut) return { ...w, bft: Math.max(w.bft, 9), auflandig: true };
    return w;
  }

  function neu(a: KuestenArt) {
    zoom.setzen(null);
    profil.current = neuesProfil(a);
    lage.current = null;
    setArt(a);
    setMarkiert(null);
    setQuiz(null);
    setTick(t => t + 1);
  }

  // Die Schleife: rechnen, zeichnen, ab und zu die Anzeige auffrischen
  useEffect(() => {
    let raf = 0;
    let vorher = performance.now();
    let rest = 0;
    let bild = 0;
    const t0 = performance.now();
    const frame = (jetzt: number) => {
      const dtReal = Math.min(0.1, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const z = zustand.current;
      const q = profil.current;
      // Die Steilküste hat ihr eigenes Modell (KliffAnsicht)
      if (z.art === "steil") { raf = requestAnimationFrame(frame); return; }
      const tempoH = TEMPI.find(x => x.id === z.tempo)!.h;
      if (z.laeuft) {
        rest += dtReal * tempoH;
        const schrittH = tempoH < 1 ? rest : 1;
        let n = 0;
        while (rest >= schrittH && rest > 0 && n < 400) {
          if (z.modus === "jahr" && (!lage.current || q.stunde >= lage.current.bisStunde)) lage.current = naechstesWetter(q);
          schritt(q, wetterJetzt(), Math.min(schrittH, 1));
          rest -= Math.min(schrittH, 1);
          n++;
        }
        if (n >= 400) rest = 0;
      }
      const w = wetterJetzt();
      const schnell = tempoH >= 168;
      // Im schnellen Zeitraffer würde die Tide flimmern — gezeichnet wird das Mittel.
      const W = schnell ? stau(q, w) : wasserstand(q, w);
      const H0 = wellenhoehe(q, w);
      const wl = wellen(q, W, H0);
      const liste = begriffeVon(q, W, H0);
      zuletzt.current = { W, H0, begriffe: liste };
      if (q.abbruch && abbruchSeit.current?.stunde !== q.abbruch.stunde) abbruchSeit.current = { stunde: q.abbruch.stunde, t: jetzt };
      const c = canvas.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const tr = quizTreffer.current && quizTreffer.current.bis > jetzt ? quizTreffer.current : null;
          zeichne({ ctx, w: c.width / dpr, h: c.height / dpr, a: zoom.aktuell() }, {
            p: q, wetter: w, W, H0, wl, t: (jetzt - t0) / 1000, schnell,
            begriffe: z.quiz ? null : z.schilderAn ? liste : null,
            markiert: z.markiert,
            abbruchAlter: abbruchSeit.current ? (jetzt - abbruchSeit.current.t) / 1000 : 99,
            quizTreffer: tr,
          });
          zoom.lupeZeichnen(ctx, c);
        }
      }
      if (++bild % 8 === 0) setTick(t => t + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // Die Schleife liest alles über Refs; sie läuft einmal für die ganze Lebenszeit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas an die Breite anpassen
  useEffect(() => {
    const c = canvas.current, h = huelle.current;
    if (!c || !h) return;
    const passen = () => {
      const breite = h.clientWidth;
      const hoehe = Math.round(Math.min(520, Math.max(300, breite * 0.52)));
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(breite * dpr);
      c.height = Math.round(hoehe * dpr);
      c.style.width = `${breite}px`;
      c.style.height = `${hoehe}px`;
    };
    passen();
    const ro = new ResizeObserver(passen);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  function klick(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const dpr = window.devicePixelRatio || 1;
    if (!zoom.klickZaehlt() || zoom.lupenKlick(e)) return;
    const b = { ctx: c.getContext("2d")!, w: c.width / dpr, h: c.height / dpr, a: zoom.aktuell() };
    const best = trefferBei(b, zuletzt.current.begriffe, mx, my);
    if (quiz?.frage) {
      const ziel = zuletzt.current.begriffe.find(x => x.id === quiz.frage!.id) ?? quiz.frage;
      const ok = trifft(b, ziel, mx, my);
      quizTreffer.current = { ...ziel, ok, bis: performance.now() + 1800 };
      setQuiz({
        ...quiz,
        richtig: quiz.richtig + (ok ? 1 : 0),
        gefragt: quiz.gefragt + 1,
        rueck: ok ? `Richtig: ${ziel.name}!` : best ? `Das war »${best.name}«. Das rote Oval zeigt, wo ${ziel.name} liegt.` : `Daneben — das rote Oval zeigt, wo ${ziel.name} liegt.`,
        frage: neueFrage(ziel.id),
      });
      return;
    }
    setMarkiert(best?.id ?? null);
  }

  function neueFrage(nicht?: string): Begriff | null {
    const liste = zuletzt.current.begriffe.filter(b => b.id !== nicht && !["mhw", "mnw", "mw"].includes(b.id));
    if (liste.length === 0) return null;
    return liste[Math.floor(Math.random() * liste.length)];
  }

  /** Ausschnitt um die Wasserlinie: 50 m breit, 10 m hoch */
  function wasserlinie(): Ausschnitt {
    const q = profil.current;
    const w = wetterJetzt();
    const Wz = wasserstand(q, w);
    const u = wellen(q, Wz, wellenhoehe(q, w)).ufer;
    return { x0: u - 30, x1: u + 20, z0: Wz - 5, z1: Wz + 5 };
  }

  function massnahme(id: MassnahmeId) {
    anwenden(profil.current, id);
    setTick(t => t + 1);
  }

  const w = wetterJetzt();
  const W = wasserstand(p, w);
  const H0 = wellenhoehe(p, w);
  const wl = wellen(p, W, H0);
  const k = kennzahlen(p);
  const start = useMemo(() => {
    const s = neuesProfil(art);
    return kennzahlen(s);
  }, [art]);
  const monat = monatVon(p.stunde);
  const markierterBegriff = zuletzt.current.begriffe.find(b => b.id === markiert) ?? null;
  const erklaerung = lageText(p, w, W, H0, wl.amUfer);

  const auswahl = (
      <div className="flex flex-wrap gap-2">
        {ARTEN.map(a => (
          <button key={a.id} onClick={() => neu(a.id)} title={a.ort}
            className={`px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${
              art === a.id ? "bg-(--accent) text-(--accent-text,#111) border-(--accent)"
                : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"}`}>
            {a.icon} {a.name}
          </button>
        ))}
        <span className="self-center text-xs text-(--text-muted)">{ARTEN.find(a => a.id === art)!.ort}</span>
      </div>
  );

  if (art === "steil") {
    return (
      <div className="flex flex-col gap-4">
        {auswahl}
        <KliffAnsicht />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {auswahl}

      {/* Bühne */}
      <div ref={huelle} className="relative rounded-2xl overflow-hidden border border-(--border)">
        <canvas ref={canvas} onClick={klick} className={`block w-full ${zoom.lupe ? "cursor-none" : "cursor-crosshair"}`} aria-label="Querschnitt durch die Küste" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="px-2 py-1 rounded-lg bg-black/55 text-white">{MONATE[monat]} {jahrVon(p.stunde)}</span>
          <span className="px-2 py-1 rounded-lg bg-black/55 text-white">
            💨 {w.bft} Bft {w.auflandig ? "→ auflandig" : "← ablandig"}
          </span>
          <span className="px-2 py-1 rounded-lg bg-black/55 text-white">🌊 Wasser {vz(W, 1)} m</span>
          {p.flut && <span className="px-2 py-1 rounded-lg bg-red-600/90 text-white animate-pulse">Sturmflut!</span>}
        </div>
        {quiz && (
          <div className="absolute top-2 right-2 max-w-[60%] px-3 py-2 rounded-xl bg-white/95 text-gray-900 text-sm shadow-sm">
            {quiz.frage ? <div className="font-black">Tippe auf: {quiz.frage.name}</div> : <div>Keine Begriffe sichtbar.</div>}
            <div className="text-xs text-gray-600">{quiz.richtig} von {quiz.gefragt} richtig</div>
            {quiz.rueck && <div className="text-xs mt-1">{quiz.rueck}</div>}
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1">
          <button className={zoom.lupe ? ZOOM_KNOPF_AN : ZOOM_KNOPF} onClick={() => zoom.setLupe(!zoom.lupe)} title="Lupe: zeigt vergrößert, was unter dem Zeiger liegt — Klick zoomt dorthin">🔍 Lupe</button>
          {zoom.gezoomt && <button className={ZOOM_KNOPF} onClick={() => zoom.setzen(null)} title="Ganzes Profil">⤢ Ganz</button>}
          <button className={ZOOM_KNOPF} onClick={() => zoom.setzen(wasserlinie())} title="An die Wasserlinie heranzoomen">🌊 Wasserlinie</button>
        </div>
      </div>
      <p className="text-xs text-(--text-muted) -mt-2">🔍 Lupe zeigt vergrößert, was unter dem Zeiger liegt — ein Klick zoomt dorthin. Mausrad zoomt, Ziehen verschiebt.</p>

      {/* Bedienung */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setLaeuft(!laeuft)} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-(--border) hover:bg-(--surface-hover)">
          {laeuft ? "⏸ Pause" : "▶ Weiter"}
        </button>
        <div className="inline-flex flex-wrap rounded-xl border border-(--border) p-1 bg-(--surface)">
          {TEMPI.map(t => (
            <button key={t.id} onClick={() => setTempo(t.id)}
              className={`px-2 py-1 rounded-lg text-xs font-bold ${tempo === t.id ? "bg-(--accent) text-(--accent-text,#111)" : "text-(--text-muted) hover:text-(--text)"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => { sturmflut(profil.current, 0.55); if (tempo === "min") setTempo("std"); }}
          className="px-3 py-1.5 rounded-lg text-sm font-bold border border-(--border) hover:bg-(--surface-hover)">🌊 Sturmflut</button>
        <button onClick={() => { sturmflut(profil.current, 1); if (tempo === "min") setTempo("std"); }}
          className="px-3 py-1.5 rounded-lg text-sm font-bold border border-red-500/50 text-red-600 dark:text-red-400 hover:bg-(--surface-hover)">🌪️ Schwere Sturmflut</button>
        <button onClick={() => neu(art)} className="px-3 py-1.5 rounded-lg text-sm font-bold border border-(--border) hover:bg-(--surface-hover)">↺ Neu</button>
        <label className="flex items-center gap-1.5 text-sm ml-auto">
          <input type="checkbox" checked={schilderAn} onChange={e => setSchilderAn(e.target.checked)} /> Begriffe
        </label>
        <button onClick={() => setQuiz(quiz ? null : { frage: neueFrage(), richtig: 0, gefragt: 0, rueck: null })}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${quiz ? "bg-(--accent) text-(--accent-text,#111) border-(--accent)" : "border-(--border) hover:bg-(--surface-hover)"}`}>
          ❓ Beschriften-Quiz
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Wetter */}
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black">🌦️ Wetter</h3>
            <div className="inline-flex rounded-lg border border-(--border) p-0.5 text-xs font-bold">
              <button onClick={() => setModus("hand")} className={`px-2 py-1 rounded-md ${modus === "hand" ? "bg-(--accent) text-(--accent-text,#111)" : ""}`}>von Hand</button>
              <button onClick={() => { setModus("jahr"); if (tempo === "min" || tempo === "std") setTempo("woche"); }} className={`px-2 py-1 rounded-md ${modus === "jahr" ? "bg-(--accent) text-(--accent-text,#111)" : ""}`}>Jahreslauf</button>
            </div>
          </div>
          {modus === "hand" ? (
            <>
              <label className="text-sm">
                Wind: <b>{hand.bft} Bft</b> <span className="text-(--text-muted)">({BEAUFORT[hand.bft]})</span>
                <input type="range" min={0} max={12} value={hand.bft} onChange={e => setHand({ ...hand, bft: Number(e.target.value) })} className="w-full" />
              </label>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1"><input type="radio" checked={hand.auflandig} onChange={() => setHand({ ...hand, auflandig: true })} /> vom Meer (auflandig)</label>
                <label className="flex items-center gap-1"><input type="radio" checked={!hand.auflandig} onChange={() => setHand({ ...hand, auflandig: false })} /> vom Land (ablandig)</label>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1"><input type="checkbox" checked={hand.regen} onChange={e => setHand({ ...hand, regen: e.target.checked })} /> 🌧️ Regen</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={hand.frost} onChange={e => setHand({ ...hand, frost: e.target.checked })} /> ❄️ Frost</label>
              </div>
            </>
          ) : (
            <p className="text-sm text-(--text-muted)">
              Das Wetter wechselt wie im echten Jahr: im Winter mehr Wind, Sturmtiefs und ab und zu eine Sturmflut, im Sommer ruhiger.
              Gerade: <b className="text-(--text)">{w.bft} Bft {w.auflandig ? "auflandig" : "ablandig"}</b>
              {w.regen ? ", Regen" : ""}{w.frost ? ", Frost" : ""}.
            </p>
          )}
          <div className="text-xs text-(--text-muted) grid grid-cols-2 gap-x-3 gap-y-1">
            <span>Wellen draußen</span><b className="text-(--text)">{zahl(H0)} m</b>
            <span>Wellen am Ufer</span><b className="text-(--text)">{zahl(wl.amUfer)} m</b>
            <span>Tide</span><b className="text-(--text)">{vz(tide(p.hub, p.stunde), 2)} m</b>
            <span>Windstau/Sturmflut</span><b className="text-(--text)">{vz(stau(p, w), 1)} m</b>
          </div>
        </section>

        {/* Was passiert gerade? + Zahlen */}
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3">
          <h3 className="font-black">🔎 Was passiert gerade?</h3>
          <p className="text-sm leading-relaxed">{erklaerung}</p>
          <div className="text-xs text-(--text-muted) grid grid-cols-2 gap-x-3 gap-y-1">
            {art === "flach" && <>
              <span>Strandbreite</span><b className="text-(--text)">{k.strand} m <span className="font-normal">(Start {start.strand} m)</span></b>
              <span>Düne</span><b className="text-(--text)">{zahl(k.duene)} m hoch</b>
              <span>Hochwasserlinie</span><b className="text-(--text)">{vz(start.hochwasserlinie - k.hochwasserlinie, 0)} m</b>
            </>}
            {art === "marsch" && <>
              <span>Deichkrone</span><b className="text-(--text)">{zahl(k.duene)} m über NHN</b>
              <span>Binnenböschung</span><b className={p.deichGebrochen ? "text-red-500" : "text-(--text)"}>{p.deichGebrochen ? "gebrochen!" : `${Math.round(Math.min(1, p.deichSchaden) * 100)} % ausgespült`}</b>
            </>}
            <span>Von Wellen abgetragen</span><b className="text-(--text)">{Math.round(p.bilanz.abgetragen)} m³/m</b>
            <span>Vom Längsstrom weg</span><b className="text-(--text)">{Math.round(p.bilanz.weggetragen)} m³/m</b>
            {art === "flach" && <><span>In die Düne geweht</span><b className="text-(--text)">{Math.round(p.bilanz.angeweht)} m³/m</b></>}
            {p.bilanz.aufgespuelt > 0 && <><span>Aufgespült</span><b className="text-(--text)">{Math.round(p.bilanz.aufgespuelt)} m³/m</b></>}
            <span>Kosten (1 km)</span><b className="text-(--text)">{zahl(p.kosten, 2)} Mio. €</b>
            <span>Schäden</span><b className={p.schaden > 0 ? "text-red-500" : "text-(--text)"}>{zahl(p.schaden, 1)} Mio. €</b>
          </div>
          <p className="text-[11px] text-(--text-muted)">m³/m = Kubikmeter je Meter Küste. Kosten sind grobe Richtwerte.</p>
        </section>

        {/* Meldungen */}
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-2 max-h-[340px] overflow-y-auto">
          <h3 className="font-black">📰 Meldungen</h3>
          {p.meldungen.length === 0 && <p className="text-sm text-(--text-muted)">Noch ist alles ruhig. Dreh den Wind auf oder löse eine Sturmflut aus.</p>}
          {[...p.meldungen].reverse().slice(0, 12).map((m, i) => (
            <div key={`${m.stunde}-${i}`} className={`text-sm rounded-lg px-2 py-1 border-l-4 ${
              m.art === "schaden" ? "border-red-500 bg-red-500/10" : m.art === "warnung" ? "border-amber-500 bg-amber-500/10"
                : m.art === "gut" ? "border-green-500 bg-green-500/10" : "border-sky-500 bg-sky-500/10"}`}>
              <span className="text-[11px] text-(--text-muted) mr-1">{MONATE[monatVon(m.stunde)].slice(0, 3)} {jahrVon(m.stunde)}</span>
              {m.text}
            </div>
          ))}
        </section>
      </div>

      {/* Begriff erklärt */}
      {markierterBegriff && !quiz && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <b>{markierterBegriff.name}:</b> {markierterBegriff.text}
        </div>
      )}
      {schilderAn && !quiz && (
        <div className="flex flex-wrap gap-1.5">
          {zuletzt.current.begriffe.map(b => (
            <button key={b.id} onClick={() => setMarkiert(markiert === b.id ? null : b.id)}
              className={`px-2 py-0.5 rounded-full text-xs border ${markiert === b.id ? "bg-amber-400 text-black border-amber-500" : "border-(--border) hover:bg-(--surface-hover)"}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Küstenschutz */}
      <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3">
        <h3 className="font-black">🏗️ Küstenschutz — was tun wir?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {massnahmenFuer(art).map(m => (
            <div key={m.id} className="rounded-xl border border-(--border) p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <b>{m.icon} {m.name}</b>
                <span className="text-xs text-(--text-muted) whitespace-nowrap">≈ {zahl(m.kosten, m.kosten < 1 ? 2 : 0)} Mio. €/km</span>
              </div>
              <p className="text-xs text-(--text-muted)">{m.was}</p>
              {offen === m.id && (
                <div className="text-xs flex flex-col gap-1">
                  <p><b className="text-green-600 dark:text-green-400">＋</b> {m.plus}</p>
                  <p><b className="text-red-600 dark:text-red-400">－</b> {m.minus}</p>
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <button onClick={() => massnahme(m.id)} className="px-3 py-1 rounded-lg text-sm font-bold bg-(--accent) text-(--accent-text,#111)">Bauen</button>
                <button onClick={() => setOffen(offen === m.id ? null : m.id)} className="px-3 py-1 rounded-lg text-sm border border-(--border) hover:bg-(--surface-hover)">
                  {offen === m.id ? "weniger" : "Vor- und Nachteile"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-4">
          <h3 className="font-black mb-2">📍 {BEISPIEL[art].titel}</h3>
          <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
            {BEISPIEL[art].punkte.map(t => <li key={t}>{t}</li>)}
          </ul>
        </section>
        {(
          <section className="rounded-2xl border border-(--border) bg-(--surface) p-4">
            <h3 className="font-black mb-2">💡 Ausprobieren</h3>
            <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
              {art === "flach" ? <>
                <li>Wind auf 3 Bft: der Strand wächst langsam wieder (Strandwall). Auf 9 Bft: Sand geht ins Riff.</li>
                <li>»Jahreslauf« und 1 Jahr/s: wie schnell verschwindet der Strand ohne Schutz?</li>
                <li>Deckwerk bauen, dann Sturmflut: was passiert mit dem Strand <i>vor</i> der Mauer?</li>
                <li>Riff aufspülen und Wellen beobachten: wo brechen sie jetzt?</li>
              </> : <>
                <li>»Schwere Sturmflut« mit dem alten Deich — und danach dieselbe mit dem verstärkten.</li>
                <li>Achte auf die Wellen über dem Vorland: die Salzwiese bremst sie.</li>
                <li>Lahnungen bauen und im Jahreslauf 20 Jahre warten.</li>
                <li>Warum liegt der Koog tiefer als das Hochwasser draußen?</li>
              </>}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** Ein Satz dazu, was die Küste gerade erlebt */
function lageText(p: Profil, w: Wetter, W: number, H0: number, Hs: number): string {
  if (p.deichGebrochen) return "Der Deich ist gebrochen: Das Meer strömt ungehindert in den Koog. So war es 1962 an vielen Stellen.";
  if (p.flut) return `Sturmflut: Der Sturm drückt das Wasser gegen die Küste, es steht ${zahl(W)} m über NHN. Die Wellen erreichen Stellen, die sonst trocken sind.`;
  if (p.art === "steil") {
    if (p.kehle > 0.8) return `Die Brandungshohlkehle ist schon ${Math.round(p.kehle * 100)} cm tief. Die Wand darüber hängt fast frei — bald bricht sie ab.`;
    if (p.verwitterung > 0.8) return "Frost und Regen haben die Wand gelockert: Risse ziehen sich durch die Kante. Auch ohne Brandung kann sie jetzt abbrechen.";
    if (w.bft >= 6 && w.auflandig) return "Die Brandung räumt die Kliffhalde ab. Erst wenn sie weg ist, schlagen die Wellen direkt gegen die Wand.";
    return "Ruhiges Wetter. Das Kliff wartet — seine Feinde sind Brandung, Frost, Regen und Wurzeln.";
  }
  if (H0 >= 2 && w.auflandig) {
    if (p.art === "marsch") return `Sturm: Über dem Watt werden die Wellen flach, und das Vorland bremst sie weiter — am Deich kommen noch ${zahl(Hs)} m an.`;
    return `Sturm: Die Wellen brechen schon weit draußen am Sandriff. Was am Strand ankommt, spült Sand ins tiefe Wasser.`;
  }
  if (w.auflandig && w.bft >= 4 && !w.regen && p.art === "flach") return "Frischer Wind vom Meer: Er bläst trockenen Sand vom Strand in die Düne. Der Strandhafer hält ihn fest.";
  if (H0 < 1.5 && p.art === "flach") return "Ruhiges Wetter: Kleine Wellen schieben Sand aus dem Riff zurück und bauen den Strandwall auf.";
  if (p.art === "marsch") return "Bei Ebbe fällt das Watt trocken, bei Flut steht es unter Wasser. Der Deich wartet auf den nächsten Sturm.";
  return "Die Küste ruht — aber nie lange.";
}
