"use client";
/**
 * Curriculum-Abgleich: drei Spalten je Klassenblock.
 *
 *   alter Lehrplan (Karten am Thema) | unser Curriculum | neuer Lehrplan
 *
 * Rechts stehen zu jedem Thema die Partner seiner alten Karten — gleich,
 * geändert (Wort-Diff) oder gestrichelt, wenn sie neu in einem anderen Block
 * liegen. Unter jedem Block folgen die neuen Karten, die noch kein Thema
 * abdeckt (neu oder hierher verschoben). Themen werden per Ziehen zwischen
 * Klassen verschoben, Karten per Ziehen einem Thema zugeordnet.
 *
 * Gespeichert wird über Operationen (api/curriculum_ops.py); alle paar
 * Sekunden fragt die Seite, ob jemand anderes etwas geändert hat.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type CurriculumPlanOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import {
  BLOECKE, KLASSEN_JE_BLOCK, NIVEAUS, freieAlteKarten, index, neueId, niveauGilt, offeneKarten,
  themaSicht, wochenSumme, type Block, type KarteMitPlan, type Klasse, type Niveau, type Thema,
} from "@/lib/curriculum/modell";
import { KarteBox } from "./KarteBox";
import { ImportDialog, KarteDialog, KiDialog, TeilenDialog, ThemaDialog } from "./Dialoge";

type Op = Record<string, unknown>;
type Offen =
  | { art: "thema"; thema: Thema; klasse: number }
  | { art: "karte"; karte: KarteMitPlan }
  | { art: "ki" } | { art: "import" } | { art: "teilen" }
  | null;

const POLL_MS = 4000;

export function CurriculumEditor({ start, guestToken }: { start: CurriculumPlanOut; guestToken?: string }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(start);
  const [offen, setOffen] = useState<Offen>(null);
  const [niveaus, setNiveaus] = useState<Set<Niveau>>(new Set(["G", "R", "H"]));
  const [schularten, setSchularten] = useState<Set<string>>(new Set(["RS", "GY"]));
  const [nurKonflikte, setNurKonflikte] = useState(false);
  const [suche, setSuche] = useState("");
  const [ziehZiel, setZiehZiel] = useState<string | null>(null);
  const laeuft = useRef(false);

  const doc = plan.data;
  const idx = useMemo(() => index(doc), [doc]);
  const nurLesen = !plan.darf_bearbeiten;

  const ops = useCallback(async (liste: Op[]) => {
    if (!liste.length) return;
    laeuft.current = true;
    try { setPlan(await api.curriculum.ops(plan.id, liste, guestToken)); }
    catch (e: any) { toast(e.message ?? "Speichern fehlgeschlagen", "error"); }
    finally { laeuft.current = false; }
  }, [plan.id, guestToken, toast]);

  // Änderungen anderer abholen (nicht während eines eigenen Schreibens / offenen Dialogs).
  const version = plan.version;
  useEffect(() => {
    const t = setInterval(async () => {
      if (laeuft.current || offen || document.hidden) return;
      try {
        const r = await api.curriculum.poll(plan.id, version, guestToken);
        if ("data" in r) setPlan(r);
      } catch { /* nächster Versuch */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [plan.id, version, guestToken, offen]);

  const sichtbar = (k: KarteMitPlan) => schularten.has(k.plan.schulart);
  const passt = (t: Thema) => !suche.trim() || `${t.titel} ${Object.values(t.inhalte).join(" ")}`.toLowerCase().includes(suche.toLowerCase());

  // ── Ziehen & Ablegen ──────────────────────────────────────────────────────
  const findeThema = (id: string) => {
    for (const k of doc.curriculum.klassen) {
      const i = k.themen.findIndex(t => t.id === id);
      if (i >= 0) return { klasse: k.klasse, pos: i, thema: k.themen[i] };
    }
    return null;
  };
  const ablegen = (daten: string, klasse: number, vorThema?: Thema) => {
    setZiehZiel(null);
    if (nurLesen) return;
    const [art, id] = [daten.slice(0, daten.indexOf(":")), daten.slice(daten.indexOf(":") + 1)];
    if (art === "thema") {
      const q = findeThema(id);
      if (!q || q.thema.id === vorThema?.id) return;
      const kl = doc.curriculum.klassen.find(k => k.klasse === klasse);
      let pos = vorThema ? kl?.themen.findIndex(t => t.id === vorThema.id) ?? 0 : kl?.themen.length ?? 0;
      if (q.klasse === klasse && q.pos < pos) pos -= 1;  // eigenes Herausnehmen verschiebt die Stelle
      ops([{ op: "thema", klasse, pos, thema: q.thema }]);
    } else if (art === "karte" && vorThema) {
      if (!vorThema.karten.includes(id)) ops([{ op: "thema", klasse, thema: { ...vorThema, karten: [...vorThema.karten, id] } }]);
    }
  };
  const ziel = (key: string, klasse: number, thema?: Thema) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setZiehZiel(key); },
    onDragLeave: () => setZiehZiel(z => (z === key ? null : z)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); ablegen(e.dataTransfer.getData("text/plain"), klasse, thema); },
  });

  const neuesThema = (karte: KarteMitPlan, klasse: number, wochen: number | null) => {
    const thema: Thema = {
      id: neueId(doc, klasse), titel: karte.titel ?? "Neues Thema", wochen,
      inhalte: Object.fromEntries(Object.entries(karte.niveaus).filter(([n]) => niveauGilt(n as Niveau, klasse))),
      karten: [karte.id], notiz: "",
    };
    ops([{ op: "thema", klasse, thema }]);
  };

  const herunterladen = () => {
    const blob = new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${plan.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const inkraft = (klasse: number) => [...new Set(doc.lehrplaene.filter(l => l.rolle === "neu" && l.inkraft?.[klasse])
    .map(l => l.inkraft![klasse]))].join(" / ");

  // ── Darstellung ───────────────────────────────────────────────────────────
  const klasseVon = (nr: number): Klasse =>
    doc.curriculum.klassen.find(k => k.klasse === nr) ?? { klasse: nr, wochen_verfuegbar: 36, themen: [] };

  return (
    <div className="flex flex-col gap-3">
      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-2 sticky top-0 z-20 bg-page py-2 border-b border-line">
        <div className="flex gap-1" title="Welche Niveaus angezeigt werden">
          {NIVEAUS.map(n => (
            <button key={n} className={`chip text-xs ${niveaus.has(n) ? "chip-on" : ""}`}
              onClick={() => setNiveaus(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; })}>{n}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {["RS", "GY"].map(s => (
            <button key={s} className={`chip text-xs ${schularten.has(s) ? "chip-on" : ""}`}
              onClick={() => setSchularten(x => { const y = new Set(x); y.has(s) ? y.delete(s) : y.add(s); return y; })}>{s}-Karten</button>
          ))}
        </div>
        <button className={`chip text-xs ${nurKonflikte ? "chip-on" : ""}`} onClick={() => setNurKonflikte(v => !v)}>⚠ nur Konflikte</button>
        <input className="input w-44 text-sm py-1" placeholder="Thema suchen…" value={suche} onChange={e => setSuche(e.target.value)} />
        <span className="flex-1" />
        <span className="text-xs text-muted">{nurLesen ? "nur lesen · " : ""}v{plan.version}{plan.zuletzt_von ? ` · zuletzt ${plan.zuletzt_von}` : ""}</span>
        <button className="btn-secondary text-sm" onClick={() => setOffen({ art: "ki" })}>🤖 KI-Prompt</button>
        {!nurLesen && <button className="btn-secondary text-sm" onClick={() => setOffen({ art: "import" })}>⬆ Hochladen</button>}
        <button className="btn-secondary text-sm" onClick={herunterladen}>⬇ JSON</button>
        {!guestToken && <button className="btn-secondary text-sm" onClick={() => setOffen({ art: "teilen" })}>👥 Teilen</button>}
      </div>

      <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-3 text-xs font-semibold text-muted px-1">
        <div>ALT · {doc.lehrplaene.filter(l => l.rolle === "alt").map(l => l.titel ?? l.id).join(" · ")}</div>
        <div>UNSER CURRICULUM {doc.curriculum.stand && `(Stand ${doc.curriculum.stand})`}</div>
        <div>NEU · {doc.lehrplaene.filter(l => l.rolle === "neu").map(l => l.titel ?? l.id).join(" · ")}</div>
      </div>

      {BLOECKE.map(blockAbschnitt)}

      {offen?.art === "thema" && <ThemaDialog thema={offen.thema} klasse={offen.klasse} idx={idx} onOps={ops} onClose={() => setOffen(null)} nurLesen={nurLesen} />}
      {offen?.art === "karte" && <KarteDialog karte={offen.karte} idx={idx} doc={doc} onOps={ops} onClose={() => setOffen(null)} nurLesen={nurLesen} neuesThema={neuesThema} />}
      {offen?.art === "ki" && <KiDialog doc={doc} onClose={() => setOffen(null)} />}
      {offen?.art === "import" && <ImportDialog doc={doc} onOps={ops} onClose={() => setOffen(null)} />}
      {offen?.art === "teilen" && (
        <TeilenDialog plan={plan} onClose={() => setOffen(null)}
          onPatch={async b => { try { setPlan(await api.curriculum.patch(plan.id, b)); } catch (e: any) { toast(e.message, "error"); } }}
          onNewCode={async () => { try { setPlan(await api.curriculum.newGuestCode(plan.id)); } catch (e: any) { toast(e.message, "error"); } }} />
      )}
    </div>
  );

  // Render-Funktionen statt innerer Komponenten: sonst baut React die Zeilen bei
  // jedem Render neu auf, und ein laufendes Ziehen bricht ab.
  function blockAbschnitt(block: Block) {
    const offeneNeu = offeneKarten(doc, idx, block).filter(o => sichtbar(o.karte));
    const freieAlt = freieAlteKarten(doc, block).filter(sichtbar);
    return (
      <section key={block} className="rounded-xl border border-line">
        <h2 className="px-3 py-2 font-bold bg-surface rounded-t-xl">Klassen {block}</h2>
        {KLASSEN_JE_BLOCK[block].map(nr => {
          const kl = klasseVon(nr);
          const summe = wochenSumme(kl);
          const zuViel = summe > kl.wochen_verfuegbar;
          const ab = inkraft(nr);
          return (
            <Fragment key={nr}>
              <div {...ziel(`k${nr}`, nr)}
                className={`flex items-center gap-2 px-3 py-1.5 border-t border-line text-sm ${ziehZiel === `k${nr}` ? "bg-accent/10" : ""}`}>
                <span className="font-semibold">Klasse {nr}</span>
                {ab && <span className="text-xs text-muted">· neuer Plan ab {ab}</span>}
                {nr > 9 && <span className="text-xs text-muted">· ohne Hauptschulniveau</span>}
                <span className="flex-1" />
                <span className={`text-xs ${zuViel ? "text-bad font-semibold" : "text-muted"}`}>
                  {summe.toLocaleString("de")} /
                </span>
                <input type="number" min={0} className="input w-16 py-0.5 text-xs" value={kl.wochen_verfuegbar} disabled={nurLesen}
                  onChange={e => ops([{ op: "klasse", klasse: nr, wochen_verfuegbar: Number(e.target.value) }])} />
                <span className="text-xs text-muted">Wochen</span>
                {!nurLesen && (
                  <button className="btn-secondary text-xs py-0.5" onClick={() =>
                    setOffen({ art: "thema", klasse: nr, thema: { id: neueId(doc, nr), titel: "", wochen: null, inhalte: {}, karten: [] } })}>+ Thema</button>
                )}
              </div>
              {kl.themen.length === 0 && <div className="px-3 pb-2 text-xs text-muted">Noch keine Themen — Themen hierher ziehen oder anlegen.</div>}
              {kl.themen.filter(passt).map(t => {
                const s = themaSicht(idx, t, nr);
                if (nurKonflikte && s.konflikte.length === 0) return null;
                return (
                  <div key={t.id} {...ziel(t.id, nr, t)}
                    className={`grid grid-cols-[1fr_1.3fr_1fr] gap-3 px-3 py-2 border-t border-line/50 ${ziehZiel === t.id ? "bg-accent/10" : ""}`}>
                    <div className="flex flex-col gap-1">
                      {s.alt.filter(sichtbar).map(k => <KarteBox key={k.id} karte={k} idx={idx} niveaus={niveaus} onOpen={() => setOffen({ art: "karte", karte: k })} />)}
                    </div>
                    {themaBox(t, nr, s.konflikte)}
                    <div className="flex flex-col gap-1">
                      {s.neu.filter(n => sichtbar(n.karte)).map(n => (
                        <KarteBox key={n.karte.id} karte={n.karte} idx={idx} niveaus={niveaus} paar={n.paar} woanders={n.woanders}
                          onOpen={() => setOffen({ art: "karte", karte: n.karte })} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
        {(offeneNeu.length > 0 || freieAlt.length > 0) && !nurKonflikte && (
          <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-3 px-3 py-2 border-t-2 border-dashed border-line bg-surface/40 rounded-b-xl">
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">{freieAlt.length} alte Karten ohne Thema</summary>
              <div className="flex flex-col gap-1 mt-1">
                {freieAlt.map(k => <KarteBox key={k.id} karte={k} idx={idx} niveaus={niveaus} onOpen={() => setOffen({ art: "karte", karte: k })} />)}
              </div>
            </details>
            <div className="text-xs text-muted self-start">
              <b className="text-fg">Offen in {block}:</b> {offeneNeu.length} Karten des neuen Plans deckt noch kein Thema ab —
              neue Inhalte und solche, die aus einem anderen Block hierher wandern. Auf ein Thema ziehen oder per Klick
              als neues Thema anlegen.
            </div>
            <div className="flex flex-col gap-1">
              {offeneNeu.map(o => (
                <KarteBox key={o.karte.id} karte={o.karte} idx={idx} niveaus={niveaus} paar={o.paar}
                  onOpen={() => setOffen({ art: "karte", karte: o.karte })} />
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  function themaBox(thema: Thema, klasse: number, konflikte: string[]) {
    const zeilen = NIVEAUS.filter(n => niveaus.has(n) && thema.inhalte[n]?.trim());
    return (
      <div
        draggable={!nurLesen}
        onDragStart={e => { e.dataTransfer.setData("text/plain", `thema:${thema.id}`); e.dataTransfer.effectAllowed = "move"; }}
        onClick={() => setOffen({ art: "thema", thema, klasse })}
        className={`rounded-lg border-2 bg-page p-2 text-sm cursor-pointer hover:bg-surface-hover ${konflikte.length ? "border-bad/70" : "border-accent/50"}`}
        title="Klicken zum Bearbeiten · ziehen zum Verschieben"
      >
        <div className="flex items-center gap-2 mb-1">
          {!nurLesen && <span className="text-muted cursor-grab" aria-hidden>⠿</span>}
          <span className="font-semibold flex-1">{thema.titel || "(ohne Titel)"}</span>
          <span className="text-xs text-muted whitespace-nowrap">{thema.wochen != null ? `${thema.wochen.toLocaleString("de")} Wo.` : "? Wo."}</span>
        </div>
        {zeilen.map(n => (
          <div key={n} className={`flex gap-1 text-xs leading-snug mt-0.5 ${niveauGilt(n, klasse) ? "" : "opacity-50 line-through"}`}>
            <span className="font-mono text-[10px] text-muted w-5 shrink-0">{n}</span>
            <span className="whitespace-pre-line">{thema.inhalte[n]}</span>
          </div>
        ))}
        {thema.notiz && <div className="text-xs text-muted mt-1 italic">{thema.notiz}</div>}
        {konflikte.map((k, i) => <div key={i} className="text-xs text-bad mt-1">⚠ {k}</div>)}
        {thema.karten.length === 0 && <div className="text-xs text-muted mt-1">keine Lehrplan-Karte zugeordnet</div>}
      </div>
    );
  }
}

