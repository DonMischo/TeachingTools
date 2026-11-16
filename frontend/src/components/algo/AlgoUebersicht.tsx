"use client";
/**
 * Klassenübersicht der Algorithmen-Werkstatt: wer über den Code der gewählten
 * Sitzung (je Klasse eine, siehe SitzungWahl) mitmacht,
 * welche Automaten, Flussdiagramm-Aufgaben und Level (Sterne) geschafft sind.
 * Abgefragt wird alle fünf Sekunden wie beim Maus-Führerschein.
 */
import { useQuery } from "@tanstack/react-query";
import { api, type AlgoUebersichtZeile } from "@/lib/api";
import { SitzungLeiste, type SitzungWahl } from "@/components/SitzungWahl";
import { AUTOMATEN } from "@/lib/algo/automaten";
import { AUFGABEN } from "@/lib/algo/fluss";
import { LEVEL, WELTEN } from "@/lib/algo/level";

const TAKT_MS = 5000;

function vor(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60);
  return m < 60 ? `vor ${m} Min.` : `vor ${Math.round(m / 60)} Std.`;
}

const gesamt = (z: AlgoUebersichtZeile) =>
  Object.values(z.level).reduce((s, l) => s + (l.punkte ?? 0), 0) + Object.values(z.wertung ?? {}).reduce((s, w) => s + w.punkte, 0);

function erledigt(z: AlgoUebersichtZeile, feld: "automat" | "fluss", id: string) {
  const w = z.wertung?.[`${feld}:${id}`];
  if (w) return <span className="text-amber-500 text-xs" title={`${w.punkte} Punkte`}>{w.sterne}★</span>;
  return z[feld].includes(id) ? "✅" : <span className="text-muted">·</span>;
}

export default function AlgoUebersicht({ wahl }: { wahl: SitzungWahl }) {
  const code = wahl.sitzung?.code;
  const { data: zeilen = [], isLoading, isError } = useQuery({
    queryKey: ["algo-uebersicht", code],
    queryFn: () => api.algo.uebersicht(code!),
    enabled: !!code,
    refetchInterval: TAKT_MS,
  });

  return (
    <div className="flex flex-col gap-3">
      <SitzungLeiste wahl={wahl} />
      <div className="card overflow-x-auto">
        {isLoading && <p className="text-sm text-muted p-6 text-center">wird geladen …</p>}
        {isError && <p className="text-sm text-bad p-6 text-center">Die Übersicht ließ sich nicht laden.</p>}
        {!isLoading && !isError && zeilen.length === 0 && (
          <p className="text-sm text-muted p-6 text-center">Noch niemand da. Zeig den Code <b className="text-fg tracking-widest">{code ?? "…"}</b> oder den QR über »Zum Mitmachen«.</p>
        )}
        {zeilen.length > 0 && (
          <table className="w-full text-sm" data-testid="algo-uebersicht">
            <thead className="text-muted border-b border-line text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-normal">Name</th>
                <th className="px-2 py-2 text-right font-normal" title="Punkte aus allen Reitern">🏆</th>
                {AUTOMATEN.map(a => <th key={a.id} className="px-1 py-2 font-normal" title={a.name}>{a.icon}</th>)}
                <th className="w-2" />
                {AUFGABEN.map((a, i) => <th key={a.id} className="px-1 py-2 font-normal" title={a.titel}>F{i + 1}</th>)}
                {WELTEN.map(w => (
                  <th key={w.nr} colSpan={LEVEL.filter(l => l.welt === w.nr).length} className="px-1 py-2 font-normal border-l border-line" title={w.titel}>W{w.nr}</th>
                ))}
                <th className="px-3 py-2 text-right font-normal">zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z, i) => (
                <tr key={`${z.name}-${i}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-bold">{z.name}</span>
                    {z.klasse && <span className="text-xs text-muted ml-2">{z.klasse}</span>}
                    {z.gast && <span className="text-xs text-muted ml-2">Gast</span>}
                  </td>
                  <td className="px-2 text-right font-bold tabular-nums">{gesamt(z)}</td>
                  {AUTOMATEN.map(a => <td key={a.id} className="px-1 text-center">{erledigt(z, "automat", a.id)}</td>)}
                  <td />
                  {AUFGABEN.map(a => <td key={a.id} className="px-1 text-center">{erledigt(z, "fluss", a.id)}</td>)}
                  {LEVEL.map((l, j) => {
                    const s = z.level[l.id]?.sterne ?? 0;
                    const neueWelt = j === 0 || LEVEL[j - 1].welt !== l.welt;
                    return (
                      <td key={l.id} title={`${l.id} ${l.titel}${z.level[l.id]?.punkte ? ` — ${z.level[l.id].punkte} Punkte` : ""}`} className={`px-0.5 text-center text-xs ${neueWelt ? "border-l border-line" : ""}`}>
                        {s ? <span className="text-amber-500">{s}★</span> : <span className="text-muted">·</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-xs text-muted whitespace-nowrap">{vor(z.aktualisiert_am)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
