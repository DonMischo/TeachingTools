"use client";
/**
 * Simulation »Periodensystem«: das Raster zum Anklicken.
 *
 * Links das vollständige PSE in den üblichen 18 Spalten, rechts (auf schmalen
 * Geräten darunter) der Steckbrief des gewählten Elements — mit Foto der
 * Stoffprobe, Kenndaten und den typischen Reaktionen. Jede Reaktion führt mit
 * einem Klick in die Gleichungswaage, wo sie ausgeglichen wird.
 */
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { dichteKachel, KATEGORIEN, PSE, pseElement, radioaktiv, suche, type Kategorie, type PseElement } from "@/lib/pse/elemente";
// »text« heisst hier schon das Suchfeld — deshalb unter anderem Namen.
import { text as vorgabeText, type Vorgabe } from "@/lib/vorgabe";
import Steckbrief from "./Steckbrief";
import RallyePanel from "./RallyePanel";
import { useRallye } from "./useRallye";
import { elementeIm } from "@/lib/pse/rallye";

const SPALTEN = 18;
const ZEILEN = 10;

/**
 * Über dem Raster stehen die Gruppennummern (1–18 nach IUPAC), darunter die
 * römische Nummer der Hauptgruppe — so steht es auch im Tafelwerk.
 */
const HAUPTGRUPPE_ROEMISCH: Record<number, string> = {
  1: "I", 2: "II", 13: "III", 14: "IV", 15: "V", 16: "VI", 17: "VII", 18: "VIII",
};

/** Zahl fürs Feld: deutsche Schreibweise, ohne überflüssige Nullen. */
const zahl = (n: number, stellen: number): string =>
  n.toLocaleString("de-DE", { maximumFractionDigits: stellen });

/**
 * Die Farbe des Symbols sagt den Aggregatzustand bei Zimmertemperatur —
 * wie im Tafelwerk: fest schwarz, flüssig blau, gasförmig rot.
 */
const ZUSTAND_FARBE: Record<string, string> = {
  fest: "var(--text)",
  "flüssig": "#2563eb",
  "gasförmig": "#dc2626",
};

/**
 * Ein Feld des Rasters.
 *
 * Memoisiert, weil 118 Felder nebeneinander stehen: ohne das zeichnet ein
 * einziger Klick das ganze Periodensystem neu. `onWahl` muss darum stabil
 * bleiben — deshalb bekommt es das Element übergeben, statt es einzuschließen.
 */
const Kachel = memo(function Kachel({ e, aktiv, gedimmt, marke, onWahl }: {
  e: PseElement; aktiv: boolean; gedimmt: boolean;
  /** Rückmeldung der Rallye: richtig, falsch oder die gezeigte Lösung. */
  marke?: "richtig" | "falsch" | "loesung";
  onWahl: (e: PseElement) => void;
}) {
  const farbe = marke === "richtig" || marke === "loesung" ? "var(--good)"
    : marke === "falsch" ? "var(--bad)"
      : KATEGORIEN[e.kategorie].farbe;
  const d = dichteKachel(e);
  return (
    <button
      onClick={() => onWahl(e)}
      style={{ gridColumn: e.spalte + 1, gridRow: e.zeile,
        background: marke ? `color-mix(in srgb, ${farbe} 35%, transparent)` : `${farbe}${gedimmt ? "18" : "33"}`,
        borderColor: aktiv || marke ? farbe : `${farbe}66` }}
      title={`${e.name} — ${KATEGORIEN[e.kategorie].label}`}
      className={`rounded-md border-2 px-1 pt-0.5 pb-1 leading-none transition-opacity hover:brightness-110 flex flex-col ${
        gedimmt ? "opacity-40" : ""} ${aktiv ? "ring-2 ring-accent" : ""}`}
    >
      {/* Kopfzeile: Ordnungszahl links, relative Atommasse rechts */}
      <div className="flex justify-between items-start text-[7px] text-muted tabular-nums w-full">
        <span>{e.z}</span>
        <span>{e.masse === null ? "" : zahl(e.masse, e.masse < 10 ? 3 : 2)}</span>
      </div>
      {/* Symbol, farbig nach Aggregatzustand; radioaktive unterstrichen */}
      <div className={`text-[15px] font-black text-center ${radioaktiv(e) ? "underline decoration-2 underline-offset-2" : ""}`}
        style={{ color: ZUSTAND_FARBE[e.zustand ?? ""] ?? "var(--text-muted)" }}>
        {e.symbol}
      </div>
      <div className="text-[6.5px] text-muted text-center truncate w-full">{e.name}</div>
      {/* Fußzeile: Elektronegativität links, Dichte rechts */}
      <div className="flex justify-between items-end text-[7px] text-muted tabular-nums w-full mt-auto">
        <span>{e.en === null ? "—" : zahl(e.en, 2)}</span>
        <span className={d?.gas ? "text-[#dc2626]" : ""}>{d ? zahl(d.wert, d.wert < 10 ? 2 : 1) : "?"}</span>
      </div>
    </button>
  );
});

