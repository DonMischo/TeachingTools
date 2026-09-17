"use client";
/**
 * Simulation »Physiklabor« — der Vorbereitungsraum als Werkbank.
 *
 * Links der Schrank, in der Mitte der Tisch, rechts die Einstellungen des
 * angefassten Geräts. Der Aufbau liegt als JSON im Browser (je Konto bzw. je
 * Sitzungscode) und ist damit dieselbe Zeichenkette, die später über einen
 * Beitritts-Code an die Klasse geht.
 *
 * Schritt 1a: aufstellen, verbinden, einstellen, speichern. Gerechnet wird
 * noch nichts — Messbus und Oszilloskop kommen in 1b, die Mechanik in 1c.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatiere, nachSI } from "@/lib/physik/einheiten";
import { KATALOG, geraetTyp } from "@/lib/physik/katalog";
import { ladeSzene, speichereSzene } from "@/lib/physik/speicher";
import { entferne, freierPlatz, neueSzene, stelle, stelleEin, trenne, treueVon } from "@/lib/physik/szene";
import type { Bereich, Modelltreue, Szene } from "@/lib/physik/typen";
import Werkbank, { PORT_FARBE } from "./Werkbank";
import Oszilloskop from "./Oszilloskop";
import { useSimulation } from "./useSimulation";

const BEREICHE: { id: Bereich; name: string }[] = [
  { id: "aufbau", name: "🧱 Aufbau" },
  { id: "mechanik", name: "⚙️ Mechanik" },
  { id: "strom", name: "🔌 Strom" },
  { id: "optik", name: "🔦 Optik" },
  { id: "wellen", name: "〰️ Wellen" },
  { id: "waerme", name: "🌡️ Wärme" },
  { id: "messen", name: "📐 Messen" },
];

export default function PhysikLabor({ action, speicherSchluessel = "geraet" }: {
  action?: ReactNode;
  /** Wo der Aufbau abgelegt wird — je Konto oder je Sitzungscode. */
  speicherSchluessel?: string;
}) {
  // Der Aufbau traegt mit, zu welchem Speicherplatz er gehoert. Ohne das
  // schreibt der Speicher-Effekt beim ersten Rendern die leere Anfangsszene
  // ueber einen gespeicherten Aufbau — und weil StrictMode zweimal montiert,
  // liest der zweite Ladevorgang genau diese Leere zurueck. Dasselbe beim
  // Wechsel des Schluessels (Gast wird angemeldet): sonst landet der Aufbau
  // des einen Platzes auf dem anderen.
  const [stand, setStand] = useState<{ fuer: string | null; szene: Szene }>(
    () => ({ fuer: null, szene: neueSzene() }),
  );
  const szene = stand.szene;
  const setSzene = useCallback((s: Szene | ((alt: Szene) => Szene)) => {
    setStand(alt => ({ ...alt, szene: typeof s === "function" ? s(alt.szene) : s }));
  }, []);
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(true);
  const [tempo, setTempo] = useState(1);
  const [zeitProFeld, setZeitProFeld] = useState(0.2);
  const { bus, beobachte, zuruecksetzen } = useSimulation(szene, laeuft, tempo);

  // Erst im Browser laden: auf dem Server gibt es kein localStorage.
  useEffect(() => {
    setStand({ fuer: speicherSchluessel, szene: ladeSzene(speicherSchluessel) });
  }, [speicherSchluessel]);

  // Gespeichert wird nur, was auch zu diesem Platz geladen wurde.
  useEffect(() => {
    if (stand.fuer !== speicherSchluessel) return;
    speichereSzene(speicherSchluessel, stand.szene);
  }, [speicherSchluessel, stand]);

  const geraet = useMemo(
    () => szene.geraete.find(g => g.id === ausgewaehlt) ?? null,
    [szene.geraete, ausgewaehlt],
  );
  const typ = geraet ? geraetTyp(geraet.typ) : undefined;

  // Entf entfernt das angefasste Gerät — aber nicht, während jemand tippt.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA")) return;
      if (!ausgewaehlt) return;
      e.preventDefault();
      setSzene(s => entferne(s, ausgewaehlt));
      setAusgewaehlt(null);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [ausgewaehlt]);

  const nimm = (t: string) => {
    setSzene(s => {
      const neu = stelle(s, t, freierPlatz(s));
      setAusgewaehlt(neu.geraete[neu.geraete.length - 1].id);
      return neu;
    });
  };

  const verbundenMit = geraet
    ? szene.verbindungen.filter(v => v.von.geraet === geraet.id || v.nach.geraet === geraet.id)
    : [];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔬 Physiklabor</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 max-w-2xl">
            Der Vorbereitungsraum als Werkbank: Geräte aus dem Schrank nehmen, hinstellen, verbinden —
            und messen, was dabei herauskommt.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          value={szene.titel}
          onChange={e => setSzene(s => ({ ...s, titel: e.target.value }))}
          aria-label="Name des Aufbaus"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-bold min-w-48"
        />
        <Treue wert={szene.treue} onWechsel={t => setSzene(s => ({ ...s, treue: t }))} />
        <button
          onClick={() => { setSzene(s => ({ ...neueSzene(), treue: s.treue })); setAusgewaehlt(null); }}
          className="rounded-xl border border-[var(--border)] px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >🧹 Tisch abräumen</button>

        <span className="w-px h-6 bg-[var(--border)] mx-1" />

        <button
          onClick={() => setLaeuft(l => !l)}
          aria-pressed={laeuft}
          className="rounded-xl border border-[var(--border)] px-3 py-2 font-bold"
        >{laeuft ? "⏸️ Anhalten" : "▶️ Laufen"}</button>
        <button
          onClick={zuruecksetzen}
          title="Uhr auf null, Messwerte verwerfen"
          className="rounded-xl border border-[var(--border)] px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >⏮️ Messung neu</button>
        <label className="flex items-center gap-1.5 text-[var(--text-muted)]">
          Tempo
          <select
            value={tempo}
            onChange={e => setTempo(Number(e.target.value))}
            aria-label="Tempo"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
          >
            <option value={0.1}>Zeitlupe (1/10)</option>
            <option value={0.25}>langsam (1/4)</option>
            <option value={1}>echt</option>
            <option value={4}>Zeitraffer (4x)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[13rem_1fr_16rem] gap-4">
        <Schrank onNimm={nimm} />

        <div
          className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[#0b1220]"
          style={{ height: "min(70vh, 640px)", minHeight: 360 }}
        >
          <Werkbank szene={szene} setSzene={setSzene} ausgewaehlt={ausgewaehlt} setAusgewaehlt={setAusgewaehlt} />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          {!geraet || !typ ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nichts ausgewählt. Tippe ein Gerät auf dem Tisch an, um es einzustellen.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{typ.icon}</span>
                <span className="font-black">{typ.name}</span>
              </div>

              {typ.parameter.map(p => (
                <label key={p.schluessel} className="flex flex-col gap-1 text-sm">
                  <span className="flex justify-between">
                    <span className="text-[var(--text-muted)]">{p.name}</span>
                    <span className="font-bold tabular-nums">
                      {p.optionen
                        ? (p.optionen.find(o => o.wert === (geraet.werte[p.schluessel] ?? p.standard))?.name ?? "—")
                        : formatiere(geraet.werte[p.schluessel] ?? p.standard, p.einheit, p.anzeige)}
                    </span>
                  </span>
                  {p.optionen ? (
                    <select
                      value={geraet.werte[p.schluessel] ?? p.standard}
                      onChange={e => setSzene(s => stelleEin(s, geraet.id, { [p.schluessel]: Number(e.target.value) }))}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                    >
                      {p.optionen.map(o => <option key={o.wert} value={o.wert}>{o.name}</option>)}
                    </select>
                  ) : (
                    <input
                      type="range"
                      min={p.min} max={p.max} step={(p.max - p.min) / 200}
                      value={geraet.werte[p.schluessel] ?? p.standard}
                      onChange={e => setSzene(s => stelleEin(s, geraet.id, {
                        [p.schluessel]: nachSI(Number(e.target.value), p.einheit),
                      }))}
                      className="accent-[var(--accent)]"
                    />
                  )}
                </label>
              ))}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={geraet.treue !== undefined}
                  onChange={e => setSzene(s => ({
                    ...s,
                    geraete: s.geraete.map(g => g.id === geraet.id
                      ? { ...g, treue: e.target.checked ? treueVon(s, g) : undefined }
                      : g),
                  }))}
                />
                <span className="text-[var(--text-muted)]">Eigene Modelltreue</span>
              </label>
              {geraet.treue !== undefined && (
                <Treue
                  wert={geraet.treue}
                  onWechsel={t => setSzene(s => ({
                    ...s,
                    geraete: s.geraete.map(g => (g.id === geraet.id ? { ...g, treue: t } : g)),
                  }))}
                />
              )}

              {typ.signale.length > 0 && (
                <div className="text-xs text-[var(--text-muted)]">
                  <div className="font-bold mb-1">Misst</div>
                  {typ.signale.map(s => <div key={s.schluessel}>• {s.name}</div>)}
                </div>
              )}

              {verbundenMit.length > 0 && (
                <div className="text-xs">
                  <div className="font-bold mb-1 text-[var(--text-muted)]">Verbunden</div>
                  {verbundenMit.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSzene(s => trenne(s, v.id))}
                      className="block w-full text-left rounded-lg px-2 py-1 hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
                    >✂️ {v.von.port} ↔ {v.nach.port}</button>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setSzene(s => entferne(s, geraet.id)); setAusgewaehlt(null); }}
                className="mt-auto rounded-xl border border-rose-400/40 text-rose-300 px-3 py-2 text-sm hover:bg-rose-500/10"
              >🗑️ Wegräumen</button>
            </>
          )}
        </div>
      </div>

      <Oszilloskop
        szene={szene}
        bus={bus}
        beobachte={beobachte}
        zeitProFeld={zeitProFeld}
        setZeitProFeld={setZeitProFeld}
      />

      <Legende />
    </div>
  );
}

