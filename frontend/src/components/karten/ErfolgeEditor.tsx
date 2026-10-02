"use client";
/**
 * Erfolge im Kartenquiz festlegen: Name, Symbol, welche Ebenen zählen, Anteil richtig.
 * Ohne Einträge gibt es je Ebene einen Erfolg »alles richtig« (api/routers/karten_quiz.py).
 */
import type { Dispatch, SetStateAction } from "react";
import type { Ebene } from "@/lib/karten/stil";
import type { KartenErfolg, SatzInhalt } from "@/lib/karten/satz";

const SCHWELLEN = [[0.5, "die Hälfte"], [0.75, "drei Viertel"], [1, "alle"]] as const;

export default function ErfolgeEditor({ ebenen, inhalt, setInhalt }: {
  ebenen: Ebene[];
  inhalt: SatzInhalt;
  setInhalt: Dispatch<SetStateAction<SatzInhalt>>;
}) {
  const erfolge = inhalt.erfolge ?? [];
  const mitAuswahl = ebenen.filter((e) => inhalt.auswahl[e.id]?.objekte.length);
  const setze = (neu: KartenErfolg[]) => setInhalt((v) => ({ ...v, erfolge: neu }));
  const aendere = (i: number, a: Partial<KartenErfolg>) => setze(erfolge.map((e, k) => (k === i ? { ...e, ...a } : e)));
  const neu = () => {
    const erste = mitAuswahl[0];
    if (!erste) return;
    setze([...erfolge, { id: `erfolg-${Date.now().toString(36)}`, name: `${erste.name}-Profi`, icon: "🏅", ebenen: [erste.id], schwelle: 1 }]);
  };

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border)]">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">🏆 Erfolge im Quiz</h3>
      {!erfolge.length && <p className="text-xs text-[var(--text-muted)]">Ohne eigene Erfolge gibt es je Ebene einen: alles richtig.</p>}
      {erfolge.map((e, i) => (
        <div key={e.id} className="flex flex-col gap-1 p-2 rounded-lg border border-[var(--border)]">
          <div className="flex gap-1">
            <input value={e.icon} maxLength={8} onChange={(ev) => aendere(i, { icon: ev.target.value })} aria-label="Symbol"
              className="w-10 text-center px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)]" />
            <input value={e.name} maxLength={60} onChange={(ev) => aendere(i, { name: ev.target.value })} aria-label="Name des Erfolgs"
              className="flex-1 min-w-0 px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)]" />
            <button aria-label={`Erfolg ${e.name} löschen`} onClick={() => setze(erfolge.filter((_, k) => k !== i))} className="px-1">🗑</button>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {mitAuswahl.map((eb) => (
              <label key={eb.id} className="flex items-center gap-1">
                <input type="checkbox" checked={e.ebenen.includes(eb.id)}
                  onChange={() => aendere(i, { ebenen: e.ebenen.includes(eb.id) ? e.ebenen.filter((x) => x !== eb.id) : [...e.ebenen, eb.id] })} />
                {eb.name}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1 text-xs">
            geschafft, wenn
            <select value={e.schwelle} onChange={(ev) => aendere(i, { schwelle: Number(ev.target.value) })}
              className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)]">
              {SCHWELLEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
            </select>
            richtig
          </label>
        </div>
      ))}
      <button onClick={neu} disabled={!mitAuswahl.length}
        className="self-start px-2 py-1 rounded-lg text-xs font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40">
        + Erfolg
      </button>
    </div>
  );
}
