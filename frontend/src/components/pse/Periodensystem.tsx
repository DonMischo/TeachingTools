"use client";
/**
 * Simulation »Periodensystem«: das Raster zum Anklicken.
 *
 * Links das vollständige PSE in den üblichen 18 Spalten, rechts (auf schmalen
 * Geräten darunter) der Steckbrief des gewählten Elements — mit Foto der
 * Stoffprobe, Kenndaten und den typischen Reaktionen. Jede Reaktion führt mit
 * einem Klick in die Gleichungswaage, wo sie ausgeglichen wird.
 */
import { useMemo, useState, type ReactNode } from "react";
import { KATEGORIEN, PSE, pseElement, suche, type Kategorie, type PseElement } from "@/lib/pse/elemente";
// »text« heisst hier schon das Suchfeld — deshalb unter anderem Namen.
import { text as vorgabeText, type Vorgabe } from "@/lib/vorgabe";
import Steckbrief from "./Steckbrief";
import RallyePanel from "./RallyePanel";
import { useRallye } from "./useRallye";
import { elementeIm } from "@/lib/pse/rallye";

const SPALTEN = 18;
const ZEILEN = 10;

/** Die Hauptgruppen stehen über dem Raster, die Perioden daneben. */
const GRUPPEN_KOPF = ["I", "II", "", "", "", "", "", "", "", "", "", "", "III", "IV", "V", "VI", "VII", "VIII"];

function Kachel({ e, aktiv, gedimmt, marke, onClick }: {
  e: PseElement; aktiv: boolean; gedimmt: boolean;
  /** Rückmeldung der Rallye: richtig, falsch oder die gezeigte Lösung. */
  marke?: "richtig" | "falsch" | "loesung";
  onClick: () => void;
}) {
  const farbe = marke === "richtig" || marke === "loesung" ? "var(--good)"
    : marke === "falsch" ? "var(--bad)"
      : KATEGORIEN[e.kategorie].farbe;
  return (
    <button
      onClick={onClick}
      style={{ gridColumn: e.spalte, gridRow: e.zeile,
        background: marke ? `color-mix(in srgb, ${farbe} 35%, transparent)` : `${farbe}${gedimmt ? "18" : "33"}`,
        borderColor: aktiv || marke ? farbe : `${farbe}66` }}
      title={`${e.name} — ${KATEGORIEN[e.kategorie].label}`}
      className={`rounded-md border-2 px-0.5 py-1 text-center leading-none transition-opacity hover:brightness-110 ${
        gedimmt ? "opacity-40" : ""} ${aktiv ? "ring-2 ring-accent" : ""}`}
    >
      <div className="text-[8px] text-muted tabular-nums">{e.z}</div>
      <div className="text-[13px] sm:text-base font-black">{e.symbol}</div>
      <div className="hidden sm:block text-[8px] text-muted truncate">{e.name}</div>
    </button>
  );
}

/**
 * `vorgabe` (TaskCrawler-Station) schlaegt ein Element auf:
 *   { element: "Fe" }  oder  { element: "Eisen" }
 */
