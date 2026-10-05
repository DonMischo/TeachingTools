"use client";
/**
 * Wilson-Zyklus — wie Ozeane entstehen und wieder verschwinden.
 *
 * Reiter:
 *   Querschnitt — ein Zyklus im Zeitraffer: Superkontinent, Grabenbruch,
 *                 junges Meer, Ozean, Subduktion, Kollision, Abtragung
 *   Quiz        — Welche Phase ist das?
 *   Wissen      — echte Zyklen (Iapetus, Rheischer Ozean, Tethys), Quellen
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PHASEN, ZYKLUS, phaseBei, streifen, zustand, type Phase,
} from "@/lib/wilson/modell";
import { spalten, zeichne } from "./zeichnen";
import { wahl, type Vorgabe } from "@/lib/vorgabe";

type Reiter = "schnitt" | "quiz" | "wissen";

const REITER: { id: Reiter; icon: string; label: string }[] = [
  { id: "schnitt", icon: "🌋", label: "Querschnitt" },
  { id: "quiz", icon: "🎯", label: "Welche Phase?" },
  { id: "wissen", icon: "📘", label: "Wissen" },
];

const PHASE_FARBE: Record<string, string> = {
  ruhe: "#a16207", graben: "#b45309", jung: "#0e7490", ozean: "#1d4ed8",
  subduktion: "#7c3aed", schliessen: "#9333ea", kollision: "#be123c", abtragung: "#4d7c0f",
};

/**
 * `vorgabe` (TaskCrawler-Station): `{ reiter: "schnitt" | "quiz" | "wissen" }` legt den Reiter fest
 * und blendet die Reiterleiste aus; `{ phase: <Phasen-Id> }` stellt den Querschnitt auf den
 * Beginn dieser Phase (Ids in PHASEN).
 */
