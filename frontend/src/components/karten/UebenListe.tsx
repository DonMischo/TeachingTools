"use client";
/**
 * Kartensätze zum selbstständigen Üben (geteilte; Lehrkräfte auch eigene) mit eigenem Stand.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function UebenListe() {
  const { data } = useQuery({ queryKey: ["karten", "selbst"], queryFn: api.karten.selbstSaetze });
  if (!data?.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">🎯 Kartensätze üben</h3>
      {data.map((s) => (
        <Link key={s.id} href={`/aktivitaeten/karten/ueben/${s.id}`}
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]">
          <span className="font-bold truncate">{s.titel}</span>
          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap" title="sicher gelernt / Objekte im Satz">
            {s.geuebt ? `${s.sicher} / ${s.aufgaben} sicher` : `${s.aufgaben} Objekte`}
          </span>
        </Link>
      ))}
    </div>
  );
}
