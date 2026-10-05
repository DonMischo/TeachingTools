"use client";
/**
 * Erfolge im Kartenquiz festlegen: Name, Symbol, Art und was dafür zählt.
 * Ohne Einträge gibt es je Ebene einen Erfolg »alles richtig« (api/routers/karten_quiz.py).
 * Die Arten erklärt api/karten_lernen.py (ARTEN).
 */
import type { Dispatch, SetStateAction } from "react";
import type { FeatureCollection } from "geojson";
import type { Ebene } from "@/lib/karten/stil";
import type { ErfolgsArt, KartenErfolg, SatzInhalt } from "@/lib/karten/satz";

const SCHWELLEN = [[0.5, "die Hälfte"], [0.75, "drei Viertel"], [1, "alle"]] as const;

export const ARTEN: { id: ErfolgsArt; name: string; icon: string }[] = [
  { id: "anteil", name: "Anteil richtig", icon: "🏅" },
  { id: "fehlerfrei", name: "ohne Fehlversuch", icon: "💎" },
  { id: "objekte", name: "bestimmte Objekte", icon: "📍" },
  { id: "serie", name: "Serie (richtig hintereinander)", icon: "🔥" },
  { id: "tempo", name: "auf Zeit", icon: "⏱️" },
  { id: "beide", name: "benennen und finden", icon: "🔁" },
  { id: "aufgeholt", name: "Fehler aufgeholt (Üben)", icon: "📈" },
  { id: "dranbleiben", name: "an mehreren Tagen geübt", icon: "📅" },
  { id: "komplett", name: "alle anderen Erfolge", icon: "👑" },
];
const MIT_EBENEN: ErfolgsArt[] = ["anteil", "fehlerfrei", "tempo", "beide", "aufgeholt"];
const STANDARD: Partial<Record<ErfolgsArt, Partial<KartenErfolg>>> = {
  serie: { anzahl: 5 }, tempo: { sekunden: 120 }, aufgeholt: { anzahl: 3 }, dranbleiben: { anzahl: 3 },
};

const feld = "px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)]";

