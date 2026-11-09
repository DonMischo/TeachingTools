"use client";
/**
 * Eine Lehrplan-Karte in der linken (alt) oder rechten (neu) Spalte.
 * Neue Karten zeigen den Unterschied zur alten Partnerkarte wortweise:
 * durchgestrichen = fällt weg, blau = kommt dazu. In der Endfassung fällt
 * beides weg: nur der neue Wortlaut bleibt.
 *
 * Auf- und Zuklappen, Endfassung und Auswahl (Strg-Klick, für Strg+C/V und
 * Ziehen mehrerer Karten) stellt der Editor über `KartenAnsicht` bereit.
 */
import { Verknuepfungen } from "./Verknuepfungen";
import { createContext, useContext } from "react";
import { NIVEAUS, NIVEAU_FARBE, gleichWie, gleicherText, karteText, wortDiff, type Index, type KarteMitPlan, type Niveau, type Verknuepfung, type Paar, type Status, statusVon } from "@/lib/curriculum/modell";

export const KartenAnsicht = createContext<{
  offen: (id: string) => boolean;
  umschalten: (id: string) => void;
  endfassung: boolean;
  gewaehlt: (id: string, herkunft?: string) => boolean;
  waehlen: (id: string, herkunft?: string) => void;
  /** ids, die ein Ziehen dieser Karte mitnimmt (die Auswahl, wenn sie dazugehört) */
  ziehen: (id: string, herkunft?: string) => string[];
  /** Material einer Karte ändern; fehlt → nur lesen */
  material?: (karte: KarteMitPlan, links: Verknuepfung[]) => void;
}>({ offen: () => true, umschalten: () => {}, endfassung: false, gewaehlt: () => false, waehlen: () => {}, ziehen: id => [id] });

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