export default function Periodensystem({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const [modus, setModus] = useState<"nachschlagen" | "rallye">("nachschlagen");
  const rallye = useRallye();
  const [gewaehlt, setGewaehlt] = useState<PseElement | null>(() => {
    const wunsch = vorgabeText(vorgabe, "element");
    return wunsch ? pseElement(wunsch) ?? suche(wunsch)[0] ?? null : null;
  });
  const [filter, setFilter] = useState<Kategorie | null>(null);
  const [text, setText] = useState("");

  const treffer = useMemo(() => new Set(text.trim() ? suche(text).map(e => e.z) : []), [text]);

  const gedimmt = (e: PseElement): boolean => {
    // In der Rallye wird nicht gefiltert, aber alles außerhalb des gewählten
    // Bereichs tritt zurück — dort gibt es nichts zu suchen.
    if (modus === "rallye") return !imBereich.has(e.z);
    return (filter !== null && e.kategorie !== filter) || (treffer.size > 0 && !treffer.has(e.z));
  };

  const imBereich = useMemo(
    () => new Set(elementeIm(rallye.bereich).map(e => e.z)), [rallye.bereich]);

  /** Welche Kachel die Rallye gerade hervorhebt. */
  const markeFuer = (e: PseElement): "richtig" | "falsch" | "loesung" | undefined => {
    if (modus !== "rallye" || !rallye.aufgabe) return undefined;
    if (rallye.rueckmeldung?.z === e.z) return rallye.rueckmeldung.richtig ? "richtig" : "falsch";
    // Nach dem Aufgeben die Lösung zeigen.
    if (rallye.geloest && !rallye.rueckmeldung?.richtig && rallye.aufgabe.loesung.includes(e.z)) return "loesung";
    return undefined;
  };

  const klick = (e: PseElement) => {
    if (modus === "rallye") rallye.antworte(e.z);
    else setGewaehlt(e);
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧪 Periodensystem</h1>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Alle 118 Elemente, geordnet nach der Ordnungszahl. Elemente einer Spalte verhalten sich
            ähnlich — sie haben gleich viele Außenelektronen. Klick auf ein Feld für den Steckbrief.
          </p>
        </div>
        {action}
      </div>

      <div className="inline-flex self-start rounded-xl border border-line p-1 bg-surface">
        {([["nachschlagen", "🔎 Nachschlagen"], ["rallye", "🎯 PSE-Rallye"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setModus(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              modus === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {label}
          </button>
        ))}
      </div>

      {modus === "nachschlagen" && <div className="flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Suchen: Eisen, Fe, 26 …"
          className="px-3 py-1.5 rounded-xl border border-line bg-surface text-sm w-52"
        />
        {Object.entries(KATEGORIEN).map(([id, k]) => (
          <button
            key={id}
            onClick={() => setFilter(filter === id ? null : id as Kategorie)}
            style={{ background: `${k.farbe}${filter === id ? "55" : "22"}`, borderColor: `${k.farbe}88` }}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${filter === id ? "font-bold" : "text-muted"}`}
          >
            {k.label}
          </button>
        ))}
        {(filter || text) && (
          <button onClick={() => { setFilter(null); setText(""); }}
            className="px-2.5 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
            zurücksetzen
          </button>
        )}
      </div>}

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <div className="w-full xl:flex-1 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Kopfzeile mit den Hauptgruppen */}
            <div className="grid gap-0.5 sm:gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${SPALTEN}, minmax(0, 1fr))` }}>
              {GRUPPEN_KOPF.map((g, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-muted">{g}</div>
              ))}
            </div>
            <div
              className="grid gap-0.5 sm:gap-1"
              style={{
                gridTemplateColumns: `repeat(${SPALTEN}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${ZEILEN}, auto)`,
              }}
            >
              {PSE.map(e => (
                <Kachel key={e.z} e={e} aktiv={modus === "nachschlagen" && gewaehlt?.z === e.z}
                  gedimmt={gedimmt(e)} marke={markeFuer(e)} onClick={() => klick(e)} />
              ))}
              {/* Dort, wo der f-Block herausgenommen ist, steht sein Bereich */}
              {([[6, "57–71"], [7, "89–103"]] as const).map(([zeile, text]) => (
                <div key={zeile} style={{ gridColumn: 3, gridRow: zeile }}
                  className="rounded-md border-2 border-dashed border-line flex items-center justify-center text-[9px] text-muted tabular-nums">
                  {text}
                </div>
              ))}
              {/* Die Lücke zwischen Haupt- und f-Block sichtbar lassen */}
              <div style={{ gridColumn: "1 / 3", gridRow: 9 }} className="text-[10px] text-muted self-center text-right pr-2">
                Lanthanoide
              </div>
              <div style={{ gridColumn: "1 / 3", gridRow: 10 }} className="text-[10px] text-muted self-center text-right pr-2">
                Actinoide
              </div>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-[380px] shrink-0">
          {modus === "rallye"
            ? <RallyePanel r={rallye} />
            : gewaehlt
              ? <Steckbrief e={gewaehlt} onSchliessen={() => setGewaehlt(null)} />
              : <div className="card p-5 text-sm text-muted">
                  Noch kein Element gewählt. Klick auf ein Feld im Raster — der Steckbrief zeigt dann
                  Foto, Kenndaten und typische Reaktionen.
                </div>}
        </div>
      </div>
    </div>
  );
}