export default function ErfolgeEditor({ ebenen, inhalt, setInhalt, daten, nummern }: {
  ebenen: Ebene[];
  inhalt: SatzInhalt;
  setInhalt: Dispatch<SetStateAction<SatzInhalt>>;
  daten: Record<string, FeatureCollection | undefined>;
  nummern: Record<string, Record<string, string>>;
}) {
  const erfolge = inhalt.erfolge ?? [];
  const mitAuswahl = ebenen.filter((e) => inhalt.auswahl[e.id]?.objekte.length);
  const setze = (neu: KartenErfolg[]) => setInhalt((v) => ({ ...v, erfolge: neu }));
  const aendere = (i: number, a: Partial<KartenErfolg>) => setze(erfolge.map((e, k) => (k === i ? { ...e, ...a } : e)));
  const neu = () => {
    const erste = mitAuswahl[0];
    if (!erste) return;
    setze([...erfolge, { id: `erfolg-${Date.now().toString(36)}`, name: `${erste.name}-Profi`, icon: "🏅", art: "anteil", ebenen: [erste.id], schwelle: 1 }]);
  };
  const artWechsel = (i: number, art: ErfolgsArt) => {
    const alt = erfolge[i];
    const symbol = ARTEN.find((a) => a.id === art)!.icon;
    const altSymbol = ARTEN.find((a) => a.id === (alt.art ?? "anteil"))?.icon;
    aendere(i, { art, ...STANDARD[art], icon: alt.icon === altSymbol ? symbol : alt.icon,
      ebenen: MIT_EBENEN.includes(art) && !alt.ebenen.length && mitAuswahl[0] ? [mitAuswahl[0].id] : alt.ebenen });
  };
  // Ausgewählte Objekte mit Marke und Namen, für »bestimmte Objekte«
  const objekte = mitAuswahl.flatMap((eb) => {
    const namen = new Map((daten[eb.id]?.features ?? []).map((f) => [String(f.properties?.id), String(f.properties?.name ?? "")]));
    return inhalt.auswahl[eb.id].objekte.map((id) => ({ schluessel: `${eb.id}:${id}`, marke: nummern[eb.id]?.[id] ?? "", name: namen.get(id) ?? id }));
  });

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border)]">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">🏆 Erfolge im Quiz</h3>
      {!erfolge.length && <p className="text-xs text-[var(--text-muted)]">Ohne eigene Erfolge gibt es je Ebene einen: alles richtig.</p>}
      {erfolge.map((e, i) => {
        const art = e.art ?? "anteil";
        return (
          <div key={e.id} className="flex flex-col gap-1 p-2 rounded-lg border border-[var(--border)]">
            <div className="flex gap-1">
              <input value={e.icon} maxLength={8} onChange={(ev) => aendere(i, { icon: ev.target.value })} aria-label="Symbol"
                className={`w-10 text-center ${feld}`} />
              <input value={e.name} maxLength={60} onChange={(ev) => aendere(i, { name: ev.target.value })} aria-label="Name des Erfolgs"
                className={`flex-1 min-w-0 px-2 ${feld}`} />
              <button aria-label={`Erfolg ${e.name} löschen`} onClick={() => setze(erfolge.filter((_, k) => k !== i))} className="px-1">🗑</button>
            </div>
            <select value={art} onChange={(ev) => artWechsel(i, ev.target.value as ErfolgsArt)} aria-label="Art des Erfolgs" className={`text-xs ${feld}`}>
              {ARTEN.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
            {MIT_EBENEN.includes(art) && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {mitAuswahl.map((eb) => (
                  <label key={eb.id} className="flex items-center gap-1">
                    <input type="checkbox" checked={e.ebenen.includes(eb.id)}
                      onChange={() => aendere(i, { ebenen: e.ebenen.includes(eb.id) ? e.ebenen.filter((x) => x !== eb.id) : [...e.ebenen, eb.id] })} />
                    {eb.name}
                  </label>
                ))}
              </div>
            )}
            {art === "anteil" && (
              <label className="flex items-center gap-1 text-xs">
                geschafft, wenn
                <select value={e.schwelle} onChange={(ev) => aendere(i, { schwelle: Number(ev.target.value) })} className={feld}>
                  {SCHWELLEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
                </select>
                richtig
              </label>
            )}
            {(art === "serie" || art === "aufgeholt" || art === "dranbleiben") && (
              <label className="flex items-center gap-1 text-xs">
                {art === "serie" ? "richtig hintereinander:" : art === "aufgeholt" ? "frühere Fehler, die jetzt sitzen:" : "Tage:"}
                <input type="number" min={1} max={500} value={e.anzahl ?? 3} aria-label="Anzahl"
                  onChange={(ev) => aendere(i, { anzahl: Math.max(1, Number(ev.target.value)) })} className={`w-16 ${feld}`} />
              </label>
            )}
            {art === "tempo" && (
              <label className="flex items-center gap-1 text-xs">
                alles richtig in
                <input type="number" min={10} max={3600} step={10} value={e.sekunden ?? 120} aria-label="Sekunden"
                  onChange={(ev) => aendere(i, { sekunden: Math.max(10, Number(ev.target.value)) })} className={`w-20 ${feld}`} />
                Sekunden
              </label>
            )}
            {art === "objekte" && (
              <div className="flex flex-wrap gap-1 text-xs max-h-32 overflow-y-auto">
                {objekte.map((o) => {
                  const an = (e.objekte ?? []).includes(o.schluessel);
                  return (
                    <button key={o.schluessel} aria-pressed={an}
                      onClick={() => aendere(i, { objekte: an ? (e.objekte ?? []).filter((x) => x !== o.schluessel) : [...(e.objekte ?? []), o.schluessel] })}
                      className={`px-1.5 py-0.5 rounded border ${an ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text,#111)] font-bold" : "border-[var(--border)]"}`}>
                      {o.marke && <><b>{o.marke}</b>{" "}</>}{o.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={neu} disabled={!mitAuswahl.length}
        className="self-start px-2 py-1 rounded-lg text-xs font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40">
        + Erfolg
      </button>
    </div>
  );
}