function Treue({ wert, onWechsel }: { wert: Modelltreue; onWechsel: (t: Modelltreue) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden text-sm" role="group" aria-label="Modelltreue">
      {(["ideal", "real"] as const).map(t => (
        <button
          key={t}
          onClick={() => onWechsel(t)}
          aria-pressed={wert === t}
          title={t === "ideal"
            ? "Schulbuch: reibungsfrei, verlustfrei — die Messung bestätigt die Formel."
            : "Mit Reibung, Dämpfung und Innenwiderstand — die Messung weicht ab."}
          className={`px-3 py-2 font-bold ${wert === t
            ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
        >{t === "ideal" ? "📘 Schulbuch" : "🔧 Real"}</button>
      ))}
    </div>
  );
}

function Schrank({ onNimm }: { onNimm: (typ: string) => void }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
      {BEREICHE.map(b => {
        const geraete = KATALOG.filter(t => t.bereich === b.id);
        if (!geraete.length) return null;
        return (
          <div key={b.id}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">{b.name}</div>
            <div className="flex flex-col gap-1">
              {geraete.map(t => (
                <button
                  key={t.typ}
                  onClick={() => onNimm(t.typ)}
                  aria-label={t.name + " auf den Tisch stellen"}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-left hover:bg-[var(--surface-hover)]"
                >
                  <span className="text-xl" aria-hidden="true">{t.icon}</span>
                  <span className="font-bold">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Legende() {
  const arten: { art: keyof typeof PORT_FARBE; name: string }[] = [
    { art: "mechanik", name: "Mechanik" },
    { art: "achse", name: "Achse" },
    { art: "strom", name: "Strom" },
    { art: "licht", name: "Licht" },
    { art: "welle", name: "Welle" },
    { art: "waerme", name: "Wärme" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
      <span className="font-bold">Anschlüsse:</span>
      {arten.map(a => (
        <span key={a.art} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: PORT_FARBE[a.art] }} />
          {a.name}
        </span>
      ))}
      <span>— zusammen passt nur, was dieselbe Farbe hat.</span>
    </div>
  );
}
