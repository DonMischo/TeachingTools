"use client";
/**
 * Klassenübersicht am Beamer, ganz anonym: wie viele mitspielen, wie viele je
 * Klasse, und der Durchschnitt der Klasse auf der Bühne neben dem NPC —
 * der Durchschnitt erst ab drei Figuren (prüft der Server).
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { KLASSEN, lauf, werte, type KlasseId, type Wert } from "@/lib/mainCharacter";
import { Buehne } from "./Buehne";
import { FIGUR_GRUPPEN } from "./Steuerung";

const null5: Record<Wert, number> = { W: 0, Z: 0, S: 0, M: 0, E: 0 };

export function Uebersicht({ code }: { code: string }) {
  const { data, isError } = useQuery({
    queryKey: ["main-character-uebersicht", code],
    queryFn: () => api.mainCharacter.uebersicht(code),
    refetchInterval: 5000,
  });
  if (isError) return <p className="card p-4 text-sm text-bad">Die Übersicht lässt sich gerade nicht laden.</p>;
  if (!data) return <p className="card p-4 text-sm text-muted">Lade Übersicht …</p>;

  const haeufigste = (Object.entries(data.je_klasse) as [KlasseId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "checker";
  const woche = Math.round(data.woche_schnitt ?? 0);
  const npc = werte(lauf(KLASSEN.npc, undefined, undefined, woche));
  const schnitt = (data.schnitt as Record<Wert, number> | null) ?? null5;
  const max = Math.max(1, ...Object.values(data.je_klasse));

  return (
    <div className="flex flex-col gap-4">
      <Buehne klasse={haeufigste} stand={{ werte: schnitt, npc, spitzen: schnitt, delta: null5 }}
        motto={data.schnitt ? `Klassen-Schnitt aus ${data.anzahl} Figuren, im Mittel Woche ${woche}.` : `Der Schnitt erscheint ab ${data.min_fuer_schnitt} Figuren.`}
        steuerung={<div className="mc-stand"><div className="mc-zeile"><span>Dabei: <b>{data.anzahl}</b></span><span className="mc-woche">Ø Woche {woche}</span></div></div>} />
      <section className="card p-4 flex flex-col gap-3">
        <h2 className="font-semibold">Welche Klassen gespielt werden</h2>
        {data.anzahl === 0 ? (
          <p className="text-sm text-muted">Noch niemand dabei. Wer über Code oder QR beitritt und das Spiel startet, erscheint hier — ohne Namen.</p>
        ) : (
          <ul className="grid gap-1.5">
            {FIGUR_GRUPPEN.flatMap(g => g.klassen).map(k => {
              const n = data.je_klasse[k] ?? 0;
              return (
                <li key={k} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: "10rem 1fr 2rem" }}>
                  <span>{KLASSEN[k].name}</span>
                  <div className="h-3 rounded bg-surface-hover overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(n / max) * 100}%` }} /></div>
                  <span className="tabular-nums text-right">{n}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">Anonym: Hier stehen keine Namen, Antworten, Stärken oder Baustellen. Die bleiben auf den Geräten.</p>
      </section>
    </div>
  );
}
