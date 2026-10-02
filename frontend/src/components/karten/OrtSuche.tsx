"use client";
/** Ortssuche über alle benannten Objekte (auch Ortsteile über ihre Gemeinde). */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SuchTreffer } from "@/lib/karten/satz";

export default function OrtSuche({ bereich, onWahl }: { bereich?: string; onWahl: (t: SuchTreffer) => void }) {
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<SuchTreffer[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setTreffer([]); return; }
    const t = setTimeout(() => { api.karten.suche(q, bereich).then(setTreffer).catch(() => setTreffer([])); }, 250);
    return () => clearTimeout(t);
  }, [q, bereich]);

  return (
    <div className="flex flex-col gap-1">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Ort, Fluss, Berg suchen …" aria-label="Auf der Karte suchen"
        className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]" />
      {treffer.length > 0 && (
        <ul className="rounded-lg border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] max-h-64 overflow-auto">
          {treffer.map((t) => (
            <li key={`${t.ebene}:${t.id}`}>
              <button className="w-full text-left px-2 py-1 hover:bg-[var(--surface-hover)] flex justify-between gap-2"
                onClick={() => { onWahl(t); setQ(""); setTreffer([]); }}>
                <span>{t.name}{t.zusatz ? <span className="text-[var(--text-muted)]"> ({t.zusatz})</span> : null}</span>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0">{t.ebene_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
