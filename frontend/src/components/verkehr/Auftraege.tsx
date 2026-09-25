"use client";
/**
 * Aufträge, Erfolge und Fußgänger-Führerschein: Fortschritt je Konto bzw.
 * Gast im Browser, Prüfung beim Server (nur Schülerkonten bekommen Hauspunkte).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  bestanden, ERFOLGE, LEER, LEERE_STATISTIK, MAX_SCHWERE, MISSIONEN, pflichtErfuellt, verbuche,
  type ErfolgId, type Ereignis, type Fortschritt, type MissionId,
} from "@/lib/verkehr/missionen";
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

  // Frisch erledigte Aufträge und Erfolge melden — nicht beim Laden, nur wenn im Spiel etwas dazukommt.
  const [neu, setNeu] = useState<{ auftraege: MissionId[]; erfolge: ErfolgId[] }>({ auftraege: [], erfolge: [] });
  const vorher = useRef<{ fuer: string | null; erledigt: MissionId[]; erfolge: ErfolgId[] }>({ fuer: null, erledigt: [], erfolge: [] });
  useEffect(() => {
    const v = vorher.current;
    const erfolge = stand.f.erfolge ?? [];
    if (v.fuer === stand.fuer) {
      const auftraege = stand.f.erledigt.filter((id) => !v.erledigt.includes(id));
      const neueErfolge = erfolge.filter((id) => !v.erfolge.includes(id));
      if (auftraege.length || neueErfolge.length) setNeu({ auftraege, erfolge: neueErfolge });
    }
    vorher.current = { fuer: stand.fuer, erledigt: stand.f.erledigt, erfolge };
  }, [stand]);
  // Erfolge und Statistik bleiben beim Neuanfang — die hat man sich verdient.
  const neuAnfangen = useCallback(() => setStand((alt) => ({ ...alt, f: { ...LEER, stat: alt.f.stat, erfolge: alt.f.erfolge } })), []);
  return { f: stand.f, buche, neu, neuAnfangen };
}

type Reiter = "auftraege" | "erfolge" | "zahlen";

export function Auftraege({ f, neuAnfangen, konto, code, onBestanden }: {
  f: Fortschritt;
  neuAnfangen: () => void;
  /** Schülerkonto — dann gibt es Hauspunkte. */
  konto: boolean;
  code?: string | null;
  onBestanden?: () => void;
}) {
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [reiter, setReiter] = useState<Reiter>("auftraege");
  const alleSchilder = Object.keys(SCHILDER).length;
  const st = { ...LEERE_STATISTIK, ...f.stat };
  const erfolge = f.erfolge ?? [];

  async function pruefen() {
    if (!konto) { setErgebnis("🎉 Bestanden! (Hauspunkte gibt es nur mit Schülerkonto.)"); onBestanden?.(); return; }
    try {
      const r = await api.verkehr.pruefung({ erledigt: f.erledigt, schwere: f.schwere, code });
      setErgebnis(r.schon_vergeben ? "🎉 Bestanden — die Hauspunkte hast du schon bekommen."
        : r.punkte ? `🎉 Bestanden! +${r.punkte} Hauspunkte${r.haus ? ` für ${r.haus}` : ""}.` : "🎉 Bestanden!");
      onBestanden?.();
    } catch (e) {
      setErgebnis(e instanceof Error ? e.message : "Die Prüfung ließ sich nicht melden.");
    }
  }

  const knopf = (id: Reiter, text: string) => (
    <button type="button" onClick={() => setReiter(id)}
      className={`flex-1 rounded-md px-1 py-1 text-xs font-bold ${reiter === id ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--border)]/40"}`}>
      {text}
    </button>
  );

  return (
    <div className="text-sm">
      <div className="mb-3 flex gap-1 rounded-lg border border-[var(--border)] p-1">
        {knopf("auftraege", `🪪 Aufträge ${f.erledigt.length}/${MISSIONEN.length}`)}
        {knopf("erfolge", `🏆 ${erfolge.length}/${ERFOLGE.length}`)}
        {knopf("zahlen", "📊")}
      </div>

      {reiter === "auftraege" && (
        <>
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
            onClick={() => { if (confirm("Alle Aufträge zurücksetzen? (Erfolge bleiben.)")) { neuAnfangen(); setErgebnis(null); } }}>
            Neu anfangen
          </button>
        </>
      )}

      {reiter === "erfolge" && (
        <ul className="grid grid-cols-1 gap-1.5">
          {ERFOLGE.map((e) => {
            const da = erfolge.includes(e.id);
            return (
              <li key={e.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${da ? "border-amber-500 bg-amber-400/15" : "border-[var(--border)] opacity-60"}`}>
                <span className={`text-xl ${da ? "" : "grayscale"}`}>{e.icon}</span>
                <span>
                  <span className="block font-bold leading-tight">{e.titel}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{e.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {reiter === "zahlen" && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
          <dt>Gelaufen</dt><dd className="font-bold">{st.meter >= 1000 ? `${(st.meter / 1000).toFixed(2)} km` : `${Math.round(st.meter)} m`}</dd>
          <dt>Sichere Querungen</dt><dd className="font-bold">{st.querungen}</dd>
          <dt>… davon Zebrastreifen</dt><dd className="font-bold">{st.zebra}</dd>
          <dt>… davon bei Grün</dt><dd className="font-bold">{st.gruen}</dd>
          <dt>Aktuelle Serie</dt><dd className="font-bold">{st.serie}</dd>
          <dt>Umgeschaut</dt><dd className="font-bold">{st.blicke}×</dd>
          <dt>Bus / Tram / Zug</dt><dd className="font-bold">{st.busfahrten} / {st.tram} / {st.zug}</dd>
          <dt>Haltestellen</dt><dd className="font-bold">{st.halte.length}</dd>
          <dt>Supermärkte</dt><dd className="font-bold">{st.laeden.length}/5</dd>
          <dt>Müll entsorgt</dt><dd className="font-bold">{st.muell}</dd>
          <dt>Angefahren worden</dt><dd className="font-bold">{st.unfaelle}×</dd>
        </dl>
      )}
    </div>
  );
}
