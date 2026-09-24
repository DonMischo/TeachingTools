"use client";
/**
 * Aufträge und Fußgänger-Führerschein: Fortschritt je Konto bzw. Gast im
 * Browser, Prüfung beim Server (nur Schülerkonten bekommen Hauspunkte).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { bestanden, LEER, MAX_SCHWERE, MISSIONEN, pflichtErfuellt, verbuche, type Ereignis, type Fortschritt, type MissionId } from "@/lib/verkehr/missionen";
import { SCHILDER } from "@/lib/verkehr/schilder";

function lies(schluessel: string): Fortschritt {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh ? { ...LEER, ...JSON.parse(roh) } : LEER;
  } catch {
    return LEER;
  }
}

/**
 * Der Stand trägt seinen Schlüssel mit: gespeichert wird nur, wenn er zum
 * aktuellen Schlüssel gehört (StrictMode-Falle, siehe PhysikLabor).
 */
export function useFortschritt(speicherSchluessel: string) {
  const schluessel = `hp_verkehr_${speicherSchluessel}`;
  const [stand, setStand] = useState<{ fuer: string | null; f: Fortschritt }>({ fuer: null, f: LEER });
  useEffect(() => { setStand({ fuer: schluessel, f: lies(schluessel) }); }, [schluessel]);
  useEffect(() => {
    if (stand.fuer !== schluessel) return;
    try { localStorage.setItem(schluessel, JSON.stringify(stand.f)); } catch { /* voll oder gesperrt */ }
  }, [stand, schluessel]);

  const buche = useCallback((e: Ereignis) => setStand((alt) => ({ ...alt, f: verbuche(alt.f, e).f })), []);

  // Frisch erledigte Aufträge melden — nicht beim Laden, nur wenn im Spiel etwas dazukommt.
  const [neu, setNeu] = useState<MissionId[]>([]);
  const vorher = useRef<{ fuer: string | null; erledigt: MissionId[] }>({ fuer: null, erledigt: [] });
  useEffect(() => {
    const v = vorher.current;
    if (v.fuer === stand.fuer) {
      const frisch = stand.f.erledigt.filter((id) => !v.erledigt.includes(id));
      if (frisch.length) setNeu(frisch);
    }
    vorher.current = { fuer: stand.fuer, erledigt: stand.f.erledigt };
  }, [stand]);
  const neuAnfangen = useCallback(() => setStand((alt) => ({ ...alt, f: LEER })), []);
  return { f: stand.f, buche, neu, neuAnfangen };
}

export function Auftraege({ f, neuAnfangen, konto, code }: {
  f: Fortschritt;
  neuAnfangen: () => void;
  /** Schülerkonto — dann gibt es Hauspunkte. */
  konto: boolean;
  code?: string | null;
}) {
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const alleSchilder = Object.keys(SCHILDER).length;

  async function pruefen() {
    if (!konto) { setErgebnis("🎉 Bestanden! (Hauspunkte gibt es nur mit Schülerkonto.)"); return; }
    try {
      const r = await api.verkehr.pruefung({ erledigt: f.erledigt, schwere: f.schwere, code });
      setErgebnis(r.schon_vergeben ? "🎉 Bestanden — die Hauspunkte hast du schon bekommen."
        : r.punkte ? `🎉 Bestanden! +${r.punkte} Hauspunkte${r.haus ? ` für ${r.haus}` : ""}.` : "🎉 Bestanden!");
    } catch (e) {
      setErgebnis(e instanceof Error ? e.message : "Die Prüfung ließ sich nicht melden.");
    }
  }

  return (
    <div className="text-sm">
      <h2 className="font-black mb-2">🪪 Fußgänger-Führerschein</h2>
      <ul className="flex flex-col gap-1.5">
        {MISSIONEN.map((m) => {
          const fertig = f.erledigt.includes(m.id);
          return (
            <li key={m.id} className={`rounded-lg border px-2 py-1 ${fertig ? "border-green-600 bg-green-600/10" : "border-[var(--border)]"}`}>
              <div className="font-bold">
                {fertig ? "✅" : m.icon} {m.titel}
                {!m.pflicht && <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">(Extra)</span>}
                {m.id === "schilder" && !fertig && <span className="ml-1 text-xs font-normal">{f.schilder.length}/{alleSchilder}</span>}
              </div>
              {!fertig && <div className="text-xs text-[var(--text-muted)]">{m.text}</div>}
            </li>
          );
        })}
      </ul>
      <p className={`mt-3 text-xs ${f.schwere > MAX_SCHWERE ? "text-red-600 font-bold" : "text-[var(--text-muted)]"}`}>
        Schwere Verstöße: {f.schwere} (erlaubt: höchstens {MAX_SCHWERE})
      </p>
      {pflichtErfuellt(f) && (
        bestanden(f)
          ? <button type="button" className="mt-2 w-full rounded-lg bg-green-600 px-3 py-1.5 font-bold text-white" onClick={pruefen}>Führerschein abholen</button>
          : <p className="mt-2 text-xs">Alle Aufträge geschafft, aber zu viele schwere Verstöße. Fang neu an und zeig, dass es sicher geht!</p>
      )}
      {ergebnis && <p className="mt-2 font-bold">{ergebnis}</p>}
      <button type="button" className="mt-3 text-xs underline text-[var(--text-muted)]"
        onClick={() => { if (confirm("Alle Aufträge zurücksetzen?")) { neuAnfangen(); setErgebnis(null); } }}>
        Neu anfangen
      </button>
    </div>
  );
}
