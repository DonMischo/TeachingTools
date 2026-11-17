"use client";
/**
 * Workflows in Fragmente: ein Clipping mit `art = "workflow"`. Es trägt einen
 * Ablauf in Markdown (text_content) und als Bild entweder hochgeladene Bilder
 * oder ein D2-Diagramm (Quelltext in `d2`, gezeichnet wie in der
 * Diagramm-Werkstatt). Das Diagramm lässt sich per KI-Prompt aus dem Text bauen
 * oder in der Werkstatt weiterbearbeiten.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type FragmentOrt, type ResearchItemOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { MarkdownFeld } from "@/components/MarkdownFeld";
import { Markdown } from "@/lib/markdown";
import { kopiereText } from "@/lib/zwischenablage";
import { DIAGRAMM_IMPORT, KI_ARTEN, kiPrompt, type KiArt } from "@/lib/diagramm/vorlagen";
import { codeAusAntwort } from "@/lib/diagramm/hervorheben";
import { CodeFeld } from "@/components/diagramme/CodeFeld";
import { Anhaenge, GewaehlteDateien } from "./Anhaenge";
import { Verknuepfungen } from "@/components/curriculum/Verknuepfungen";
import { KlappKnopf, useKlappmodus, useRahmenKlick } from "./Aufklappen";
import { ALLGEMEIN, Einordnung, EinordnenWahl, OHNE_ORT, ortText } from "./Einordnung";

const BEISPIEL = `direction: down
start: Start { shape: oval }
schritt: Erster Schritt
ende: Fertig { shape: oval }
start -> schritt -> ende
`;

/** Großansicht für Diagramm oder Bild; Esc oder Klick daneben schließt. */
function Gross({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", zu);
    return () => document.removeEventListener("keydown", zu);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-w-[94vw] max-h-[92vh] overflow-auto rounded-lg bg-white p-3" onClick={e => e.stopPropagation()}>{children}</div>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl" onClick={onClose} aria-label="Schließen">×</button>
    </div>,
    document.body,
  );
}

