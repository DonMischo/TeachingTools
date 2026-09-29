"use client";
/**
 * Die Erde im Keilschnitt: drehen, Schichten antippen, Schale für Schale
 * abziehen, nach Temperatur/Dichte/Zustand einfärben, Mantelkonvektion live.
 */
import { useEffect, useRef, useState } from "react";
import { SCHICHTEN, SCHICHT_NACH_ID } from "@/lib/erde/schichten";
import { FARBMODI, type Farbmodus } from "@/lib/erde/farben";
import { tempoAusStufe } from "@/lib/erde/konvektion";
import { KeilSzene, type Keilform } from "./keilSzene";
import SchichtInfo from "./SchichtInfo";
import { webglVerfuegbar } from "@/components/sonnensystem/szene";

/** Wo die Beschriftung sitzt: Tiefe (Mitte der Schicht), Höhenwinkel, Fläche. */
const ANKER: Record<string, [number, number]> = {
  kruste: [70, 1], lithomantel: [62, 0], astheno: [48, 1], oberermantel: [42, 0],
  uebergang: [34, 1], unterermantel: [30, 0], dzwei: [22, 1], aussenkern: [45, 0], innenkern: [30, 1],
};

const Knopf = ({ an, onClick, children, titel }: { an?: boolean; onClick: () => void; children: React.ReactNode; titel?: string }) => (
  <button onClick={onClick} title={titel}
    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${an
      ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent"
      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
    {children}
  </button>
);

interface Quiz { ziel: string; richtig: number; gefragt: number; meldung: string | null }

export default function Keil3D() {
  const buehneRef = useRef<HTMLDivElement>(null);
  const szeneRef = useRef<KeilSzene | null>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const jahreRef = useRef<HTMLSpanElement>(null);
  const rateRef = useRef<HTMLSpanElement>(null);
  const [fehlt, setFehlt] = useState(false);
  const [form, setForm] = useState<Keilform>("achtel");
  const [winkel, setWinkel] = useState(90);
  const [ueberhoeht, setUeberhoeht] = useState(true);
  const [farbmodus, setFarbmodus] = useState<Farbmodus>("schichten");
  const [konvektion, setKonvektion] = useState(true);
  const [tempoStufe, setTempoStufe] = useState(35);
  const tempo = tempoAusStufe(tempoStufe);
  const [abgezogen, setAbgezogen] = useState(0);
  const [beschriftung, setBeschriftung] = useState(true);
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>("kruste");
  const [hover, setHover] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  const abgezogenRef = useRef(abgezogen);
  abgezogenRef.current = abgezogen;
  const beschriftungRef = useRef(beschriftung);
  beschriftungRef.current = beschriftung && !quiz;

  useEffect(() => {
    const buehne = buehneRef.current;
    if (!buehne) return;
    if (!webglVerfuegbar()) { setFehlt(true); return; }
    const s = new KeilSzene(buehne);
    szeneRef.current = s;
    s.beiHover = setHover;
    s.beiKlick = id => {
      const q = quizRef.current;
      if (q) {
        if (!id) return;
        const ok = id === q.ziel;
        setQuiz({
          ...q, gefragt: q.gefragt + 1, richtig: q.richtig + (ok ? 1 : 0),
          ziel: ok ? neuesZiel(abgezogenRef.current, q.ziel) : q.ziel,
          meldung: ok ? `✅ Richtig: ${SCHICHT_NACH_ID[id].name}` : `❌ Das war: ${SCHICHT_NACH_ID[id].name}`,
        });
        return;
      }
      setAusgewaehlt(id);
    };
    s.beiBild = projiziere => {
      SCHICHTEN.forEach((sch, i) => {
        const el = labelRefs.current[sch.id];
        if (!el) return;
        const zeigen = beschriftungRef.current && i >= abgezogenRef.current;
        const [hoehe, flaeche] = ANKER[sch.id];
        const p = zeigen ? projiziere((sch.von + sch.bis) / 2, hoehe, flaeche) : null;
        if (!p || !p.vorne) { el.style.opacity = "0"; return; }
        el.style.opacity = "1";
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      });
      if (jahreRef.current) jahreRef.current.textContent = Math.round(s.konvektionsJahre).toLocaleString("de-DE");
      if (rateRef.current) rateRef.current.textContent = s.konvektionsRate.toLocaleString("de-DE", { maximumFractionDigits: s.konvektionsRate < 10 ? 1 : 0 });
    };
    return () => { s.entsorgen(); szeneRef.current = null; };
  }, []);

  useEffect(() => {
    szeneRef.current?.setzeOptionen({ form, winkel, ueberhoeht, farbmodus, konvektion, tempo, abgezogen, ausgewaehlt });
  }, [form, winkel, ueberhoeht, farbmodus, konvektion, tempo, abgezogen, ausgewaehlt]);

  const oben = SCHICHTEN[Math.min(abgezogen, SCHICHTEN.length - 1)];
  const info = SCHICHT_NACH_ID[ausgewaehlt ?? ""] ?? null;

  function quizStarten() {
    setQuiz({ ziel: neuesZiel(abgezogen, null), richtig: 0, gefragt: 0, meldung: null });
  }

  if (fehlt) {
    return <p className="text-sm text-[var(--text-muted)]">Dieser Browser kann kein WebGL — die 3D-Ansicht geht leider nicht. Die anderen Reiter funktionieren.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
      <div className="flex flex-col gap-2">
        <div ref={buehneRef} className="relative w-full aspect-[4/3] min-h-[340px] rounded-2xl overflow-hidden border border-[var(--border)] bg-[radial-gradient(circle_at_50%_45%,#1b2740,#070b14)]">
          {SCHICHTEN.map(s => (
            <div key={s.id} ref={el => { labelRefs.current[s.id] = el; }}
              className="absolute left-0 top-0 pointer-events-none text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white whitespace-nowrap transition-opacity"
              style={{ opacity: 0 }}>
              {s.name}
            </div>
          ))}
          <div className="absolute left-2 top-2 text-[11px] text-white/80 bg-black/40 rounded px-2 py-1 pointer-events-none">
            {hover ? SCHICHT_NACH_ID[hover].name : "ziehen = drehen · Rad = zoomen · antippen = Infos"}
          </div>
          {konvektion && abgezogen <= 2 && (
            <div className="absolute right-2 bottom-2 text-[11px] text-white/80 bg-black/40 rounded px-2 py-1 pointer-events-none">
              🔥 Mantelkonvektion · Modellzeit ≈ <span ref={jahreRef}>0</span> Mio. Jahre (<span ref={rateRef}>0</span> Mio. J/s)
            </div>
          )}
          {ueberhoeht && (
            <div className="absolute left-2 bottom-2 text-[11px] text-white/70 bg-black/40 rounded px-2 py-1 pointer-events-none">
              Außenschichten überhöht — nicht maßstäblich
            </div>
          )}
          {quiz && (
            <div className="absolute inset-x-2 top-10 flex justify-center pointer-events-none">
              <div className="rounded-xl bg-black/75 text-white px-4 py-2 text-sm text-center">
                <div>Tippe auf: <b className="text-yellow-300">{SCHICHT_NACH_ID[quiz.ziel].name}</b></div>
                <div className="text-xs opacity-80">{quiz.meldung ?? " "} · {quiz.richtig}/{quiz.gefragt}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setAbgezogen(a => Math.min(SCHICHTEN.length - 1, a + 1))}
            disabled={abgezogen >= SCHICHTEN.length - 1}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[var(--accent)] text-[var(--accent-text,#111)] disabled:opacity-40">
            🧅 Schale abziehen
          </button>
          <button onClick={() => setAbgezogen(a => Math.max(0, a - 1))} disabled={abgezogen === 0}
            className="px-3 py-1.5 rounded-lg text-sm font-bold border border-[var(--border)] disabled:opacity-40">
            ↩ zurücklegen
          </button>
          <button onClick={() => setAbgezogen(0)} disabled={abgezogen === 0}
            className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] disabled:opacity-40">
            alle zurück
          </button>
          <span className="text-sm text-[var(--text-muted)]">außen liegt jetzt: <b className="text-[var(--text)]">{oben.name}</b> ({oben.von.toLocaleString("de-DE")} km tief)</span>
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-xs text-[var(--text-muted)] w-16">Schnitt</span>
            <Knopf an={form === "achtel"} onClick={() => setForm("achtel")}>Achtel</Knopf>
            <Knopf an={form === "keil"} onClick={() => setForm("keil")}>Keil (Pol zu Pol)</Knopf>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--text-muted)] w-16">Öffnung</span>
            <input type="range" min={30} max={180} step={5} value={winkel} onChange={e => setWinkel(+e.target.value)} className="flex-1" />
            <span className="w-9 text-right font-bold">{winkel}°</span>
          </label>
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-xs text-[var(--text-muted)] w-16">Farben</span>
            {FARBMODI.map(f => <Knopf key={f.id} an={farbmodus === f.id} onClick={() => setFarbmodus(f.id)}>{f.label}</Knopf>)}
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-xs text-[var(--text-muted)] w-16">Zeigen</span>
            <Knopf an={konvektion} onClick={() => setKonvektion(k => !k)} titel="Der Mantel strömt — gerechnet mit einem echten Konvektionslöser">🔥 Konvektion</Knopf>
            <Knopf an={beschriftung} onClick={() => setBeschriftung(b => !b)}>🏷️ Namen</Knopf>
            <Knopf an={ueberhoeht} onClick={() => setUeberhoeht(u => !u)} titel="Kruste und oberer Mantel sind in Wahrheit hauchdünn">🔍 Außen dicker</Knopf>
          </div>
          {konvektion && (
            <label className="flex items-center gap-2 text-xs" title="Wie schnell die Mantelkonvektion abläuft">
              <span className="text-[var(--text-muted)] w-16">Tempo</span>
              <span>🐢</span>
              <input type="range" min={0} max={100} value={tempoStufe} onChange={e => setTempoStufe(+e.target.value)} className="flex-1" />
              <span>🐇</span>
            </label>
          )}
          <Legende modus={farbmodus} />
          <div className="flex gap-2">
            {quiz
              ? <Knopf an onClick={() => setQuiz(null)}>Quiz beenden</Knopf>
              : <Knopf onClick={quizStarten}>🎯 Quiz: Schichten finden</Knopf>}
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          {info ? <SchichtInfo schicht={info} /> : <p className="text-sm text-[var(--text-muted)]">Tippe eine Schicht an.</p>}
        </section>
      </aside>
    </div>
  );
}

function neuesZiel(abgezogen: number, alt: string | null): string {
  const moeglich = SCHICHTEN.slice(abgezogen).map(s => s.id).filter(id => id !== alt);
  return moeglich[Math.floor(Math.random() * moeglich.length)] ?? SCHICHTEN[SCHICHTEN.length - 1].id;
}

function Legende({ modus }: { modus: Farbmodus }) {
  if (modus === "temperatur") {
    return <Skala links="15 °C" rechts="5400 °C" bild="linear-gradient(90deg,#1f0d33,#730f40,#d9331a,#fa9919,#ffe566,#fffff0)" />;
  }
  if (modus === "dichte") {
    return <Skala links="2,6 g/cm³" rechts="13 g/cm³" bild="linear-gradient(90deg,#440054,#3b528c,#21918c,#5ec962,#fde725)" />;
  }
  if (modus === "zustand") {
    return (
      <div className="flex gap-3 text-xs">
        <span><i className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: "#8c94a3" }} />fest</span>
        <span><i className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: "#ed8c33" }} />fest, aber fließend</span>
        <span><i className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: "#339ef2" }} />flüssig</span>
      </div>
    );
  }
  return null;
}

function Skala({ links, rechts, bild }: { links: string; rechts: string; bild: string }) {
  return (
    <div className="text-xs">
      <div className="h-2.5 rounded-full" style={{ background: bild }} />
      <div className="flex justify-between text-[var(--text-muted)] mt-0.5"><span>{links}</span><span>{rechts}</span></div>
    </div>
  );
}