export function KarteBox({ karte, idx, niveaus, paar, woanders, onOpen, draggable = true, nurNiveau, onLoesen, ohneBereich, herkunft }: {
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
  /** Bereich nicht als Chip zeigen (steht schon in der Gruppenüberschrift) */
  ohneBereich?: boolean;
  /** Einheit, in der die Karte hier steht (für Auswahl und Strg+X); fehlt im Deck */
  herkunft?: string;
}) {
  const p = paar ?? (karte.plan.rolle === "neu" ? (idx.paareNeu.get(karte.id) ?? [])[0] : undefined);
  const status = p?.status ?? statusVon(idx, karte.id);
  const ansicht = useContext(KartenAnsicht);
  const auf = ansicht.offen(karte.id);
  // Vergleichstext je Niveau: erste alte Partnerkarte derselben Schulart mit Text für dieses Niveau.
  const altePartner = p && karte.plan.rolle === "neu"
    ? p.alt.map(id => idx.karten.get(id)).filter(k => k && k.plan.schulart === karte.plan.schulart) : [];
  const altText = (n: Niveau) => altePartner.find(k => k?.niveaus[n])?.niveaus[n];
  // Nur zeigen, was obendrauf kommt: R entfällt, wenn es wortgleich mit H ist, G, wenn es wortgleich mit R bzw. H ist.
  const darunter = (n: Niveau) => (n === "R" ? karte.niveaus.H : n === "G" ? karte.niveaus.R ?? karte.niveaus.H : undefined);
  const zeilen = nurNiveau ? [nurNiveau]
    : NIVEAUS.filter(n => niveaus.has(n) && karte.niveaus[n] && !gleicherText(karte.niveaus[n], darunter(n)));
  const text = (n: Niveau) => (nurNiveau ? karteText(karte, n) : karte.niveaus[n]) ?? "";
  // Zusammengeführte Karten sind ausgedünnt: R und G nennen nur, was über das Niveau darunter hinausgeht.
  const zusatz = (n: Niveau) => !!karte.voll && ((n === "R" && !!karte.niveaus.H) || (n === "G" && !!(karte.niveaus.R || karte.niveaus.H)));
  const stufen = (["H", "R", "G"] as Niveau[]).filter(n => karte.niveaus[n]);
  return (
    <div
      draggable={draggable}
      onDragStart={e => { e.dataTransfer.setData("text/plain", `karte:${ansicht.ziehen(karte.id, herkunft).join(",")}`); e.dataTransfer.effectAllowed = "link"; }}
      onClick={e => { if (e.ctrlKey || e.metaKey) ansicht.waehlen(karte.id, herkunft); else onOpen(); }}
      className={`rounded-lg border bg-surface p-2 text-xs cursor-pointer hover:bg-surface-hover ${
        woanders ? "border-dashed border-violet-500/60 opacity-80" : "border-line"} ${
        ansicht.gewaehlt(karte.id, herkunft) ? "ring-2 ring-accent bg-accent/10" : ""}`}
      title="Klicken zum Bearbeiten · Strg-Klick wählt aus (Strg+C/X, Zelle anklicken, Strg+V; Strg+Z macht rückgängig) · in eine Spalte ziehen verteilt auf G/R/H"
    >
      <div className={`flex items-center gap-1 flex-wrap ${auf ? "mb-1" : ""}`}>
        <button className="text-muted hover:text-fg w-4 shrink-0" title={auf ? "Zuklappen" : "Aufklappen"} aria-expanded={auf}
          onClick={e => { e.stopPropagation(); ansicht.umschalten(karte.id); }}>{auf ? "▾" : "▸"}</button>
        {/* In einer Niveau-Zeile zeigt die Karte das Niveau der Zeile; im Deck eine zusammengeführte Karte ihre Niveaus */}
        {nurNiveau && (karte.plan.schulart !== "GY" || nurNiveau === "G") && (nurNiveau === "G" || nurNiveau === "R" || nurNiveau === "H")
          ? <span className="font-mono text-[10px] px-1 rounded text-white" style={{ background: NIVEAU_FARBE[nurNiveau] }}
              title={`${nurNiveau === "H" ? "Hauptschul" : nurNiveau === "R" ? "Realschul" : "Gymnasial"}niveau dieser Karte`}>{nurNiveau}</span>
          : karte.plan.schulart === "RS+GY"
            ? <span className="flex gap-px" title="Niveaus dieser Karte (zusammengeführt aus Regelschule und Gymnasium)">
                {stufen.map(n => <span key={n} className="font-mono text-[10px] px-1 rounded text-white" style={{ background: NIVEAU_FARBE[n] }}>{n}</span>)}
              </span>
            : <span className="font-mono text-[10px] px-1 rounded bg-page border border-line">{karte.plan.schulart}</span>}
        {karte.bereich && !ohneBereich && (
          <span className="text-[10px] px-1 rounded bg-page border border-line text-muted" title="Bereich">{karte.bereich}</span>
        )}
        <span className="font-medium flex-1 min-w-0">{karte.titel ?? karte.id}</span>
        {woanders && <span className="text-[10px] text-violet-500">→ Kl. {karte.block === "9/10" && karte.klasse ? karte.klasse : karte.block}</span>}
        {!!karte.links?.length && !auf && <span className="text-[10px] text-muted" title={karte.links.map(l => l.label).join(" · ")}>📎{karte.links.length}</span>}
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
            {zusatz(n) && <b className="mr-0.5" title="Zusatz gegenüber dem Niveau darunter">+</b>}
            {altText(n) && status !== "identisch" && !ansicht.endfassung
              ? <DiffText alt={altText(n)!} neu={text(n)} />
              : text(n)}
          </span>
        </div>
      ))}
      {/* R/G ohne eigenen Zusatz: Hinweis statt Wiederholung */}
      {auf && !nurNiveau && (["R", "G"] as Niveau[]).filter(n => niveaus.has(n) && !zeilen.includes(n)).map(n => {
        const wie = gleichWie(karte, n);
        return wie && (
          <div key={`gleich-${n}`} className="flex gap-1 leading-snug mt-0.5 text-muted" title={`${n} verlangt hier nichts über ${wie} hinaus`}>
            <span className="font-mono text-[10px] w-5 shrink-0">{n}</span>
            <span className="italic">= wie {wie}</span>
          </div>
        );
      })}
      {auf && zeilen.length === 0 && <div className="text-muted italic">kein Text für die gewählten Niveaus</div>}
      {auf && (!!karte.links?.length || ansicht.material) && !ansicht.endfassung && (
        <div className="mt-1"><Verknuepfungen links={karte.links} klein onChange={ansicht.material && (links => ansicht.material!(karte, links))} /></div>
      )}
      {auf && !ansicht.endfassung && p?.unterschied && karte.plan.rolle === "neu" && (
        <div className="mt-1 text-[11px] text-amber-600">⚑ {p.unterschied}</div>
      )}
    </div>
  );
}