/** Zeichnet D2-Code (lädt den D2-Übersetzer erst beim ersten Diagramm). */
export function D2Bild({ code, gross = false, onFehler }: { code: string; gross?: boolean; onFehler?: (f: string[]) => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string[]>([]);
  const [zoom, setZoom] = useState(false);
  const meldeFehler = useRef(onFehler);
  meldeFehler.current = onFehler;

  useEffect(() => {
    if (!code.trim()) { setSvg(null); setFehler([]); meldeFehler.current?.([]); return; }
    let aktuell = true;
    const t = setTimeout(async () => {
      try {
        const { zeichne } = await import("@/lib/diagramm/d2laufzeit");
        const r = await zeichne(code);
        if (!aktuell) return;
        setSvg(r.svg); setFehler([]); meldeFehler.current?.([]);
      } catch (e) {
        if (!aktuell) return;
        const { fehlerLesen } = await import("@/lib/diagramm/d2laufzeit");
        const f = fehlerLesen(e).map(x => (x.zeile ? `Zeile ${x.zeile}: ${x.text}` : x.text));
        setFehler(f); meldeFehler.current?.(f);
      }
    }, 400);
    return () => { aktuell = false; clearTimeout(t); };
  }, [code]);

  if (!code.trim()) return null;
  if (!svg) {
    return <p className="text-[11px] text-muted italic">{fehler.length ? `⚠ ${fehler[0]}` : "Diagramm wird gezeichnet …"}</p>;
  }
  return (
    <>
      <div className={`rounded-lg bg-white p-1 cursor-zoom-in flex justify-center [&_svg]:max-w-full [&_svg]:w-auto [&_svg]:h-auto ${
        gross ? "[&_svg]:max-h-[420px]" : "[&_svg]:max-h-72"}`}
        onClick={() => setZoom(true)} title="Groß anzeigen" data-testid="d2-bild"
        dangerouslySetInnerHTML={{ __html: svg }} />
      {fehler.length > 0 && <p className="text-[11px] text-red-500">⚠ {fehler[0]} (zeigt den letzten gültigen Stand)</p>}
      {zoom && (
        <Gross onClose={() => setZoom(false)}>
          {/* D2-SVGs tragen nur eine viewBox — feste Maße, sonst schrumpft das Bild auf ein Quadrat */}
          <div className="[&>svg]:block [&>svg]:w-[88vw] [&>svg]:h-[84vh]" dangerouslySetInnerHTML={{ __html: svg.replace('preserveAspectRatio="xMinYMin meet"', 'preserveAspectRatio="xMidYMid meet"') }} />
        </Gross>
      )}
    </>
  );
}

/** Prompt für einen KI-Chat: D2-Diagramm aus dem Text des Workflows. */
function KiAusText({ titel, text, d2 }: { titel: string; text: string; d2: string }) {
  const [art, setArt] = useState<KiArt>("ablauf");
  const [mitschicken, setMitschicken] = useState(false);
  const [status, setStatus] = useState("");
  const prompt = kiPrompt({ art, thema: titel, text, bisher: mitschicken ? d2 : undefined });
  const feld = useRef<HTMLTextAreaElement>(null);
  const kopieren = async () => {
    if (await kopiereText(prompt)) setStatus("✓ Kopiert — im KI-Chat einfügen, die Antwort dann oben ins Code-Feld.");
    else { feld.current?.select(); setStatus("Markiert — jetzt Strg+C drücken."); }
  };
  return (
    <div className="flex flex-col gap-2 pt-2 text-xs">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(KI_ARTEN) as KiArt[]).map(a => (
          <button key={a} type="button" onClick={() => setArt(a)} className={`chip text-xs ${art === a ? "chip-on" : ""}`}>{KI_ARTEN[a].name}</button>
        ))}
      </div>
      {d2.trim() && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mitschicken} onChange={e => setMitschicken(e.target.checked)} />
          Bisheriges Diagramm mitschicken (die KI baut darauf auf)
        </label>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className="btn-primary text-xs px-3 py-1" onClick={kopieren} disabled={!text.trim() && !titel.trim()}>
          🤖 Prompt kopieren
        </button>
        <span className="text-muted">{status || (!text.trim() && !titel.trim() ? "Erst Titel oder Ablauf schreiben." : "")}</span>
      </div>
      <textarea ref={feld} readOnly value={prompt} aria-label="Prompt für die KI" className="input h-28 font-mono text-[11px]" />
    </div>
  );
}

