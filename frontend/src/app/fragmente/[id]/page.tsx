"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, fragmentGuest, FragmentCollectionOut, FragmentOut, FragmentTabs,
  ResearchItemOut,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

const TAB_LABEL: Record<string, string> = { snippets: "Schnipsel", archive: "Archiv" };
const tabLabel = (t: string) => TAB_LABEL[t] ?? t;

// ── Small reusable dialogs ────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] p-5 shadow-2xl"
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
      <p className="text-sm text-[var(--text-muted)] mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]" onClick={onClose}>Abbrechen</button>
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
      <p className="text-[11px] text-[var(--text-muted)] mt-2">Neue Tabs erscheinen vor „Archiv".</p>
      <div className="flex justify-end gap-2 mt-5">
        <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]" onClick={onClose}>Abbrechen</button>
        <button className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
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
    <div className="flex items-stretch h-10 border-b border-[var(--border)] mb-4 select-none">
      <button className="px-1.5 text-[var(--text-muted)] hover:text-[var(--text)] shrink-0" onClick={() => scrollByPx(-180)} title="Zurück">‹</button>
      <div ref={scrollRef} className="flex-1 flex items-stretch overflow-x-hidden">
        {tabs.map(t => (
          <button key={t} data-tab={t}
            className={`px-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0 ${
              active === t ? "border-[var(--accent)] text-[var(--text)] font-semibold" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}
            onClick={() => onSelect(t)}>
            {tabLabel(t)}
          </button>
        ))}
      </div>
      <button className="px-1.5 text-[var(--text-muted)] hover:text-[var(--text)] shrink-0" onClick={() => scrollByPx(180)} title="Weiter">›</button>
      <div className="relative shrink-0">
        <button className="px-1.5 h-full text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setMenuOpen(v => !v)} title="Alle Tabs">▾</button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-xl py-1 min-w-[160px]">
              {tabs.map(t => (
                <button key={t} onClick={() => selectAndReveal(t)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)] ${active === t ? "text-[var(--accent)] font-semibold" : "text-[var(--text)]"}`}>
                  {tabLabel(t)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {canManage && onAdd && (
        <button className="px-2 shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)]" onClick={onAdd} title="Tab hinzufügen">＋</button>
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

  const save = (patch: Partial<{ title: string | null; content: string | null; category: string | null }>) =>
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
      className={`group relative rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 flex flex-col ${layout === "list" ? "h-32" : "h-52"}`}
      onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
      onDrop={canReorder ? () => onDropCard?.() : undefined}
    >
      {canReorder && (
        <span
          draggable
          onDragStart={onDragStartCard}
          className="absolute top-1 right-1.5 cursor-grab select-none text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
          title="Ziehen zum Sortieren"
        >⠿</span>
      )}
      <input
        className="bg-transparent text-sm font-semibold outline-none mb-1 disabled:opacity-100 pr-5"
        value={title}
        disabled={!editable}
        placeholder="Titel…"
        onChange={e => setTitle(e.target.value)}
        onBlur={() => title !== (frag.title ?? "") && save({ title: title.trim() || null })}
      />
      <textarea
        className="flex-1 resize-none bg-transparent text-sm outline-none text-[var(--text)] placeholder:text-[var(--text-muted)]"
        value={content}
        disabled={!editable}
        placeholder={editable ? "Text…" : ""}
        onChange={e => { setContent(e.target.value); scheduleSave(e.target.value); }}
        onBlur={() => { if (timer.current) clearTimeout(timer.current); if (content !== (frag.content ?? "")) save({ content }); }}
      />
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {editingCat ? (
            <input autoFocus value={category} onChange={e => setCategory(e.target.value)}
              onBlur={() => { setEditingCat(false); if (category !== (frag.category ?? "")) save({ category: category.trim() || null }); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
              placeholder="Label…" className="bg-[var(--surface-hover)] rounded px-1.5 py-0.5 outline-none w-20 text-[10px]" />
          ) : category ? (
            <button className="bg-[var(--accent)]/15 text-[var(--accent)] px-1.5 py-0.5 rounded-full"
              onClick={() => editable && setEditingCat(true)}>{category}</button>
          ) : editable ? (
            <button className="opacity-0 group-hover:opacity-100 hover:text-[var(--text)] transition-opacity"
              onClick={() => setEditingCat(true)}>+ Label</button>
          ) : null}
          <span className="truncate">{frag.author_name ?? ""}</span>
        </div>
        {editable && (
          <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity shrink-0"
            onClick={() => setConfirmDel(true)} title="Löschen">Löschen</button>
        )}
      </div>
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
  collectionId, initial, tab, guestToken, onClose,
}: {
  collectionId: number;
  initial: ResearchItemOut | null;
  tab: string;
  guestToken?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [text, setText] = useState(initial?.text_content ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["research", collectionId] });

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title: title.trim() || null, url: url.trim() || null, text_content: text.trim() || null, tags };
      const item = isEdit
        ? await api.fragments.updateResearch(initial!.id, payload)
        : await api.fragments.createResearch(collectionId, { ...payload, tab }, guestToken);
      for (const f of files) await api.fragments.uploadMedia(item.id, f, guestToken);
      return item;
    },
    onSuccess: () => { invalidate(); toast("Gespeichert", "success"); onClose(); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const canSave = !save.isPending && (!!title.trim() || !!url.trim() || !!text.trim() || files.length > 0 || (initial?.media.length ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] p-6 shadow-2xl"
        style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{isEdit ? "Clipping bearbeiten" : "Neues Clipping"}</h2>
        <div className="space-y-3">
          <div><label className="label">Titel</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel (optional)" /></div>
          {!guestToken && (
            <div>
              <label className="label">URL</label>
              <input className="input" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Titel & Vorschau werden automatisch geladen.</p>
            </div>
          )}
          <div><label className="label">Text</label><textarea className="input min-h-[80px] resize-y" value={text} onChange={e => setText(e.target.value)} placeholder="Zitat, Notiz…" /></div>
          <div>
            <label className="label">Tags</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Tag…" />
              <button className="px-3 rounded-lg border border-[var(--border)] text-sm" onClick={addTag} type="button">+</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map(t => (
                  <span key={t} className="text-[10px] bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5 rounded-full flex items-center gap-1">
                    {t}<button onClick={() => setTags(tags.filter(x => x !== t))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">Bilder / PDFs</label>
            <input type="file" multiple accept="image/*,application/pdf"
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
              className="text-xs text-[var(--text-muted)]" />
            {files.length > 0 && <p className="text-[10px] text-[var(--text-muted)] mt-1">{files.length} Datei(en) ausgewählt</p>}
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]" onClick={onClose}>Abbrechen</button>
          <button className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
            disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Clipping card ─────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative bg-[var(--bg)] rounded-lg shadow-2xl w-[min(92vw,900px)] h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-3 p-2 border-b border-[var(--border)]">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">In neuem Tab ↗</a>
          <button className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none" onClick={onClose}>×</button>
        </div>
        <iframe src={url} className="flex-1 w-full rounded-b-lg" title="PDF" />
      </div>
    </div>
  );
}

function ClippingCard({ item, onEdit }: { item: ResearchItemOut; onEdit: () => void }) {
  const qc = useQueryClient();
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
    <div className="group rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 flex flex-col gap-2">
      {active && (
        <div className="relative rounded-lg overflow-hidden bg-[var(--surface-hover)] aspect-[4/3]">
          <img src={active.path} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setLightbox(true)} />
          {gallery.length > 1 && (
            <>
              <button className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded px-1.5 opacity-0 group-hover:opacity-100 disabled:opacity-0"
                onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={safeIdx === 0}>‹</button>
              <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded px-1.5 opacity-0 group-hover:opacity-100 disabled:opacity-0"
                onClick={() => setActiveIdx(i => Math.min(gallery.length - 1, i + 1))} disabled={safeIdx === gallery.length - 1}>›</button>
              <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
                {gallery.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === safeIdx ? "w-3 bg-white" : "w-1.5 bg-white/50"}`} />)}
              </div>
            </>
          )}
          {item.can_edit && active.id >= 0 && (
            <button className="absolute top-1 right-1 bg-black/60 text-white rounded px-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-600/80"
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
        <button className="text-sm font-semibold text-left line-clamp-2 hover:text-[var(--accent)]" onClick={onEdit}>{displayTitle}</button>
        {item.can_edit && (
          <button className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-500 text-xs transition-opacity"
            onClick={() => setConfirmDel(true)} title="Löschen">×</button>
        )}
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent)] truncate hover:underline">{item.url}</a>
      )}
      {item.text_content && <p className="text-xs text-[var(--text-muted)] line-clamp-4 border-l-2 border-[var(--border)] pl-2 italic">{item.text_content}</p>}

      {/* PDFs + extra media */}
      {item.media.filter(m => m.kind === "pdf").length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.media.filter(m => m.kind === "pdf").map(m => (
            <span key={m.id} className="inline-flex items-center gap-1 text-[10px] bg-[var(--surface-hover)] px-2 py-0.5 rounded">
              <button onClick={() => setPdfUrl(m.path)} className="hover:underline">📄 PDF</button>
              {item.can_edit && <button onClick={() => delMedia.mutate(m.id)} className="hover:text-red-500">×</button>}
            </span>
          ))}
        </div>
      )}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map(t => <span key={t} className="text-[10px] bg-[var(--accent)]/15 text-[var(--accent)] px-1.5 py-0.5 rounded-full">{t}</span>)}
        </div>
      )}
      <div className="flex items-center justify-between mt-auto pt-1">
        {item.author_name ? <span className="text-[10px] text-[var(--text-muted)] truncate">{item.author_name}</span> : <span />}
        {item.can_edit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]" onClick={() => pickFile("image/*")} title="Bild anhängen">+ Bild</button>
            <button className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]" onClick={() => pickFile("application/pdf")} title="PDF anhängen">+ PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Board page ────────────────────────────────────────────────────────────────

export default function FragmentBoardPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  const collectionId = Number(params.id);
  // Guest mode: no logged-in user, but a collection-scoped guest token from a QR/link join.
  const guestToken = auth ? undefined : fragmentGuest.get(collectionId);

  const [activeTab, setActiveTab] = useState<string>("snippets");
  const [clippingModal, setClippingModal] = useState<null | { item: ResearchItemOut | null; tab?: string }>(null);
  const [view, setView] = useState<"grid" | "list" | "columns">("grid");
  const [dragId, setDragId] = useState<number | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [addTabOpen, setAddTabOpen] = useState(false);
  const selectTab = (t: string) => { setActiveTab(t); setTagFilter(null); };

  const { data: collection, isError } = useQuery<FragmentCollectionOut>({
    queryKey: ["fragment-collection", collectionId],
    queryFn: () => api.fragments.getCollection(collectionId, guestToken),
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
  });
  const { data: research = [] } = useQuery<ResearchItemOut[]>({
    queryKey: ["research", collectionId],
    queryFn: () => api.fragments.listResearch(collectionId, guestToken),
    enabled: !!collection,
  });

  const perm = collection?.my_permission ?? "none";
  const canContribute = perm === "contribute" || perm === "manage";
  const canManage = perm === "manage";

  const allTabs = useMemo(() => tabs?.all ?? ["snippets", "archive"], [tabs]);
  // Fall back an orphaned card (tab no longer exists) into the first tab.
  const effTab = (t: string) => (allTabs.includes(t) ? t : allTabs[0]);

  const addFragment = useMutation({
    mutationFn: (tab: string) => api.fragments.createFragment(collectionId, { tab, content: "" }, guestToken),
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

  if (isError) {
    return <div className="max-w-4xl mx-auto p-6 text-[var(--text-muted)]">Kein Zugriff auf diese Sammlung.</div>;
  }

  const tabFragments = fragments.filter(f => effTab(f.tab) === activeTab);
  const tabResearch = research.filter(r => effTab(r.tab) === activeTab);
  const isColumns = view === "columns";
  // Tag chips filter clippings (tags are clipping-only); an active tag hides fragments.
  // In column view the chips span the whole board, not just the active tab.
  const tabTags = Array.from(new Set(tabResearch.flatMap(r => r.tags))).sort();
  const visibleTags = isColumns
    ? Array.from(new Set(research.flatMap(r => r.tags))).sort()
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
    <div className="mx-auto w-[92%] max-w-[1600px] p-6">
      <button className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-2" onClick={() => router.push("/fragmente")}>← Sammlungen</button>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{collection?.name ?? "…"}</h1>
          {collection?.subject && <p className="text-sm text-[var(--text-muted)]">{collection.subject}</p>}
        </div>
      </div>

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
          <button className="px-3 py-1.5 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
            disabled={addFragment.isPending} onClick={() => addFragment.mutate(activeTab)}>+ Karte</button>
        )}
        {canContribute && !isColumns && (
          <button className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
            onClick={() => setClippingModal({ item: null, tab: activeTab })}>+ Clipping</button>
        )}
        {canManage && isColumns && (
          <button className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
            onClick={() => setAddTabOpen(true)}>+ Tab</button>
        )}
        {canContribute && !guestToken && (
          <button className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            disabled={importFrag.isPending} onClick={pickImport} title="Markdown-/Textdateien importieren">Import</button>
        )}
        <div className="ml-auto flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
          <button className={`px-2 py-1 text-sm ${view === "grid" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
            onClick={() => setView("grid")} title="Raster">▦</button>
          <button className={`px-2 py-1 text-sm ${view === "list" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
            onClick={() => setView("list")} title="Liste">☰</button>
          <button className={`px-2 py-1 text-sm ${view === "columns" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
            onClick={() => setView("columns")} title="Spalten (alle Tabs nebeneinander)">▥</button>
        </div>
      </div>

      {/* Tag filter chips — from the active tab, or the whole board in column view */}
      {visibleTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {visibleTags.map(t => (
            <button key={t} onClick={() => setTagFilter(f => f === t ? null : t)}
              className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                tagFilter === t ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
              {t}
            </button>
          ))}
          {tagFilter && (
            <button className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] underline ml-1"
              onClick={() => setTagFilter(null)}>Filter zurücksetzen</button>
          )}
        </div>
      )}

      {/* Content */}
      {isColumns ? (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {allTabs.map(t => {
            const colFrags = tagFilter ? [] : fragments.filter(f => effTab(f.tab) === t);
            const colRes = research.filter(r => effTab(r.tab) === t && (!tagFilter || r.tags.includes(tagFilter)));
            const empty = colFrags.length === 0 && colRes.length === 0;
            return (
              <div key={t} className="shrink-0 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/30 p-3 flex flex-col gap-3">
                {/* Column header + its own add buttons */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold truncate">{tabLabel(t)}</h3>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0">{colFrags.length + colRes.length}</span>
                </div>
                {canContribute && (
                  <div className="flex gap-1.5">
                    <button className="flex-1 px-2 py-1 text-xs rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
                      disabled={addFragment.isPending} onClick={() => addFragment.mutate(t)}>+ Karte</button>
                    <button className="flex-1 px-2 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-hover)]"
                      onClick={() => setClippingModal({ item: null, tab: t })}>+ Clipping</button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {empty ? (
                    <p className="text-[11px] text-[var(--text-muted)] text-center py-6">Leer</p>
                  ) : (
                    <>
                      {colFrags.map(f => <FragmentCard key={`f${f.id}`} frag={f} layout="list" />)}
                      {colRes.map(item => (
                        <ClippingCard key={`r${item.id}`} item={item} onEdit={() => item.can_edit && setClippingModal({ item })} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : tabEmpty ? (
        <p className="text-[var(--text-muted)] text-sm py-16 text-center">
          {tagFilter ? "Keine Clippings mit diesem Tag." : "Noch nichts in diesem Tab."}
        </p>
      ) : (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2"}>
          {shownFragments.map(f => (
            <FragmentCard key={`f${f.id}`} frag={f} layout={view === "grid" ? "grid" : "list"} canReorder={canManage}
              onDragStartCard={() => setDragId(f.id)} onDropCard={() => reorderTo(f.id)} />
          ))}
          {shownResearch.map(item => (
            <ClippingCard key={`r${item.id}`} item={item} onEdit={() => item.can_edit && setClippingModal({ item })} />
          ))}
        </div>
      )}

      {clippingModal && (
        <ClippingModal collectionId={collectionId} initial={clippingModal.item}
          tab={clippingModal.tab ?? activeTab} guestToken={guestToken} onClose={() => setClippingModal(null)} />
      )}
    </div>
  );
}
