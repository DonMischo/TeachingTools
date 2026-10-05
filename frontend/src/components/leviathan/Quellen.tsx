"use client";
/**
 * Quellenverzeichnis: alle Belege des Spiels nach Thema, mit vollständiger
 * Angabe, Link zum Aufsatz und der Stelle, an der sie im Spiel wirken.
 */
import { BEREICH } from "@/lib/leviathan/bereiche";
import { EREIGNISSE } from "@/lib/leviathan/ereignisse";
import { KANTEN, KNOTEN_INFO } from "@/lib/leviathan/netz";
import { HINTERGRUND, QUELLEN, THEMEN, ZITATE, type Thema } from "@/lib/leviathan/quellen";
import { EIGENDYNAMIK, REGELN, SCHLEIFEN, SOFORT } from "@/lib/leviathan/regeln";
import type { Groesse, Hebel } from "@/lib/leviathan/typen";
import { Karte } from "./ui";

/** Wo jede Quelle im Spiel wirkt. */
function verwendung(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const dazu = (id: string, text: string) => m.set(id, [...(m.get(id) ?? []), text]);
  for (const r of REGELN) dazu(r.quelle, `Regel: ${BEREICH[r.von].name} → ${BEREICH[r.nach].name}`);
  for (const k of KANTEN.filter((x) => x.art === "extra")) dazu(k.quelle, `Wirkung: ${KNOTEN_INFO[k.von].name} → ${KNOTEN_INFO[k.nach].name}`);
  for (const [g, xs] of Object.entries(EIGENDYNAMIK)) for (const x of xs ?? []) dazu(x.quelle, `Eigendynamik: ${BEREICH[g as Groesse].name}`);
  for (const [h, xs] of Object.entries(SOFORT)) for (const x of xs) dazu(x.quelle, `Programm »${x.programm}« (${BEREICH[h as Hebel].name})`);
  for (const e of EREIGNISSE) if (e.quelle) dazu(e.quelle, `Ereignis: ${e.titel}`);
  for (const s of SCHLEIFEN) dazu(s.quelle, `Schleife: ${s.name}`);
  dazu("whr2025", "Zusammensetzung der Lebensqualität");
  dazu("korridor", "Leviathan-Anzeige");
  dazu("funke2016", "Wahlen: Populismus-Chance");
  return m;
}

export default function Quellen({ onSchliessen }: { onSchliessen?: () => void }) {
  const wo = verwendung();
  const themen = Object.keys(THEMEN) as Thema[];
  const ids = Object.keys(QUELLEN);
  const anzahl = ids.filter((id) => id !== "annahme").length;

  return (
    <Karte titel="📚 Quellen" rechts={onSchliessen && (
      <button onClick={onSchliessen} className="text-sm underline text-muted">schließen</button>)}>
      <p className="text-sm mb-4">
        Alle {anzahl} Belege, auf denen die Regeln des Spiels beruhen. Die Studien legen Richtung, Verzögerung und grobe
        Stärke einer Wirkung fest – die Zahlen im Spiel sind vereinfacht und nicht die Effektgrößen der Studien.
        Unter jeder Quelle steht, wo sie im Spiel wirkt.
      </p>

      <div className="flex flex-col gap-6">
        {themen.map((t) => {
          const liste = ids.filter((id) => ZITATE[id]?.thema === t);
          if (!liste.length) return null;
          return (
            <section key={t}>
              <h3 className="font-black mb-2">{THEMEN[t]}</h3>
              <ol className="flex flex-col gap-3">
                {liste.map((id) => {
                  const q = QUELLEN[id];
                  const z = ZITATE[id];
                  const url = z.url ?? q.url;
                  const stellen = wo.get(id) ?? [];
                  return (
                    <li key={id} id={`quelle-${id}`} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{z.art}</span>
                        {q.umstritten && <span className="text-[11px] font-bold text-accent">Forschung uneins</span>}
                      </div>
                      <p className="mt-0.5">{z.zitat}</p>
                      <p className="text-muted mt-1">{q.befund}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {url && <a href={url} target="_blank" rel="noreferrer" className="underline font-bold break-all">{url.startsWith("https://doi.org/") ? `DOI ${url.slice(16)}` : "Zur Quelle"}</a>}
                        {z.weitere?.map((w) => <a key={w.url} href={w.url} target="_blank" rel="noreferrer" className="underline">{w.titel}</a>)}
                      </div>
                      {stellen.length > 0 && (
                        <details className="mt-1 text-xs text-muted">
                          <summary className="cursor-pointer">Im Spiel verwendet ({stellen.length})</summary>
                          <ul className="mt-1 list-disc pl-5">{stellen.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        <section>
          <h3 className="font-black mb-2">Hintergrund</h3>
          <ul className="flex flex-col gap-3">
            {HINTERGRUND.map((h) => (
              <li key={h.titel} className="rounded-xl border border-line p-3 text-sm">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{h.titel}</div>
                <p className="mt-0.5">{h.zitat}</p>
                <p className="text-muted mt-1">{h.hinweis}</p>
                {h.url && <a href={h.url} target="_blank" rel="noreferrer" className="underline font-bold break-all">{h.url.startsWith("https://doi.org/") ? `DOI ${h.url.slice(16)}` : "Zur Quelle"}</a>}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-muted">
          Die ausführliche Recherche mit allen Befunden steht in <code>docs/leviathan-recherche.md</code>. Ländereinträge
          (Geburtenraten, V-Dem-Einstufungen) sind gerundet, Stand ca. 2024/25.
        </p>
      </div>
    </Karte>
  );
}
