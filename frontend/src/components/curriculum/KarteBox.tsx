"use client";
/**
 * Eine Lehrplan-Karte in der linken (alt) oder rechten (neu) Spalte.
 * Neue Karten zeigen den Unterschied zur alten Partnerkarte wortweise:
 * durchgestrichen = fällt weg, blau = kommt dazu. In der Endfassung fällt
 * beides weg: nur der neue Wortlaut bleibt.
 *
 * Auf- und Zuklappen sowie die Endfassung stellt der Editor für alle Karten
 * über `KartenAnsicht` ein; jede Karte hat zusätzlich ihren eigenen Knopf.
 */
import { createContext, useContext } from "react";
import { NIVEAUS, karteText, wortDiff, type Index, type KarteMitPlan, type Niveau, type Paar, type Status, statusVon } from "@/lib/curriculum/modell";

export const KartenAnsicht = createContext<{
  offen: (id: string) => boolean;
  umschalten: (id: string) => void;
  endfassung: boolean;
}>({ offen: () => true, umschalten: () => {}, endfassung: false });

export const STATUS_STIL: Record<Status, { name: string; cls: string }> = {
  identisch: { name: "identisch", cls: "bg-green-500/15 text-green-600 border-green-500/40" },
  "geändert": { name: "geändert", cls: "bg-amber-500/15 text-amber-600 border-amber-500/40" },
  verschoben: { name: "verschoben", cls: "bg-violet-500/15 text-violet-500 border-violet-500/40" },
  neu: { name: "neu", cls: "bg-sky-500/15 text-sky-500 border-sky-500/40" },
  entfallen: { name: "entfällt", cls: "bg-red-500/15 text-red-500 border-red-500/40" },
};

export function StatusChip({ status }: { status: Status | null }) {
  if (!status) return null;
  const s = STATUS_STIL[status];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${s.cls}`}>{s.name}</span>;
}

function DiffText({ alt, neu }: { alt: string; neu: string }) {
  return (
    <>
      {wortDiff(alt, neu).map((t, i) =>
        t.art === "gleich" ? <span key={i}>{t.text}</span>
          : t.art === "weg" ? <del key={i} className="text-red-500/80">{t.text}</del>
            : <ins key={i} className="text-sky-500 no-underline bg-sky-500/10 rounded-sm">{t.text}</ins>)}
    </>
  );
}

export function KarteBox({ karte, idx, niveaus, paar, woanders, onOpen, draggable = true, nurNiveau, onLoesen }: {
  karte: KarteMitPlan;
  idx: Index;
  niveaus: Set<Niveau>;
  /** Paar, über das die (neue) Karte hier steht — für Diff und Unterschied */
  paar?: Paar | null;
  /** Karte gehört nach neuem Plan in einen anderen Block */
  woanders?: boolean;
  onOpen: () => void;
  draggable?: boolean;
  /** in einer Niveau-Zeile: nur diesen Text zeigen */
  nurNiveau?: Niveau;
  /** ✕ zum Lösen aus der Zeile */
  onLoesen?: () => void;
}) {
  const p = paar ?? (karte.plan.rolle === "neu" ? (idx.paareNeu.get(karte.id) ?? [])[0] : undefined);
  const status = p?.status ?? statusVon(idx, karte.id);
  const ansicht = useContext(KartenAnsicht);
  const auf = ansicht.offen(karte.id);
  // Vergleichstext je Niveau: erste alte Partnerkarte derselben Schulart mit Text für dieses Niveau.
  const altePartner = p && karte.plan.rolle === "neu"
    ? p.alt.map(id => idx.karten.get(id)).filter(k => k && k.plan.schulart === karte.plan.schulart) : [];
  const altText = (n: Niveau) => altePartner.find(k => k?.niveaus[n])?.niveaus[n];
  const zeilen = nurNiveau ? [nurNiveau] : NIVEAUS.filter(n => niveaus.has(n) && karte.niveaus[n]);
  const text = (n: Niveau) => (nurNiveau ? karteText(karte, n) : karte.niveaus[n]) ?? "";
  return (
    <div
      draggable={draggable}
      onDragStart={e => { e.dataTransfer.setData("text/plain", `karte:${karte.id}`); e.dataTransfer.effectAllowed = "link"; }}
      onClick={onOpen}
      className={`rounded-lg border bg-surface p-2 text-xs cursor-pointer hover:bg-surface-hover ${
        woanders ? "border-dashed border-violet-500/60 opacity-80" : "border-line"}`}
      title="Klicken zum Bearbeiten · in eine Unterrichtseinheit ziehen zum Zuordnen"
    >
      <div className={`flex items-center gap-1 flex-wrap ${auf ? "mb-1" : ""}`}>
        <button className="text-muted hover:text-fg w-4 shrink-0" title={auf ? "Zuklappen" : "Aufklappen"} aria-expanded={auf}
          onClick={e => { e.stopPropagation(); ansicht.umschalten(karte.id); }}>{auf ? "▾" : "▸"}</button>
        <span className="font-mono text-[10px] px-1 rounded bg-page border border-line">{karte.plan.schulart}</span>
        <span className="font-medium flex-1 min-w-0">{karte.titel ?? karte.id}</span>
        {woanders && <span className="text-[10px] text-violet-500">→ Kl. {karte.block === "9/10" && karte.klasse ? karte.klasse : karte.block}</span>}
        <StatusChip status={status} />
        {onLoesen && (
          <button className="text-muted hover:text-bad px-1" title="Aus dieser Zeile lösen"
            onClick={e => { e.stopPropagation(); onLoesen(); }}>✕</button>
        )}
      </div>
      {auf && zeilen.map(n => (
        <div key={n} className="flex gap-1 leading-snug mt-0.5">
          {!nurNiveau && <span className="font-mono text-[10px] text-muted w-5 shrink-0">{n}</span>}
          <span>
            {altText(n) && status !== "identisch" && !ansicht.endfassung
              ? <DiffText alt={altText(n)!} neu={text(n)} />
              : text(n)}
          </span>
        </div>
      ))}
      {auf && zeilen.length === 0 && <div className="text-muted italic">kein Text für die gewählten Niveaus</div>}
      {auf && !ansicht.endfassung && p?.unterschied && karte.plan.rolle === "neu" && (
        <div className="mt-1 text-[11px] text-amber-600">⚑ {p.unterschied}</div>
      )}
    </div>
  );
}