export default function WilsonZyklus({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", ["schnitt", "quiz", "wissen"] as const);
  const phase = PHASEN.find(p => p.id === wahl(vorgabe, "phase", PHASEN.map(p => p.id)));
  const [reiter, setReiter] = useState<Reiter>(festerReiter ?? "schnitt");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-(--seite-breite) mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🌋 Wilson-Zyklus</h1>
          <p className="text-(--text-muted) text-sm mt-1">
            Ein Kontinent zerbricht, ein Ozean öffnet sich — und schließt sich nach Hunderten Millionen Jahren wieder zu einem Gebirge.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-(--border) p-1 bg-(--surface)">
        {REITER.map(r => (
          <button key={r.id} onClick={() => setReiter(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              reiter === r.id ? "bg-(--accent) text-(--accent-text,#111)" : "text-(--text-muted) hover:text-(--text)"}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>}
      {reiter === "schnitt" && <Querschnitt start={phase?.von} />}
      {reiter === "quiz" && <Quiz />}
      {reiter === "wissen" && <Wissen />}
    </div>
  );
}

interface Schalter { beschriftung: boolean; konvektion: boolean; magnet: boolean; beben: boolean }

/** Canvas, das bei Zeit oder Schaltern neu zeichnet und für Strömung/Beben weiterläuft. */
function Buehne({ t, schalter }: { t: number; schalter: Schalter }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const zustandRef = useRef({ t, schalter });
  zustandRef.current = { t, schalter };
  useEffect(() => {
    let id = 0;
    const start = performance.now();
    const tick = () => {
      id = requestAnimationFrame(tick);
      const c = ref.current;
      if (!c) return;
      const { t, schalter } = zustandRef.current;
      zeichne(c.getContext("2d")!, c.width, c.height, t, { ...schalter, uhr: (performance.now() - start) / 1000 });
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} width={1200} height={600} className="w-full rounded-2xl border border-(--border)" />;
}

const TEMPI = [5, 10, 20, 40];

function Querschnitt({ start = 0 }: { start?: number }) {
  const [t, setT] = useState(start);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(10);
  const [schalter, setSchalter] = useState<Schalter>({ beschriftung: true, konvektion: true, magnet: true, beben: true });
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!laeuft) return;
    let id = 0, letzte = performance.now();
    const tick = (jetzt: number) => {
      const neu = (tRef.current + ((jetzt - letzte) / 1000) * tempo) % ZYKLUS;
      letzte = jetzt;
      setT(neu);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [laeuft, tempo]);

  const z = zustand(t);
  const ph = z.phase;
  const aeltester = Math.max(0, ...streifen(t).filter(s => s.abgetaucht === 0).map(s => s.alter));
  // Höchste Stelle im Bild — auch ein Vulkan am Bogen zählt.
  const gipfel = Math.max(0, ...spalten(t).map(s => -s.oben));
  const umschalten = (k: keyof Schalter) => setSchalter(s => ({ ...s, [k]: !s[k] }));

  return (
    <div className="flex flex-col gap-3">
      <Buehne t={t} schalter={schalter} />

      {/* Zeitleiste mit Phasen */}
      <div className="flex flex-col gap-1">
        <div className="relative h-8 rounded-lg overflow-hidden flex text-[11px] font-bold text-white">
          {PHASEN.map(p => (
            <button key={p.id} onClick={() => { setLaeuft(false); setT(p.von + 0.01); }}
              className={`h-full flex items-center justify-center px-1 truncate transition-opacity ${ph.id === p.id ? "opacity-100" : "opacity-60 hover:opacity-90"}`}
              style={{ width: `${((p.bis - p.von) / ZYKLUS) * 100}%`, background: PHASE_FARBE[p.id] }} title={p.name}>
              {p.name}
            </button>
          ))}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: `${(t / ZYKLUS) * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={() => setLaeuft(l => !l)} className="px-3 py-1 rounded-lg font-bold bg-(--accent) text-(--accent-text,#111)">
            {laeuft ? "⏸ anhalten" : "▶ abspielen"}
          </button>
          <input type="range" min={0} max={ZYKLUS - 0.1} step={0.1} value={t} onChange={e => { setLaeuft(false); setT(+e.target.value); }} className="flex-1 min-w-[200px]" />
          <span className="font-mono w-36 text-right">{Math.round(t)} Mio. Jahre</span>
          <select value={tempo} onChange={e => setTempo(+e.target.value)} className="rounded-lg border border-(--border) bg-(--surface) px-2 py-1 text-xs">
            {TEMPI.map(v => <option key={v} value={v}>{v} Mio. J/s</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1">
          {([["beschriftung", "🏷️ Namen"], ["konvektion", "🔥 Mantelströmung"], ["magnet", "🧲 Magnetstreifen"], ["beben", "💥 Erdbeben"]] as [keyof Schalter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => umschalten(k)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${schalter[k] ? "bg-(--accent) text-(--accent-text,#111) border-transparent" : "border-(--border) text-(--text-muted)"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
        <PhasenKarte phase={ph} />
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 text-sm flex flex-col gap-1">
          <Zahl k="Breite des Ozeans" v={z.ozeanBreite > 0 ? `${Math.round(z.ozeanBreite).toLocaleString("de-DE")} km` : "—"} />
          <Zahl k="ältester Meeresboden" v={aeltester > 0 ? `${Math.round(aeltester)} Mio. Jahre` : "—"} />
          <Zahl k="höchster Gipfel" v={`${gipfel.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`} />
          <Zahl k="Rücken" v={z.ruecken != null ? "aktiv" : "—"} />
          <Zahl k="Tiefseerinne" v={z.rinne != null ? "aktiv" : "—"} />
          <p className="text-xs text-(--text-muted) mt-2">Höhen und Tiefen sind überhöht, die Tiefe nach unten gestaucht (Skala links).</p>
        </section>
      </div>
    </div>
  );
}

function Zahl({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-(--border) last:border-0 py-1">
      <span className="text-(--text-muted)">{k}</span><b>{v}</b>
    </div>
  );
}

function PhasenKarte({ phase }: { phase: Phase }) {
  const nr = PHASEN.indexOf(phase) + 1;
  return (
    <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 text-sm leading-relaxed flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black" style={{ background: PHASE_FARBE[phase.id] }}>{nr}</span>
        <h3 className="font-black text-lg">{phase.name}</h3>
        <span className="text-xs text-(--text-muted)">heute zu sehen: <b className="text-(--text)">{phase.beispiel}</b></span>
      </div>
      <p>{phase.text}</p>
      <p className="text-xs"><b>Plattengrenzen:</b> {phase.grenzen}</p>
      <div className="flex flex-wrap gap-1">
        {phase.begriffe.map(b => <span key={b} className="text-xs px-2 py-0.5 rounded-full border border-(--border) bg-(--bg)">{b}</span>)}
      </div>
    </section>
  );
}

const AUS: Schalter = { beschriftung: false, konvektion: true, magnet: true, beben: true };

function Quiz() {
  const neu = () => {
    const p = PHASEN[Math.floor(Math.random() * PHASEN.length)];
    return p.von + (0.2 + Math.random() * 0.6) * (p.bis - p.von);
  };
  const [t, setT] = useState(neu);
  const [antwort, setAntwort] = useState<string | null>(null);
  const [punkte, setPunkte] = useState({ richtig: 0, gefragt: 0 });
  const richtig = phaseBei(t);

  function waehle(id: string) {
    if (antwort) return;
    setAntwort(id);
    setPunkte(p => ({ richtig: p.richtig + (id === richtig.id ? 1 : 0), gefragt: p.gefragt + 1 }));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">Welche Phase des Wilson-Zyklus zeigt der Querschnitt? <b>{punkte.richtig} von {punkte.gefragt}</b> richtig.</p>
      <Buehne t={t} schalter={AUS} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PHASEN.map(p => {
          const stil = !antwort ? "border-(--border) hover:bg-(--surface-hover)"
            : p.id === richtig.id ? "bg-green-600 text-white border-transparent"
            : p.id === antwort ? "bg-red-600 text-white border-transparent" : "border-(--border) opacity-60";
          return (
            <button key={p.id} onClick={() => waehle(p.id)} className={`rounded-xl border px-3 py-2 text-sm font-bold text-left ${stil}`}>
              {p.name}
            </button>
          );
        })}
      </div>
      {antwort && (
        <div className="flex flex-col gap-2">
          <PhasenKarte phase={richtig} />
          <button onClick={() => { setT(neu()); setAntwort(null); }} className="self-start px-4 py-2 rounded-lg font-bold bg-(--accent) text-(--accent-text,#111)">Nächstes Bild →</button>
        </div>
      )}
    </div>
  );
}

function Karte({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 text-sm leading-relaxed flex flex-col gap-2">
      <h3 className="font-black text-base">{titel}</h3>
      {children}
    </section>
  );
}

function Wissen() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Karte titel="🧭 Die Idee von J. Tuzo Wilson">
        <p>1966 fragte der kanadische Geophysiker <b>John Tuzo Wilson</b>: »Hat sich der Atlantik geschlossen und dann wieder geöffnet?« Er hatte bemerkt, dass die Gesteine und Fossilien beiderseits des Atlantiks nicht zur heutigen Küste passen, sondern zu einer älteren Naht mitten im Land. Seine Antwort: Ozeane öffnen und schließen sich immer wieder — und oft reißen sie an alten Nähten wieder auf.</p>
        <p>Ein Umlauf dauert etwa <b>300–500 Millionen Jahre</b>. Seit es Plattentektonik gibt, hat die Erde mehrere Superkontinente gebildet und wieder zerlegt.</p>
      </Karte>
      <Karte titel="🌍 Superkontinente">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><b>Columbia (Nuna)</b> — vor etwa 1,8 Milliarden Jahren</li>
          <li><b>Rodinia</b> — vor etwa 1,1 Mrd. bis 750 Mio. Jahren</li>
          <li><b>Pangäa</b> — vor etwa 335 bis 175 Mio. Jahren; umgeben vom Ozean Panthalassa</li>
          <li><b>Zukunft:</b> In 200–250 Mio. Jahren vielleicht »Pangäa Ultima« oder »Amasia« — je nachdem, ob sich der Atlantik oder der Pazifik schließt.</li>
        </ul>
      </Karte>
      <Karte titel="🇩🇪 Wilson-Zyklen unter unseren Füßen">
        <p><b>Rheischer Ozean → Variszisches Gebirge:</b> Vor etwa 380–300 Mio. Jahren schloss sich ein Ozean zwischen Gondwana und Laurussia. Das Gebirge, das dabei entstand, war so hoch wie heute die Alpen. Seine abgetragenen Reste sind <b>Harz, Thüringer Wald, Thüringer Schiefergebirge, Erzgebirge, Schwarzwald</b> — Rumpfgebirge, Phase 8.</p>
        <p><b>Iapetus → Kaledoniden und Appalachen:</b> Ein älterer Ozean schloss sich vor rund 420 Mio. Jahren. Als Pangäa zerbrach, öffnete sich der Atlantik fast an derselben Naht — genau das hatte Wilson bemerkt.</p>
        <p><b>Tethys → Alpen und Himalaya:</b> Die Tethys wird gerade verschluckt. Das Mittelmeer ist ihr Rest (Phase 6), in den Alpen und im Himalaya stoßen die Kontinente schon zusammen (Phase 7).</p>
        <p><b>Oberrheingraben:</b> ein Grabenbruch (Phase 2), der steckengeblieben ist — er reißt seit 45 Mio. Jahren, aber nur wenig.</p>
      </Karte>
      <Karte titel="⚙️ Was die Platten antreibt">
        <p>Der Mantel strömt, weil ihn der Kern und radioaktiver Zerfall heizen (Reiter »Mantelkonvektion« in »Aufbau der Erde«). Die stärkste Kraft ist aber der <b>Plattenzug</b> (Slab Pull): Alter, kalter Meeresboden ist schwerer als der Mantel und zieht die Platte hinter sich in die Tiefe. Dazu kommt der <b>Rückenschub</b> (Ridge Push): Die Platte gleitet vom hohen, warmen Rücken hinab.</p>
        <p>Ein Superkontinent wirkt wie eine Decke: Darunter staut sich Wärme, heißes Gestein steigt auf, die Kruste wölbt sich und reißt — der Zyklus beginnt von vorn.</p>
      </Karte>
      <Karte titel="🧲 Beweise für die Meeresbodenspreizung">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><b>Magnetstreifen</b> (Vine & Matthews 1963): Beim Erkalten friert das Gestein die Richtung des Erdmagnetfelds ein. Weil es sich oft umpolt, entsteht ein Streifenmuster — spiegelbildlich zum Rücken.</li>
          <li><b>Alter des Meeresbodens</b>: Nirgends älter als etwa 180–200 Mio. Jahre — älterer ist längst abgetaucht. Kontinente dagegen sind bis zu 4 Mrd. Jahre alt.</li>
          <li><b>Tiefe</b>: Der Meeresboden sinkt mit dem Alter ab, weil er abkühlt und schrumpft: am Rücken 2,5 km, am Rand 6 km.</li>
          <li><b>Erdbeben</b> ordnen sich an Rücken, Gräben und Rinnen an; unter Tiefseerinnen reichen sie schräg bis 700 km tief (Wadati-Benioff-Zone).</li>
        </ul>
      </Karte>
      <Karte titel="🔬 Wie genau ist das Modell?">
        <p>Ein kinematisches Schulmodell: Die Platten bewegen sich mit festen Geschwindigkeiten (Öffnen 3 cm/Jahr, Schließen 4 cm/Jahr), der Meeresboden wird mit dem Alter tiefer (Parsons & Sclater) und dicker, die Gebirgshöhe folgt der Krustendicke (Airy-Isostasie). Die Kräfte selbst werden nicht gerechnet. Echte Ozeane sind nicht spiegelbildlich, und Subduktion beginnt oft an einer anderen Stelle als am alten Rand. Weil im Modell nur vor Kontinent B Meeresboden abtaucht, wird der Boden vor Kontinent A älter als die rund 180 Mio. Jahre, die man heute höchstens findet.</p>
      </Karte>
      <Karte titel="📚 Quellen">
        <ul className="list-disc pl-5 text-xs flex flex-col gap-1">
          <li>Wilson, J. T. (1966): Did the Atlantic close and then re-open? Nature 211, 676–681.</li>
          <li>Vine, F. J. & Matthews, D. H. (1963): Magnetic anomalies over oceanic ridges. Nature 199, 947–949.</li>
          <li>Parsons, B. & Sclater, J. G. (1977): An analysis of the variation of ocean floor bathymetry and heat flow with age. JGR 82, 803–827.</li>
          <li>Frisch, W., Meschede, M. & Blakey, R.: Plattentektonik (Primus, 2009).</li>
          <li>Nance, R. D. et al. (2014): The supercontinent cycle: A retrospective essay. Gondwana Research 25, 4–29.</li>
        </ul>
      </Karte>
    </div>
  );
}