export function WorkflowModal({ collectionId, initial, tab, guestToken, onClose }: {
  collectionId: number;
  initial: ResearchItemOut | null;
  tab: string;
  guestToken?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { vorgabe } = useContext(Einordnung);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState(initial?.text_content ?? "");
  const [kat, setKat] = useState(initial?.tab ?? tab);
  const [ort, setOrt] = useState<FragmentOrt>(initial ? { klasse: initial.klasse, einheit: initial.einheit } : kat === ALLGEMEIN ? OHNE_ORT : vorgabe);
  const hatBilder = (initial?.media ?? []).some(m => m.kind === "image");
  const [bild, setBild] = useState<"d2" | "bild">(initial && !initial.d2 && hatBilder ? "bild" : "d2");
  // Neue Workflows starten mit dem Beispiel-Ablauf, bestehende mit ihrem Code
  const [d2, setD2] = useState(initial ? initial.d2 ?? "" : BEISPIEL);
  const [fehler, setFehler] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  // Material und Anhänge — unabhängig vom Bild
  const [links, setLinks] = useState(initial?.links ?? []);
  const [dokumente, setDokumente] = useState<File[]>([]);

  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", zu);
    return () => document.removeEventListener("keydown", zu);
  }, [onClose]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim() || null, text_content: text.trim() || null, tab: kat, ...ort,
        d2: bild === "d2" && d2.trim() ? d2 : null,
        ...(guestToken ? {} : { links: links.length ? links : null }),
      };
      const item = initial
        ? await api.fragments.updateResearch(initial.id, payload)
        : await api.fragments.createResearch(collectionId, { ...payload, art: "workflow" }, guestToken);
      if (bild === "bild") for (const f of files) await api.fragments.uploadMedia(item.id, f, guestToken);
      for (const f of dokumente) await api.fragments.uploadMedia(item.id, f, guestToken);
      return item;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["research", collectionId] }); toast("Gespeichert", "success"); onClose(); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const inWerkstatt = () => {
    try {
      localStorage.setItem(DIAGRAMM_IMPORT, JSON.stringify({ name: title.trim() || "Workflow", code: d2.trim() ? d2 : BEISPIEL }));
      window.open("/simulationen/diagramme", "_blank");
    } catch { /* ohne Speicher */ }
  };

  const fehlerZeilen = new Set(fehler.flatMap(f => { const m = /^Zeile (\d+)/.exec(f); return m ? [Number(m[1])] : []; }));
  const canSave = !save.isPending && (!!title.trim() || !!text.trim() || (!!d2.trim() && d2 !== BEISPIEL) || files.length > 0 || dokumente.length > 0 || links.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-line p-6 shadow-2xl"
        style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()} role="dialog" aria-label="Workflow">
        <h2 className="text-lg font-semibold mb-4">🔀 {initial ? "Workflow bearbeiten" : "Neuer Workflow"}</h2>
        <div className="space-y-4">
          <div><label className="label" htmlFor="wf-titel">Titel</label>
            <input id="wf-titel" className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="z. B. Versuchsprotokoll schreiben" /></div>
          <EinordnenWahl tab={kat} ort={ort} onChange={(t, o) => { setKat(t); setOrt(o); }} className="input" />

          <div>
            <span className="label">Ablauf</span>
            <MarkdownFeld id="wf-text" label="Ablauf (Markdown)" wert={text} onChange={setText} />
            <p className="text-[10px] text-muted mt-0.5">Tippen formatiert sofort: »## « Überschrift · »1. « Schritt · »- « Punkt · »[ ] « Aufgabe · **fett** · *kursiv*</p>
          </div>

          <div>
            <span className="label">Bild</span>
            <div className="flex gap-1 mb-2" role="group" aria-label="Art des Bildes">
              <button type="button" className={`chip text-xs ${bild === "d2" ? "chip-on" : ""}`} onClick={() => setBild("d2")}>🔀 D2-Diagramm</button>
              <button type="button" className={`chip text-xs ${bild === "bild" ? "chip-on" : ""}`} onClick={() => setBild("bild")}>🖼️ Bild hochladen</button>
            </div>
            {bild === "d2" ? (
              <div className="flex flex-col gap-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <CodeFeld code={d2} fehlerZeilen={fehlerZeilen}
                    setze={c => setD2(c.includes("```") ? codeAusAntwort(c) : c)} />
                  <div className="min-w-0">
                    {d2.trim()
                      ? <D2Bild code={d2} gross onFehler={setFehler} />
                      : <button type="button" className="text-xs text-muted hover:text-fg underline" onClick={() => setD2(BEISPIEL)}>Mit einem Beispiel anfangen</button>}
                  </div>
                </div>
                <details className="rounded-lg border border-line px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">🤖 Diagramm mit KI aus dem Text erstellen</summary>
                  <KiAusText titel={title} text={text} d2={d2} />
                </details>
                {!guestToken && (
                  <button type="button" className="self-start text-xs text-muted hover:text-fg" onClick={inWerkstatt}
                    title="Öffnet das Diagramm in einem neuen Tab. Den fertigen Code dort kopieren und hier einfügen.">
                    🔀 In der Diagramm-Werkstatt bearbeiten ↗
                  </button>
                )}
              </div>
            ) : (
              <div>
                <input type="file" multiple accept="image/*" aria-label="Bilder" className="w-full"
                  onChange={e => { const neu = Array.from(e.target.files ?? []); setFiles(f => [...f, ...neu]); e.target.value = ""; }} />
                <GewaehlteDateien dateien={files} onEntfernen={i => setFiles(f => f.filter((_, j) => j !== i))} />
                {hatBilder && <p className="text-[10px] text-muted mt-1">Vorhandene Bilder entfernst du auf der Karte (×).</p>}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {!guestToken && (
            <div>
              <span className="label">📎 Material</span>
              <p className="text-[10px] text-muted mb-1">Simulationen, Werkzeuge, andere Fragmente oder Links, die zum Ablauf gehören.</p>
              <Verknuepfungen links={links} onChange={setLinks} />
            </div>
          )}
          <div>
            <span className="label">Anhänge (PDF, Dokumente)</span>
            {initial && <Anhaenge media={initial.media} onPdf={p => window.open(p, "_blank")} />}
            <input type="file" multiple aria-label="Anhänge wählen" className="w-full mt-1"
              accept="application/pdf,.txt,.md,.csv,.rtf,.tex,.doc,.docx,.odt,.ott,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.odg"
              onChange={e => { const neu = Array.from(e.target.files ?? []); setDokumente(f => [...f, ...neu]); e.target.value = ""; }} />
            <GewaehlteDateien dateien={dokumente} onEntfernen={i => setDokumente(f => f.filter((_, j) => j !== i))} />
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface-hover" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary px-4 py-2 text-sm" disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkflowCard({ item, onEdit }: { item: ResearchItemOut; onEdit: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { kategorien } = useContext(Einordnung);
  const [voll, setVoll] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [bildGross, setBildGross] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["research", item.collection_id] });
  const del = useMutation({ mutationFn: () => api.fragments.deleteResearch(item.id), onSuccess: invalidate,
    onError: (e: any) => toast(e.message ?? "Fehler", "error") });
  const delMedia = useMutation({ mutationFn: (mid: number) => api.fragments.deleteMedia(mid), onSuccess: invalidate });
  const bilder = item.media.filter(m => m.kind === "image");
  const klapp = useKlappmodus(`r${item.id}`);
  const rahmenKlick = useRahmenKlick(`r${item.id}`);
  const lang = (item.text_content ?? "").split("\n").length > 8;

  return (
    <div className="group rounded-xl border border-line bg-page p-3 flex flex-col gap-2" data-art="workflow" onClick={rahmenKlick}>
      <div className="flex items-start justify-between gap-2">
        <KlappKnopf id={`r${item.id}`} />
        <button className="flex-1 text-sm font-semibold text-left line-clamp-2 hover:text-accent" onClick={onEdit}>
          🔀 {item.title || "Workflow"}
        </button>
        {item.can_edit && (
          <button className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 text-xs transition-opacity"
            onClick={() => setLoeschen(true)} title="Löschen">×</button>
        )}
      </div>
      {loeschen && (
        <div className="text-xs rounded border border-red-500/40 p-2 flex items-center gap-2">
          <span className="flex-1">Workflow und Bilder löschen?</span>
          <button className="text-red-500 font-medium" onClick={() => del.mutate()}>Löschen</button>
          <button className="text-muted" onClick={() => setLoeschen(false)}>Abbrechen</button>
        </div>
      )}
      {klapp !== "zu" && <>
      {item.d2 && <D2Bild code={item.d2} />}
      {!item.d2 && bilder.map(m => (
        <div key={m.id} className="relative rounded-lg overflow-hidden bg-surface-hover">
          <img src={m.path} alt="" className="w-full h-auto cursor-zoom-in" onClick={() => setBildGross(m.path)} />
          {item.can_edit && (
            <button className="absolute top-1 right-1 bg-black/60 text-white rounded-sm px-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-600/80"
              onClick={() => delMedia.mutate(m.id)} title="Bild entfernen">×</button>
          )}
        </div>
      ))}
      {bildGross && <Gross onClose={() => setBildGross(null)}><img src={bildGross} alt="" className="max-w-[90vw] max-h-[85vh]" /></Gross>}
      {item.text_content && (
        <div className="text-xs">
          <div className={voll || !lang || klapp === "auf" ? "" : "max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"}>
            <Markdown text={item.text_content} />
          </div>
          {lang && klapp !== "auf" && <button className="text-[10px] text-muted hover:text-fg mt-1" onClick={() => setVoll(v => !v)}>{voll ? "▴ weniger" : "▾ ganzer Ablauf"}</button>}
        </div>
      )}
      {!!item.links?.length && <Verknuepfungen links={item.links} klein />}
      <Anhaenge media={item.media} onPdf={p => window.open(p, "_blank")}
        onLoeschen={item.can_edit ? id => delMedia.mutate(id) : undefined} />
      {ortText(kategorien, item) && <div className="text-[10px] text-muted">📍 {ortText(kategorien, item)}</div>}
      {item.author_name && <span className="text-[10px] text-muted truncate mt-auto">{item.author_name}</span>}
      </>}
    </div>
  );
}
