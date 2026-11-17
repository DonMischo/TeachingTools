"use client";

import { SimFelder, type Katalog } from "@/components/vorlagen/SimFelder";
import { SimKnopf } from "@/components/exitgame/SimStation";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, fragmentGuest, FragmentCollectionOut, FragmentOut, FragmentTabs,
  ResearchItemOut, FragmentOrt, ExitGameSim,
} from "@/lib/api";
import { ALLGEMEIN, Einordnung, EinordnenWahl, OHNE_ORT, ortText, tabName } from "@/components/fragmente/Einordnung";
import { WorkflowCard, WorkflowModal } from "@/components/fragmente/Workflow";
import { Anhaenge, GewaehlteDateien, titelAusDatei } from "@/components/fragmente/Anhaenge";
import { Aufklappen, KlappKnopf, useAufklappen, useKlappmodus, useRahmenKlick } from "@/components/fragmente/Aufklappen";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { JoinQR } from "@/components/JoinQR";
import { useLanUrl } from "@/hooks/useLanUrl";
import { CollectionModal } from "@/components/fragmente/CollectionSettingsDialog";


// ── Small reusable dialogs ────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-line p-5 shadow-2xl"
        style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title, message, confirmLabel = "Löschen", onConfirm, onClose,
}: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-muted mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface-hover" onClick={onClose}>Abbrechen</button>
        <button className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-semibold hover:opacity-90"
          onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