/** Erklärt, was in einer Kachel wo steht — einmal als Beispielfeld. */
function Legende() {
  const paar = (links: string, rechts: string) => (
    <div className="flex justify-between gap-6 text-[10px] text-muted">
      <span>{links}</span><span>{rechts}</span>
    </div>
  );
  return (
    <div className="card p-3 flex items-center gap-4 flex-wrap">
      <div className="rounded-md border-2 px-1 pt-0.5 pb-1 leading-none flex flex-col w-[76px]"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex justify-between text-[7px] text-muted tabular-nums"><span>17</span><span>35,45</span></div>
        <div className="text-[15px] font-black text-center" style={{ color: ZUSTAND_FARBE["gasförmig"] }}>Cl</div>
        <div className="text-[6.5px] text-muted text-center">Chlor</div>
        <div className="flex justify-between text-[7px] text-muted tabular-nums"><span>3,16</span><span>3,21</span></div>
      </div>
      <div className="flex flex-col gap-0.5">
        {paar("Ordnungszahl", "rel. Atommasse")}
        {paar("Elektronegativität", "Dichte")}
      </div>
      <div className="text-[10px] text-muted leading-relaxed">
        Symbol: <span style={{ color: ZUSTAND_FARBE.fest }}>fest</span>,{" "}
        <span style={{ color: ZUSTAND_FARBE["flüssig"] }}>flüssig</span>,{" "}
        <span style={{ color: ZUSTAND_FARBE["gasförmig"] }}>gasförmig</span> ·{" "}
        <span className="underline decoration-2 underline-offset-2">unterstrichen</span> = radioaktiv
        <br />
        Dichte in g/cm³, bei <span className="text-[#dc2626]">Gasen</span> in g/l · Fläche = Kategorie
        <br />
        Zeilen = Perioden (Zahl links), Spalten = Gruppen (Zahl oben, römisch bei den Hauptgruppen)
      </div>
    </div>
  );
}

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

  const klick = useCallback((e: PseElement) => {
    if (modus === "rallye") rallye.antworte(e.z);
    else setGewaehlt(e);
  }, [modus, rallye.antworte]);

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

      {/* Das Raster braucht nun echte Breite. Der Steckbrief rückt erst daneben,
          wenn beides nebeneinander passt — sonst steht er darunter. */}
      <div className="flex flex-col 2xl:flex-row gap-5 items-start">
        <div className="w-full 2xl:flex-1 overflow-x-auto">
          {/* Links eine schmale Spalte für die Periodennummern, dann die 18 Gruppen. */}
          <div className="min-w-[1060px]">
            <div className="grid gap-0.5 sm:gap-1 mb-1"
              style={{ gridTemplateColumns: `1.6rem repeat(${SPALTEN}, minmax(0, 1fr))` }}>
              <div className="text-[9px] text-muted self-end text-right pr-1">Gruppe</div>
              {Array.from({ length: SPALTEN }, (_, i) => (
                <div key={i} className="text-center leading-tight">
                  <div className="text-[10px] font-bold text-muted">{i + 1}</div>
                  <div className="text-[9px] text-muted">{HAUPTGRUPPE_ROEMISCH[i + 1] ?? ""}</div>
                </div>
              ))}
            </div>
            <div
              className="grid gap-0.5 sm:gap-1"
              style={{
                gridTemplateColumns: `1.6rem repeat(${SPALTEN}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${ZEILEN}, auto)`,
              }}
            >
              {/* Periodennummern am linken Rand */}
              {Array.from({ length: 7 }, (_, i) => (
                <div key={`p${i}`} style={{ gridColumn: 1, gridRow: i + 1 }}
                  className="text-[11px] font-bold text-muted self-center text-right pr-1">
                  {i + 1}
                </div>
              ))}
              {PSE.map(e => (
                <Kachel key={e.z} e={e} aktiv={modus === "nachschlagen" && gewaehlt?.z === e.z}
                  gedimmt={gedimmt(e)} marke={markeFuer(e)} onWahl={klick} />
              ))}
              {/* Dort, wo der f-Block herausgenommen ist, steht sein Bereich */}
              {([[6, "57–71"], [7, "89–103"]] as const).map(([zeile, text]) => (
                <div key={zeile} style={{ gridColumn: 4, gridRow: zeile }}
                  className="rounded-md border-2 border-dashed border-line flex items-center justify-center text-[9px] text-muted tabular-nums">
                  {text}
                </div>
              ))}
              <div style={{ gridColumn: "1 / 4", gridRow: 9 }} className="text-[10px] text-muted self-center text-right pr-2">
                Lanthanoide
              </div>
              <div style={{ gridColumn: "1 / 4", gridRow: 10 }} className="text-[10px] text-muted self-center text-right pr-2">
                Actinoide
              </div>
            </div>
            <div className="mt-3"><Legende /></div>
          </div>
        </div>

        <div className="w-full 2xl:w-[380px] shrink-0">
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
