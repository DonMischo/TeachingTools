"use client";
/**
 * Live-Übersicht für die Lehrkraft: wer über den Code mitmacht, welche Stufen
 * geschafft sind (Sterne), wer eine Prüfung bestanden hat.
 *
 * Abgefragt wird alle fünf Sekunden — wie die Tafel der KI-Werkstatt. Ein
 * WebSocket lohnt sich nicht: die Kinder melden ohnehin nur, wenn eine Stufe
 * fertig ist.
 */
import { useQuery } from "@tanstack/react-query";
import { api, type MausUebersichtZeile } from "@/lib/api";
import { TEILE, type StufeId, type Teil } from "@/lib/maus/ergebnis";

const TAKT_MS = 5000;

const ICON: Record<StufeId, string> = {
  klick: "👆", doppelklick: "✌️", rechtsklick: "📋", ziehen: "✋", markieren: "🖍️", kopieren: "📄",
  scrollen: "🖱️", tastatur: "⌨️", explorer: "📁", fenster: "🪟", screenshot: "📸",
  suche: "🔍", apps: "🧰", aussehen: "🎨", bedienhilfe: "🔎", taskleiste: "📌", profil: "🔒",
};

function vor(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60);
  return m < 60 ? `vor ${m} Min.` : `vor ${Math.round(m / 60)} Std.`;
}

function Sterne({ n }: { n: number | undefined }) {
  if (!n) return <span className="text-muted">·</span>;
  return <span className="text-amber-500 tracking-tighter" title={`${n} von 3 Sternen`}>{"★".repeat(n)}</span>;
}

function Teilzellen({ z, teil }: { z: MausUebersichtZeile; teil: Teil }) {
  return (
    <>
      {TEILE[teil].map(id => (
        <td key={id} className="px-1.5 py-2 text-center text-xs whitespace-nowrap">
          <Sterne n={z.stufen[id]?.sterne} />
        </td>
      ))}
      <td className="px-2 py-2 text-center">{z.bestanden.includes(teil) ? "🎓" : ""}</td>
    </>
  );
}

export default function MausUebersicht() {
  const { data: sitzung, isError: sitzungFehler } = useQuery({
    queryKey: ["maus-sitzung"],
    queryFn: () => api.toolSessions.create("maus"),
  });
  const code = sitzung?.code;

  const { data: zeilen = [], isLoading, isError } = useQuery({
    queryKey: ["maus-uebersicht", code],
    queryFn: () => api.maus.uebersicht(code!),
    enabled: !!code,
    refetchInterval: TAKT_MS,
  });

  if (sitzungFehler) {
    return <p className="text-sm text-bad">Die Sitzung ließ sich nicht öffnen.</p>;
  }

  const kopf = (teil: Teil) => (
    <>
      {TEILE[teil].map(id => (
        <th key={id} className="px-1.5 py-2 text-center font-normal" title={id}>{ICON[id]}</th>
      ))}
      <th className="px-2 py-2 text-center font-normal" title={`Prüfung Teil ${teil}`}>🎓{teil}</th>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Alle, die über den Code <b className="text-fg tracking-widest">{code ?? "…"}</b> mitmachen.
        Die Liste aktualisiert sich alle fünf Sekunden; 🤝 heißt Hilfsmodus.
      </p>

      <div className="card overflow-x-auto">
        {isLoading && <p className="text-sm text-muted p-6 text-center">wird geladen …</p>}
        {isError && <p className="text-sm text-bad p-6 text-center">Die Übersicht ließ sich nicht laden.</p>}
        {!isLoading && !isError && zeilen.length === 0 && (
          <p className="text-sm text-muted p-6 text-center">
            Noch niemand da. Zeig den Code oder QR über »Zum Mitmachen«.
          </p>
        )}
        {zeilen.length > 0 && (
          <table className="w-full text-sm" data-testid="maus-uebersicht">
            <thead className="text-muted border-b border-line">
              <tr>
                <th className="px-3 py-2 text-left font-normal">Name</th>
                {kopf(1)}
                <th className="w-2" />
                {kopf(2)}
                <th className="w-2" />
                {kopf(3)}
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
                    {z.hilfe && <span className="ml-2" title="Hilfsmodus">🤝</span>}
                  </td>
                  <Teilzellen z={z} teil={1} />
                  <td />
                  <Teilzellen z={z} teil={2} />
                  <td />
                  <Teilzellen z={z} teil={3} />
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