function AddTabDialog({ existing, onAdd, onClose }: { existing: string[]; onAdd: (n: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const dupe = existing.some(t => t.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !dupe;
  return (
    <Modal title="Neuer Tab" onClose={onClose}>
      <label className="label">Name</label>
      <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="z. B. Quellen" maxLength={50}
        onKeyDown={e => { if (e.key === "Enter" && valid) { onAdd(trimmed); onClose(); } }} />
      {dupe && <p className="text-xs text-red-500 mt-1">Dieser Tab existiert bereits.</p>}
      <p className="text-[11px] text-muted mt-2">Neue Tabs erscheinen vor „Archiv".</p>
      <div className="flex justify-end gap-2 mt-5">
        <button className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface-hover" onClick={onClose}>Abbrechen</button>
        <button className="btn-primary px-4 py-2 text-sm"
          disabled={!valid} onClick={() => { onAdd(trimmed); onClose(); }}>Hinzufügen</button>
      </div>
    </Modal>
  );
}

// ── Notepad++-style tab bar: fixed height (no scrollbar), scroll arrows + a
// dropdown listing every tab, so a long tab list stays navigable. ──────────────
function TabBar({
  tabs, active, onSelect, onAdd, canManage,
}: {
  tabs: string[];
  active: string;
  onSelect: (t: string) => void;
  onAdd?: () => void;
  canManage: boolean;
}) {
  const { art } = useContext(Einordnung);
  const tabLabel = (t: string) => tabName(t, art);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollByPx = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  const selectAndReveal = (t: string) => {
    onSelect(t);
    setMenuOpen(false);
    requestAnimationFrame(() =>
      scrollRef.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(t)}"]`)
        ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }));
  };

  return (
    <div className="flex items-stretch h-12 border-b border-line mb-4 select-none">
      <button className="px-1.5 text-muted hover:text-fg shrink-0" onClick={() => scrollByPx(-180)} title="Zurück">‹</button>
      {/* overflow-hidden on BOTH axes: setting only overflow-x:hidden makes the
          browser compute overflow-y as auto, which adds a stray vertical scrollbar.
          Scrolling still works here because it is driven programmatically. */}
      <div ref={scrollRef} className="flex-1 flex items-stretch overflow-hidden">
        {tabs.map(t => (
          <button key={t} data-tab={t}
            className={`px-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0 ${
              active === t ? "border-accent text-fg font-semibold" : "border-transparent text-muted hover:text-fg"}`}
            onClick={() => onSelect(t)}>
            {tabLabel(t)}
          </button>
        ))}
      </div>
      <button className="px-1.5 text-muted hover:text-fg shrink-0" onClick={() => scrollByPx(180)} title="Weiter">›</button>
      <div className="relative shrink-0">
        <button className="px-1.5 h-full text-muted hover:text-fg" onClick={() => setMenuOpen(v => !v)} title="Alle Tabs">▾</button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-page shadow-xl py-1 min-w-[160px]">
              {tabs.map(t => (
                <button key={t} onClick={() => selectAndReveal(t)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover ${active === t ? "text-accent font-semibold" : "text-fg"}`}>
                  {tabLabel(t)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {canManage && onAdd && (
        <button className="px-2 shrink-0 text-muted hover:text-accent" onClick={onAdd} title="Tab hinzufügen">＋</button>
      )}
    </div>
  );
}

// ── Fragment card (text, inline autosave) ─────────────────────────────────────

function FragmentCard({
  frag, layout = "grid", canReorder = false, onDragStartCard, onDropCard,
}: {
  frag: FragmentOut;
  layout?: "grid" | "list";
  canReorder?: boolean;
  onDragStartCard?: () => void;
  onDropCard?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(frag.title ?? "");
  const [content, setContent] = useState(frag.content ?? "");
  const [category, setCategory] = useState(frag.category ?? "");
  const [editingCat, setEditingCat] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editable = frag.can_edit;

  const { kategorien } = useContext(Einordnung);
  const klapp = useKlappmodus(`f${frag.id}`);
  const rahmenKlick = useRahmenKlick(`f${frag.id}`);
  const save = (patch: Partial<{ tab: string; title: string | null; content: string | null; category: string | null } & FragmentOrt>) =>
    api.fragments.updateFragment(frag.id, patch).catch((e: any) => toast(e.message ?? "Fehler", "error"));

  const scheduleSave = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ content: next }), 700);
  };

  const del = useMutation({
    mutationFn: () => api.fragments.deleteFragment(frag.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fragments", frag.collection_id] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  return (
    <div
      className={`group relative rounded-xl border border-line bg-page p-3 flex flex-col ${
        klapp === "normal" ? (layout === "list" ? "h-32" : "h-52") : ""}`}
      onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
      onDrop={canReorder ? () => onDropCard?.() : undefined}
      onClick={rahmenKlick}
    >
      {canReorder && (
        <span
          draggable
          onDragStart={onDragStartCard}
          className="absolute top-1 right-1.5 cursor-grab select-none text-muted opacity-0 group-hover:opacity-100 transition-opacity"
          title="Ziehen zum Sortieren"
        >⠿</span>
      )}
      <div className="flex items-center gap-1 mb-1 pr-5">
        <KlappKnopf id={`f${frag.id}`} />
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-hidden disabled:opacity-100"
          value={title}
          disabled={!editable}
          placeholder={klapp === "zu" && !title ? (content.split("\n")[0] || "Titel…") : "Titel…"}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => title !== (frag.title ?? "") && save({ title: title.trim() || null })}
        />
      </div>
      {klapp !== "zu" && <>
      <textarea
        className={`flex-1 resize-none bg-transparent text-sm outline-hidden text-fg placeholder:text-muted ${
          klapp === "auf" ? "field-sizing-content min-h-16" : ""}`}
        value={content}
        disabled={!editable}
        placeholder={editable ? "Text…" : ""}
        onChange={e => { setContent(e.target.value); scheduleSave(e.target.value); }}
        onBlur={() => { if (timer.current) clearTimeout(timer.current); if (content !== (frag.content ?? "")) save({ content }); }}
      />
      <div className="flex items-center justify-between text-[10px] text-muted pt-1 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {editingCat ? (
            <input autoFocus value={category} onChange={e => setCategory(e.target.value)}
              onBlur={() => { setEditingCat(false); if (category !== (frag.category ?? "")) save({ category: category.trim() || null }); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
              placeholder="Label…" className="bg-surface-hover rounded-sm px-1.5 py-0.5 outline-hidden w-20 text-[10px]" />
          ) : category ? (
            <button className="bg-accent/15 text-accent px-1.5 py-0.5 rounded-full"
              onClick={() => editable && setEditingCat(true)}>{category}</button>
          ) : editable ? (
            <button className="opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity"
              onClick={() => setEditingCat(true)}>+ Label</button>
          ) : null}
          {editable
            ? <EinordnenWahl tab={frag.tab} ort={frag}
                onChange={(tab, o) => save({ tab, ...o }).then(() => qc.invalidateQueries({ queryKey: ["fragments", frag.collection_id] }))}
                className="bg-transparent text-[10px] max-w-[9rem] truncate" />
            : ortText(kategorien, frag) && <span className="truncate">{ortText(kategorien, frag)}</span>}
          <span className="truncate">{frag.author_name ?? ""}</span>
        </div>
        {editable && (
          <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity shrink-0"
            onClick={() => setConfirmDel(true)} title="Löschen">Löschen</button>
        )}
      </div>
      </>}
      {confirmDel && (
        <ConfirmDialog
          title="Karte löschen?"
          message={`„${(title || content || "Diese Karte").slice(0, 60)}" wird dauerhaft gelöscht.`}
          onConfirm={() => del.mutate()}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}

// ── Clipping (research) modal ─────────────────────────────────────────────────

function ClippingModal({
  collectionId, initial, tab, guestToken, onClose, dateien,
}: {
  collectionId: number;
  initial: ResearchItemOut | null;
  tab: string;
  guestToken?: string;
  onClose: () => void;
  /** per Drag & Drop abgelegte Dateien: vorausgewählt, Titel aus dem ersten Namen */
  dateien?: File[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? (dateien?.[0] ? titelAusDatei(dateien[0].name) : ""));
  const [url, setUrl] = useState(initial?.url ?? "");
  const [text, setText] = useState(initial?.text_content ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const { vorgabe } = useContext(Einordnung);
  const [kat, setKat] = useState(initial?.tab ?? tab);
  const [ort, setOrt] = useState<FragmentOrt>(initial ? { klasse: initial.klasse, einheit: initial.einheit } : kat === ALLGEMEIN ? OHNE_ORT : vorgabe);
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState<File[]>(dateien ?? []);
  const [sim, setSim] = useState<ExitGameSim | null>(initial?.sim ?? null);
  // Werkzeug-Liste mit Einstellungen wie im TaskCrawler (Gäste wählen keine Werkzeuge)
  const { data: katalog } = useQuery<Katalog>({
    queryKey: ["exitgame-katalog"], queryFn: api.exitgame.katalog, staleTime: Infinity, enabled: !guestToken,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["research", collectionId] });

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title: title.trim() || null, url: url.trim() || null, text_content: text.trim() || null, tags, tab: kat, ...ort, ...(guestToken ? {} : { sim }) };
      const item = isEdit
        ? await api.fragments.updateResearch(initial!.id, payload)
        : await api.fragments.createResearch(collectionId, payload, guestToken);
      for (const f of files) await api.fragments.uploadMedia(item.id, f, guestToken);
      return item;
    },
    onSuccess: () => { invalidate(); toast("Gespeichert", "success"); onClose(); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const canSave = !save.isPending && (!!title.trim() || !!url.trim() || !!text.trim() || !!sim || files.length > 0 || (initial?.media.length ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-line p-6 shadow-2xl"
        style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{isEdit ? "Clipping bearbeiten" : "Neues Clipping"}</h2>
        <div className="space-y-3">
          <div><label className="label">Titel</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel (optional)" /></div>
          {!guestToken && (
            <div>
              <label className="label">URL</label>
              <input className="input" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
              <p className="text-[10px] text-muted mt-0.5">Titel & Vorschau werden automatisch geladen.</p>
            </div>
          )}
          <EinordnenWahl tab={kat} ort={ort} onChange={(t, o) => { setKat(t); setOrt(o); }} className="input" />
          <div><label className="label">Text</label><textarea className="input min-h-[80px] resize-y" value={text} onChange={e => setText(e.target.value)} placeholder="Zitat, Notiz…" /></div>
          <div>
            <label className="label">Tags</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Tag…" />
              <button className="px-3 rounded-lg border border-line text-sm" onClick={addTag} type="button">+</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map(t => (
                  <span key={t} className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full flex items-center gap-1">
                    {t}<button onClick={() => setTags(tags.filter(x => x !== t))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">Bilder / PDFs / Dokumente</label>
            {initial && <Anhaenge media={initial.media} onPdf={p => window.open(p, "_blank")} />}
            <input type="file" multiple accept={`image/*,application/pdf,${DOKUMENTE}`} aria-label="Dateien wählen"
              onChange={e => { const neu = Array.from(e.target.files ?? []); setFiles(f => [...f, ...neu]); e.target.value = ""; }}
              className={`w-full ${initial?.media.length ? "mt-2" : ""}`} />
            <GewaehlteDateien dateien={files} onEntfernen={i => setFiles(f => f.filter((_, j) => j !== i))} />
          </div>
          {katalog && <SimFelder sim={sim ?? undefined} katalog={katalog} onChange={s => setSim(s ?? null)} />}
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface-hover" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary px-4 py-2 text-sm"
            disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Textdokumente, die ein Clipping als Datei anhängen kann (wie _MEDIA_DOC_EXT im Backend)
const DOKUMENTE = ".txt,.md,.csv,.rtf,.tex,.doc,.docx,.odt,.ott,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.odg";

// ── Clipping card ─────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <img src={src} alt="" className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
      <button className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl" onClick={onClose}>×</button>
    </div>
  );
}

function PdfModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative bg-page rounded-lg shadow-2xl w-[min(92vw,900px)] h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-3 p-2 border-b border-line">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-fg">In neuem Tab ↗</a>
          <button className="text-muted hover:text-fg text-lg leading-none" onClick={onClose}>×</button>
        </div>
        <iframe src={url} className="flex-1 w-full rounded-b-lg" title="PDF" />
      </div>
    </div>
  );
}

function ClippingCard({ item, onEdit }: { item: ResearchItemOut; onEdit: () => void }) {
  const qc = useQueryClient();
  const { kategorien } = useContext(Einordnung);
  const { toast } = useToast();
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["research", item.collection_id] });
  const del = useMutation({
    mutationFn: () => api.fragments.deleteResearch(item.id),
    onSuccess: invalidate,
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const delMedia = useMutation({
    mutationFn: (mid: number) => api.fragments.deleteMedia(mid),
    onSuccess: invalidate,
  });
  const addMedia = useMutation({
    mutationFn: (file: File) => api.fragments.uploadMedia(item.id, file),
    onSuccess: invalidate,
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const displayTitle = item.title || item.url_title || item.url || "Ohne Titel";
  const klapp = useKlappmodus(`r${item.id}`);
  const rahmenKlick = useRahmenKlick(`r${item.id}`);
  const images = item.media.filter(m => m.kind === "image");
  const gallery = images.length > 0
    ? images
    : (item.url_image ? [{ id: -1, kind: "image" as const, path: item.url_image, order_index: 0 }] : []);
  const safeIdx = Math.min(activeIdx, Math.max(0, gallery.length - 1));
  const active = gallery[safeIdx];

  const pickFile = (accept: string) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept; input.multiple = true;
    input.onchange = () => Array.from(input.files ?? []).forEach(f => addMedia.mutate(f));
    input.click();
  };

  return (
    <div className="group rounded-xl border border-line bg-page p-3 flex flex-col gap-2" onClick={rahmenKlick}>
      {klapp !== "zu" && active && (
        <div className="relative rounded-lg overflow-hidden bg-surface-hover aspect-4/3">
          <img src={active.path} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setLightbox(true)} />
          {gallery.length > 1 && (
            <>
              <button className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-sm px-1.5 opacity-0 group-hover:opacity-100 disabled:opacity-0"
                onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={safeIdx === 0}>‹</button>
              <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-sm px-1.5 opacity-0 group-hover:opacity-100 disabled:opacity-0"
                onClick={() => setActiveIdx(i => Math.min(gallery.length - 1, i + 1))} disabled={safeIdx === gallery.length - 1}>›</button>
              <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
                {gallery.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === safeIdx ? "w-3 bg-white" : "w-1.5 bg-white/50"}`} />)}
              </div>
            </>
          )}
          {item.can_edit && active.id >= 0 && (
            <button className="absolute top-1 right-1 bg-black/60 text-white rounded-sm px-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-600/80"
              onClick={() => delMedia.mutate(active.id)} title="Bild entfernen">×</button>
          )}
        </div>
      )}
      {lightbox && active && <Lightbox src={active.path} onClose={() => setLightbox(false)} />}
      {pdfUrl && <PdfModal url={pdfUrl} onClose={() => setPdfUrl(null)} />}
      {confirmDel && (
        <ConfirmDialog title="Clipping löschen?"
          message={`„${displayTitle.slice(0, 60)}" und alle Anhänge werden dauerhaft gelöscht.`}
          onConfirm={() => del.mutate()} onClose={() => setConfirmDel(false)} />
      )}
      <div className="flex items-start justify-between gap-2">
        <KlappKnopf id={`r${item.id}`} />
        <button className="flex-1 text-sm font-semibold text-left line-clamp-2 hover:text-accent" onClick={onEdit}>{displayTitle}</button>
        {klapp === "zu" && item.media.length > 0 && <span className="text-[10px] text-muted shrink-0" title="Anhänge">📎{item.media.length}</span>}
        {item.can_edit && (
          <button className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 text-xs transition-opacity"
            onClick={() => setConfirmDel(true)} title="Löschen">×</button>
        )}
      </div>
      {klapp !== "zu" && <>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent truncate hover:underline">{item.url}</a>
      )}
      {item.text_content && <p className={`text-xs text-muted border-l-2 border-line pl-2 italic whitespace-pre-line ${klapp === "auf" ? "" : "line-clamp-4"}`}>{item.text_content}</p>}

      {/* PDFs und Dokumente */}
      <Anhaenge media={item.media} onPdf={setPdfUrl} onLoeschen={item.can_edit ? id => delMedia.mutate(id) : undefined} />
      {item.sim && <SimKnopf sim={item.sim} zurueck="✕ Schließen" />}
      {ortText(kategorien, item) && <div className="text-[10px] text-muted">📍 {ortText(kategorien, item)}</div>}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map(t => <span key={t} className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">{t}</span>)}
        </div>
      )}
      <div className="flex items-center justify-between mt-auto pt-1">
        {item.author_name ? <span className="text-[10px] text-muted truncate">{item.author_name}</span> : <span />}
        {item.can_edit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="text-[10px] text-muted hover:text-accent" onClick={() => pickFile("image/*")} title="Bild anhängen">+ Bild</button>
            <button className="text-[10px] text-muted hover:text-accent" onClick={() => pickFile("application/pdf")} title="PDF anhängen">+ PDF</button>
            <button className="text-[10px] text-muted hover:text-accent" onClick={() => pickFile(DOKUMENTE)} title="Textdokument anhängen (md, txt, docx, odt …)">+ Datei</button>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

// ── Board page ────────────────────────────────────────────────────────────────

export default function FragmentBoardPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth, ready: authReady } = useAuth();
  const collectionId = Number(params.id);
  // Guest mode: no logged-in user, but a collection-scoped guest token from a QR/link join.
  const guestToken = auth ? undefined : fragmentGuest.get(collectionId);

  // Verknüpfung aus Stundenplaner/Curriculinator: ?tab=…&eintrag=f12 | r7 öffnet den Tab
  // und hebt den Eintrag hervor.
  const suche = useSearchParams();
  const eintrag = suche.get("eintrag");
  const [activeTab, setActiveTab] = useState<string>(suche.get("tab") || "snippets");
  const gesprungen = useRef(false);
  useEffect(() => {
    if (!eintrag || gesprungen.current) return;
    const el = document.querySelector(`[data-eintrag="${eintrag}"]`);
    if (el) { el.scrollIntoView({ block: "center" }); gesprungen.current = true; }
  });
  const [clippingModal, setClippingModal] = useState<null | { item: ResearchItemOut | null; tab?: string; workflow?: boolean; dateien?: File[] }>(null);
  // Dateien aus dem Explorer auf die Pinnwand ziehen → neues Clipping (wie bei Google Drive)
  const [ziehtDateien, setZiehtDateien] = useState(false);
  const istDateiZug = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  // Clipping oder Workflow — beide sind Einträge der Recherche-Liste
  const eintragKarte = (item: ResearchItemOut) => item.art === "workflow"
    ? <WorkflowCard key={`r${item.id}`} item={item} onEdit={() => item.can_edit && setClippingModal({ item })} />
    : <ClippingCard key={`r${item.id}`} item={item} onEdit={() => item.can_edit && setClippingModal({ item })} />;
  const [view, setView] = useState<"grid" | "list" | "columns">("grid");
  const [dragId, setDragId] = useState<number | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const klappen = useAufklappen();
  // Filter nach Klasse / Unterrichtseinheit (nur bei Sammlungen mit Kategorien)
  const [ortFilter, setOrtFilter] = useState<FragmentOrt>({ klasse: null, einheit: null });
  const [addTabOpen, setAddTabOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selectTab = (t: string) => { setActiveTab(t); setTagFilter(null); };

  const { data: collection, isError } = useQuery<FragmentCollectionOut>({
    queryKey: ["fragment-collection", collectionId],
    queryFn: () => api.fragments.getCollection(collectionId, guestToken),
    // 401/403 heilt kein Wiederholen — ohne dies stand das leere Brett
    // sekundenlang da, bevor die Sperre erschien.
    retry: false,
    // Erst laden, wenn feststeht, ob jemand angemeldet ist: sonst fragt ein
    // Gast mit gültigem Token die Sammlung ohne Token ab.
    enabled: authReady,
  });
  const { data: tabs } = useQuery<FragmentTabs>({
    queryKey: ["fragment-tabs", collectionId],
    queryFn: () => api.fragments.getTabs(collectionId, guestToken),
    enabled: !!collection,
  });
  const { data: fragments = [] } = useQuery<FragmentOut[]>({
    queryKey: ["fragments", collectionId],
    queryFn: () => api.fragments.listFragments(collectionId, undefined, guestToken),
    enabled: !!collection,
    // Was andere anlegen, erscheint ohne Neuladen
    refetchInterval: 5000,
  });
  const { data: research = [] } = useQuery<ResearchItemOut[]>({
    queryKey: ["research", collectionId],
    queryFn: () => api.fragments.listResearch(collectionId, guestToken),
    enabled: !!collection,
    refetchInterval: 5000,
  });

  // Join URL uses the host's LAN IP (not localhost) so scanned QR codes work on
  // student devices. Hook must run before the early return below.
  const guestUrlRaw = useLanUrl(collection?.guest_code ? `/fragmente/join?code=${collection.guest_code}` : "");
  const guestUrl = collection?.guest_code ? guestUrlRaw : null;
  // Direct link to this board. Not a credential: opening it still requires a
  // login and the collection's own permissions, so it is only a shortcut.
  const directUrl = useLanUrl(`/fragmente/${collectionId}`);

  const perm = collection?.my_permission ?? "none";
  const canContribute = perm === "contribute" || perm === "manage";
  const canManage = perm === "manage";

  const allTabs = useMemo(() => tabs?.all ?? ["snippets", "archive"], [tabs]);
  // Fall back an orphaned card (tab no longer exists) into the first tab.
  const effTab = (t: string) => (allTabs.includes(t) ? t : allTabs[0]);

  const addFragment = useMutation({
    mutationFn: (tab: string) => api.fragments.createFragment(collectionId, { tab, content: "", ...(tab === ALLGEMEIN ? {} : ortFilter) }, guestToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fragments", collectionId] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const importFrag = useMutation({
    mutationFn: (files: File[]) => api.fragments.importFragments(collectionId, files),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["fragments", collectionId] }); toast(`${res.created} importiert${res.skipped ? `, ${res.skipped} übersprungen` : ""}`, "success"); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const pickImport = () => {
    const i = document.createElement("input");
    i.type = "file"; i.multiple = true; i.accept = ".md,.markdown,.txt";
    i.onchange = () => { const fs = Array.from(i.files ?? []); if (fs.length) importFrag.mutate(fs); };
    i.click();
  };

  const addTab = useMutation({
    mutationFn: (name: string) => api.fragments.setTabs(collectionId, [...(tabs?.custom ?? []), name]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fragment-tabs", collectionId] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  // Der Direktlink auf ein Brett ist kein Zugang: wer nicht angemeldet ist und
  // kein (noch gültiges) Gast-Token für diese Sammlung hat, landet hier. Statt
  // einer Sackgasse führt der Weg zurück zum Beitritt per Code.
  if (isError) {
    return auth ? (
      <div className="mx-auto max-w-md p-6 mt-10 text-center">
        <div className="rounded-2xl border border-line p-6" style={{ background: "var(--bg)" }}>
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-lg font-bold">Keine Berechtigung</h1>
          <p className="text-sm text-muted mt-2">
            Diese Pinnwand ist nicht für dich freigegeben.
          </p>
          <button className="btn-primary mt-5 w-full" onClick={() => router.push("/fragmente")}>Zu den Sammlungen</button>
        </div>
      </div>
    ) : (
      <div className="mx-auto max-w-md p-6 mt-10 text-center">
        <div className="rounded-2xl border border-line p-6" style={{ background: "var(--bg)" }}>
          <div className="text-4xl mb-2">🗂️</div>
          <h1 className="text-lg font-bold">Diese Pinnwand ist nicht öffentlich</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Der Link allein reicht nicht. Als Gast kommst du mit dem Beitritts-Code
            deiner Lehrkraft herein — oder du meldest dich links unten an.
          </p>
          <button className="btn-primary mt-5 w-full" onClick={() => router.push("/fragmente/join")}>Mit Code beitreten</button>
        </div>
      </div>
    );
  }

  // Bis die Sammlung da ist, kein leeres Brett zeigen — das sah aus wie eine
  // Pinnwand ohne Inhalt.
  if (!collection) {
    return <div className="mx-auto max-w-md p-6 mt-10 text-center text-sm text-muted">Einen Moment …</div>;
  }

  const markiert = (id: string, karte: React.ReactNode) =>
    id === eintrag ? <div key={id} data-eintrag={id} className="rounded-xl ring-2 ring-accent">{karte}</div> : karte;

  const kategorien = collection.kategorien ?? [];
  const tabLabel = (t: string) => tabName(t, collection.art);
  // Allgemein hat keine Aufteilung — der Klassen-/Einheitenfilter lässt es aus.
  const passtOrt = (e: FragmentOrt & { tab: string }) => effTab(e.tab) === ALLGEMEIN ||
    (ortFilter.klasse == null || e.klasse === ortFilter.klasse) && (ortFilter.einheit == null || e.einheit === ortFilter.einheit);
  const ortFrags = fragments.filter(passtOrt);
  const ortRes = research.filter(passtOrt);
  const tabFragments = ortFrags.filter(f => effTab(f.tab) === activeTab);
  const tabResearch = ortRes.filter(r => effTab(r.tab) === activeTab);
  const isColumns = view === "columns";
  // Tag chips filter clippings (tags are clipping-only); an active tag hides fragments.
  // In column view the chips span the whole board, not just the active tab.
  const tabTags = Array.from(new Set(tabResearch.flatMap(r => r.tags))).sort();
  const visibleTags = isColumns
    ? Array.from(new Set(ortRes.flatMap(r => r.tags))).sort()
    : tabTags;
  const shownResearch = tagFilter ? tabResearch.filter(r => r.tags.includes(tagFilter)) : tabResearch;
  const shownFragments = tagFilter ? [] : tabFragments;
  const tabEmpty = shownFragments.length === 0 && shownResearch.length === 0;

  // Drag-reorder within the active tab. Reassigns order_index 0..n and persists the
  // changed cards. Manage-only (it touches other authors' cards).
  const reorderTo = async (targetId: number) => {
    const from = tabFragments.findIndex(f => f.id === dragId);
    const to = tabFragments.findIndex(f => f.id === targetId);
    setDragId(null);
    if (dragId == null || dragId === targetId || from < 0 || to < 0) return;
    const list = [...tabFragments];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const reindexed = list.map((f, i) => ({ ...f, order_index: i }));
    qc.setQueryData<FragmentOut[]>(["fragments", collectionId], (old = []) =>
      [...old.filter(f => f.tab !== activeTab), ...reindexed]);
    try {
      await Promise.all(
        reindexed
          .filter(f => tabFragments.find(o => o.id === f.id)?.order_index !== f.order_index)
          .map(f => api.fragments.updateFragment(f.id, { order_index: f.order_index })),
      );
    } catch (e: any) {
      toast(e.message ?? "Fehler beim Sortieren", "error");
    }
    qc.invalidateQueries({ queryKey: ["fragments", collectionId] });
  };

  return (
    <Einordnung.Provider value={{ kategorien, vorgabe: ortFilter, tabs: allTabs, art: collection.art }}>
    <Aufklappen.Provider value={klappen.wert}>
    <div className="relative mx-auto w-[92%] max-w-seite p-6"
      onDragOver={e => { if (!canContribute || !istDateiZug(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setZiehtDateien(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setZiehtDateien(false); }}
      onDrop={e => {
        if (!canContribute || !istDateiZug(e)) return;
        e.preventDefault();
        setZiehtDateien(false);
        const dateien = Array.from(e.dataTransfer.files);
        if (!dateien.length) return;
        // In der Spaltenansicht zählt die Spalte unter dem Mauszeiger
        const spalte = (e.target as HTMLElement).closest<HTMLElement>("[data-spalte]")?.dataset.spalte;
        setClippingModal({ item: null, tab: spalte ?? activeTab, dateien });
      }}>
      {ziehtDateien && (
        <div className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-2xl border-4 border-dashed border-accent bg-accent/10">
          <span className="rounded-xl bg-page px-5 py-3 text-lg font-semibold shadow-lg">📥 Hier ablegen → neues Clipping</span>
        </div>
      )}
      <button className="text-sm text-muted hover:text-fg mb-2" onClick={() => router.push("/fragmente")}>← Sammlungen</button>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{collection?.name ?? "…"}</h1>
          {collection?.subject && <p className="text-sm text-muted">{collection.subject}</p>}
        </div>
        {/* Actions grouped so the QR sits next to the settings wheel rather than
            being spread out by justify-between. */}
        <div className="shrink-0 flex items-center gap-2">
          {collection && !guestToken && (
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-surface-hover"
              onClick={() => setQrOpen(true)}
              title={collection.allow_guests ? "QR-Codes anzeigen" : "QR-Code zum Öffnen der Sammlung"}>
              {/* Sitzt schon in einem Button, der die QR-Ansicht öffnet — keine zweite Lupe. */}
              <JoinQR url={collection.allow_guests ? guestUrl : directUrl} size={28} className="rounded-sm" zoomable={false} />
              {collection.allow_guests && collection.guest_code
                ? <span className="font-mono">{collection.guest_code}</span>
                : <span>QR</span>}
            </button>
          )}
          {canManage && collection && (
            <button className="px-3 py-1.5 rounded-lg border border-line hover:bg-surface-hover"
              onClick={() => setSettingsOpen(true)} title="Einstellungen" aria-label="Einstellungen">⚙️</button>
          )}
        </div>
      </div>

      {settingsOpen && collection && (
        <CollectionModal initial={collection} onClose={() => setSettingsOpen(false)} />
      )}

      {qrOpen && collection && (
        <Modal title="QR-Codes" onClose={() => setQrOpen(false)}>
          <div className="flex flex-col gap-5">
            {/* Direct link — always available. Requires a login and the collection's
                own permissions, so it is a shortcut rather than an access grant. */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold">Sammlung öffnen</p>
              <JoinQR url={directUrl} size={180} />
              <p className="text-[11px] text-muted text-center">
                Nur für angemeldete Berechtigte — Login und Freigabe bleiben nötig.
              </p>
              <button className="text-xs px-3 py-1.5 rounded-lg border border-line hover:bg-surface-hover"
                onClick={() => { if (directUrl) { navigator.clipboard?.writeText(directUrl); toast("Link kopiert", "success"); } }}>
                Link kopieren
              </button>
            </div>

            {collection.allow_guests && collection.guest_code && (
              <div className="flex flex-col items-center gap-2 border-t border-line pt-4">
                <p className="text-xs font-semibold">Gastzugang</p>
                <JoinQR url={guestUrl} size={180} />
                <p className="font-mono text-lg tracking-wider">{collection.guest_code}</p>
                <p className="text-[11px] text-muted">
                  Gäste dürfen: {collection.guest_permission === "contribute" ? "beitragen" : "nur lesen"}
                </p>
                <button className="text-xs px-3 py-1.5 rounded-lg border border-line hover:bg-surface-hover"
                  onClick={() => { if (guestUrl) { navigator.clipboard?.writeText(guestUrl); toast("Gast-Link kopiert", "success"); } }}>
                  Gast-Link kopieren
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Tab bar — in column view every tab is on screen, so it's redundant */}
      {!isColumns && (
        <TabBar
          tabs={allTabs}
          active={activeTab}
          onSelect={selectTab}
          canManage={canManage}
          onAdd={() => setAddTabOpen(true)}
        />
      )}
      {addTabOpen && (
        <AddTabDialog existing={allTabs} onAdd={(n) => addTab.mutate(n)} onClose={() => setAddTabOpen(false)} />
      )}

      {/* Toolbar — per-tab add buttons move into the columns in column view */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {canContribute && !isColumns && (
          <button className="btn-primary px-3 py-1.5 text-sm"
            disabled={addFragment.isPending} onClick={() => addFragment.mutate(activeTab)}>+ Karte</button>
        )}
        {canContribute && !isColumns && (
          <button className="px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-surface-hover"
            onClick={() => setClippingModal({ item: null, tab: activeTab })}>+ Clipping</button>
        )}
        {canContribute && !isColumns && (
          <button className="px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-surface-hover"
            onClick={() => setClippingModal({ item: null, tab: activeTab, workflow: true })}>+ Workflow</button>
        )}
        {canManage && isColumns && (
          <button className="px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-surface-hover"
            onClick={() => setAddTabOpen(true)}>+ Tab</button>
        )}
        {canContribute && !guestToken && (
          <button className="px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-surface-hover disabled:opacity-50"
            disabled={importFrag.isPending} onClick={pickImport} title="Markdown-/Textdateien importieren">Import</button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button className={`chip ${klappen.alle === "auf" ? "chip-on" : ""}`} onClick={() => klappen.alleSetzen("auf")}
            title="Alle Einträge ganz zeigen (noch einmal: zurück zur normalen Ansicht)">▾ alle auf</button>
          <button className={`chip ${klappen.alle === "zu" ? "chip-on" : ""}`} onClick={() => klappen.alleSetzen("zu")}
            title="Nur die Kopfzeilen zeigen (noch einmal: zurück zur normalen Ansicht)">▸ alle zu</button>
        </div>
        <div className="flex items-center rounded-lg border border-line overflow-hidden">
          <button className={`px-2 py-1 text-sm ${view === "grid" ? "bg-surface-hover text-fg" : "text-muted"}`}
            onClick={() => setView("grid")} title="Raster">▦</button>
          <button className={`px-2 py-1 text-sm ${view === "list" ? "bg-surface-hover text-fg" : "text-muted"}`}
            onClick={() => setView("list")} title="Liste">☰</button>
          <button className={`px-2 py-1 text-sm ${view === "columns" ? "bg-surface-hover text-fg" : "text-muted"}`}
            onClick={() => setView("columns")} title="Spalten (alle Tabs nebeneinander)">▥</button>
        </div>
      </div>

      {/* Klasse / Unterrichtseinheit — neue Karten und Clippings übernehmen die Auswahl */}
      {kategorien.length > 0 && (isColumns || activeTab !== ALLGEMEIN) && (
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted w-16">Klasse</span>
            {[null, ...kategorien.map(k => k.klasse)].map(k => (
              <button key={k ?? "alle"} onClick={() => setOrtFilter({ klasse: k, einheit: null })}
                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                  ortFilter.klasse === k ? "bg-accent text-black border-accent" : "border-line text-muted hover:bg-surface-hover"}`}>
                {k == null ? "alle" : k}
              </button>
            ))}
          </div>
          {ortFilter.klasse != null && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted w-16">Einheit</span>
              {[{ id: null as string | null, titel: "alle" }, ...(kategorien.find(k => k.klasse === ortFilter.klasse)?.einheiten ?? [])].map(e => (
                <button key={e.id ?? "alle"} onClick={() => setOrtFilter({ klasse: ortFilter.klasse, einheit: e.id })}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                    ortFilter.einheit === e.id ? "bg-accent text-black border-accent" : "border-line text-muted hover:bg-surface-hover"}`}>
                  {e.titel}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tag filter chips — from the active tab, or the whole board in column view */}
      {visibleTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {visibleTags.map(t => (
            <button key={t} onClick={() => setTagFilter(f => f === t ? null : t)}
              className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                tagFilter === t ? "bg-accent text-black border-accent"
                                : "border-line text-muted hover:bg-surface-hover"}`}>
              {t}
            </button>
          ))}
          {tagFilter && (
            <button className="text-[11px] text-muted hover:text-fg underline ml-1"
              onClick={() => setTagFilter(null)}>Filter zurücksetzen</button>
          )}
        </div>
      )}

      {/* Content */}
      {isColumns ? (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {allTabs.map(t => {
            const colFrags = tagFilter ? [] : ortFrags.filter(f => effTab(f.tab) === t);
            const colRes = ortRes.filter(r => effTab(r.tab) === t && (!tagFilter || r.tags.includes(tagFilter)));
            const empty = colFrags.length === 0 && colRes.length === 0;
            return (
              <div key={t} data-spalte={t} className="shrink-0 w-80 rounded-xl border border-line bg-surface-hover/30 p-3 flex flex-col gap-3">
                {/* Column header + its own add buttons */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold truncate">{tabLabel(t)}</h3>
                  <span className="text-[10px] text-muted shrink-0">{colFrags.length + colRes.length}</span>
                </div>
                {canContribute && (
                  <div className="flex gap-1.5">
                    <button className="btn-primary flex-1 px-2 py-1 text-xs"
                      disabled={addFragment.isPending} onClick={() => addFragment.mutate(t)}>+ Karte</button>
                    <button className="flex-1 px-2 py-1 text-xs rounded-lg border border-line bg-page hover:bg-surface-hover"
                      onClick={() => setClippingModal({ item: null, tab: t })}>+ Clipping</button>
                    <button className="flex-1 px-2 py-1 text-xs rounded-lg border border-line bg-page hover:bg-surface-hover"
                      onClick={() => setClippingModal({ item: null, tab: t, workflow: true })}>+ Workflow</button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {empty ? (
                    <p className="text-[11px] text-muted text-center py-6">Leer</p>
                  ) : (
                    <>
                      {colFrags.map(f => markiert(`f${f.id}`, <FragmentCard key={`f${f.id}`} frag={f} layout="list" />))}
                      {colRes.map(item => markiert(`r${item.id}`, eintragKarte(item)))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : tabEmpty ? (
        <p className="text-muted text-sm py-16 text-center">
          {tagFilter ? "Keine Clippings mit diesem Tag." : "Noch nichts in diesem Tab."}
        </p>
      ) : (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2"}>
          {shownFragments.map(f => markiert(`f${f.id}`,
            <FragmentCard key={`f${f.id}`} frag={f} layout={view === "grid" ? "grid" : "list"} canReorder={canManage}
              onDragStartCard={() => setDragId(f.id)} onDropCard={() => reorderTo(f.id)} />
          ))}
          {shownResearch.map(item => markiert(`r${item.id}`, eintragKarte(item)))}
        </div>
      )}

      {clippingModal && (clippingModal.workflow || clippingModal.item?.art === "workflow") && (
        <WorkflowModal collectionId={collectionId} initial={clippingModal.item}
          tab={clippingModal.tab ?? activeTab} guestToken={guestToken} onClose={() => setClippingModal(null)} />
      )}
      {clippingModal && !(clippingModal.workflow || clippingModal.item?.art === "workflow") && (
        <ClippingModal collectionId={collectionId} initial={clippingModal.item} dateien={clippingModal.dateien}
          tab={clippingModal.tab ?? activeTab} guestToken={guestToken} onClose={() => setClippingModal(null)} />
      )}
    </div>
    </Aufklappen.Provider>
    </Einordnung.Provider>
  );
}
