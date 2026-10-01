"use client";
/**
 * Kartentool — Deutschland politisch, topographisch oder stumm.
 * Ebenen einzeln an/aus, Namen an/aus. Daten: BKG und Natural Earth,
 * alles vom eigenen Server (siehe frontend/scripts/fetch-karten.mjs).
 */
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { auswahlFuer, baueStil, KARTENARTEN, type Auswahl, type Ebene, type Kartenart } from "@/lib/karten/stil";
import KartenAnsicht from "./KartenAnsicht";

export default function Karten({ action }: { action?: ReactNode }) {
  const { data: katalog, error } = useQuery({ queryKey: ["karten", "katalog"], queryFn: api.karten.katalog, staleTime: Infinity });
  const [art, setArt] = useState<Kartenart>("topographisch");
  const [auswahl, setAuswahl] = useState<Auswahl>(() => auswahlFuer("topographisch"));
  const stil = useMemo(() => (katalog ? baueStil(katalog, auswahl, art) : null), [katalog, auswahl, art]);

  const waehleArt = (a: Kartenart) => { setArt(a); setAuswahl(auswahlFuer(a)); };
  const schalte = (id: string) => setAuswahl((v) => ({
    ...v, ebenen: v.ebenen.includes(id) ? v.ebenen.filter((e) => e !== id) : [...v.ebenen, id],
  }));

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🗺️ Karten</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Deutschland politisch und topographisch — Ebenen einzeln zuschalten, Namen ausblenden für stumme Karten.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="inline-flex flex-wrap self-start rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
        {KARTENARTEN.map((k) => (
          <button key={k.id} onClick={() => waehleArt(k.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              art === k.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {k.icon} {k.name}
          </button>
        ))}
      </div>

      {error && <p className="text-[var(--red)] text-sm">Karten konnten nicht geladen werden.</p>}
      {katalog && stil && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-start">
          <KartenAnsicht stil={stil} katalog={katalog} namenZeigen={auswahl.beschriftung} />
          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4 text-sm">
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={auswahl.beschriftung}
                onChange={() => setAuswahl((v) => ({ ...v, beschriftung: !v.beschriftung }))} />
              Namen zeigen
            </label>
            {(["politisch", "topographisch"] as const).map((gruppe) => (
              <EbenenGruppe key={gruppe} titel={gruppe === "politisch" ? "Politisch" : "Topographisch"}
                ebenen={katalog.ebenen.filter((e) => e.gruppe === gruppe)} an={auswahl.ebenen} schalte={schalte} />
            ))}
            {auswahl.ebenen.includes("de-hoehen") && <Hoehenlegende ebene={katalog.ebenen.find((e) => e.id === "de-hoehen")} />}
          </aside>
        </div>
      )}
    </div>
  );
}

function EbenenGruppe({ titel, ebenen, an, schalte }: { titel: string; ebenen: Ebene[]; an: string[]; schalte: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{titel}</h3>
      {ebenen.map((e) => (
        <label key={e.id} className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={an.includes(e.id)} onChange={() => schalte(e.id)} />
          <span>{e.name}</span>
        </label>
      ))}
    </div>
  );
}

function Hoehenlegende({ ebene }: { ebene?: Ebene }) {
  if (!ebene?.stufen) return null;
  // Von oben (hoch) nach unten; die Stufe unter 0 m ist nur Übergang
  const stufen = ebene.stufen.filter((s) => s.ab >= 0).reverse();
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Höhe über NN</h3>
      {stufen.map((s) => (
        <div key={s.ab} className="flex items-center gap-2 text-xs">
          <span className="w-6 h-3.5 rounded-sm border border-black/20" style={{ background: s.farbe }} />
          ab {s.ab.toLocaleString("de-DE")} m
        </div>
      ))}
    </div>
  );
}
