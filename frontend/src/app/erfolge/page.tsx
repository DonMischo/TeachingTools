"use client";
/**
 * Übersicht aller Erfolge, nach Werkzeug geordnet.
 *
 * Gezählt wird, was auf diesem Gerät im Browser steht — die Erfolge sind
 * zum Üben da, nicht für Hauspunkte, und wandern deshalb nicht zum Server.
 */
import { useState } from "react";
import Link from "next/link";
import { useErfolge } from "@/hooks/useErfolge";
import type { SchauErfolg, WerkzeugSchau } from "@/lib/erfolge/register";

function Balken({ e }: { e: SchauErfolg }) {
  if (e.erreicht || e.ziel === undefined) return null;
  return (
    <div className="h-1 rounded bg-line mt-1 overflow-hidden">
      <div className="h-full bg-accent" style={{ width: `${((e.wert ?? 0) / e.ziel) * 100}%` }} />
    </div>
  );
}

function Eintrag({ e }: { e: SchauErfolg }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${e.erreicht ? "border-accent bg-accent/10" : "border-line"}`}>
      <div className="flex items-center gap-2">
        <span className={`text-lg ${e.erreicht ? "" : "grayscale opacity-40"}`}>{e.icon}</span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-bold ${e.erreicht ? "text-fg" : "text-muted"}`}>{e.name}</div>
          <div className="text-xs text-muted">{e.text}</div>
        </div>
        {e.ziel !== undefined && (
          <span className="text-xs tabular-nums text-muted shrink-0">{e.wert ?? 0}/{e.ziel}</span>
        )}
        {e.erreicht && <span className="text-accent text-sm shrink-0">✓</span>}
      </div>
      <Balken e={e} />
    </div>
  );
}

function Werkzeug({ w, offen, umschalten }: {
  w: WerkzeugSchau; offen: boolean; umschalten: () => void;
}) {
  const anteil = w.gesamt ? w.erreicht / w.gesamt : 0;
  const gruppen = [...new Set(w.erfolge.map(e => e.gruppe ?? ""))];
  return (
    <div className="card p-4 flex flex-col gap-3">
      <button onClick={umschalten} className="flex items-center gap-3 text-left">
        <span className="text-2xl">{w.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-black">{w.name}</div>
          <div className="h-1.5 rounded bg-line mt-1 overflow-hidden max-w-xs">
            <div className="h-full bg-accent" style={{ width: `${anteil * 100}%` }} />
          </div>
        </div>
        <span className="text-sm tabular-nums text-muted shrink-0">{w.erreicht}/{w.gesamt}</span>
        <span className="text-muted shrink-0">{offen ? "▾" : "▸"}</span>
      </button>

      {offen && (
        <div className="flex flex-col gap-3">
          {gruppen.map(g => (
            <div key={g} className="flex flex-col gap-1.5">
              {g && <div className="text-xs font-bold text-muted">{g}</div>}
              {w.erfolge.filter(e => (e.gruppe ?? "") === g).map(e => <Eintrag key={e.id} e={e} />)}
            </div>
          ))}
          <Link href={`/simulationen/${w.slug}`} className="text-xs text-muted hover:text-fg underline self-start">
            {w.name} öffnen →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ErfolgeSeite() {
  const { werkzeuge, erreicht, gesamt, geladen } = useErfolge();
  const [offen, setOffen] = useState<string | null>(null);
  const bereiche = [...new Set(werkzeuge.map(w => w.bereich))];

  return (
    <div className="page">
      <div>
        <h1 className="text-2xl font-black">🏅 Erfolge</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Was du in den Werkzeugen schon geschafft hast — gesammelt aus allen, die mitzählen.
          Der Stand liegt in diesem Browser: auf einem anderen Gerät fängst du neu an, und
          Hauspunkte gibt es dafür nicht. Klick auf ein Werkzeug für die ganze Liste.
        </p>
      </div>

      {!geladen ? (
        <p className="text-sm text-muted">Wird gelesen …</p>
      ) : (
        <>
          <div className="card p-4 flex items-center gap-4">
            <span className="text-3xl">🏅</span>
            <div className="flex-1">
              <div className="text-xl font-black">{erreicht} von {gesamt} Erfolgen</div>
              <div className="h-2 rounded bg-line mt-1 overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${gesamt ? (erreicht / gesamt) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {bereiche.map(b => (
            <div key={b} className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-muted">{b}</h2>
              {werkzeuge.filter(w => w.bereich === b).map(w => (
                <Werkzeug key={w.slug} w={w} offen={offen === w.slug}
                  umschalten={() => setOffen(o => (o === w.slug ? null : w.slug))} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
