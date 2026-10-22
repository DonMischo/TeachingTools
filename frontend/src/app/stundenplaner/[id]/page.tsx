"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, LessonPlanOut, Phase, ToolLink, ToolRefs, LessonMaterialOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useLessonSession } from "@/contexts/LessonSessionContext";
import { launchTool } from "@/lib/toolLaunch";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOZIALFORMEN = ["Plenum", "EA", "PA", "GA", "Gruppen"];
const PHASE_PRESETS = ["Einstieg", "Erarbeitung I", "Erarbeitung II", "Sicherung", "Abschluss", "Vertiefung", "Übung", "Reflexion"];
const CUSTOM_PHASE = "__custom__";
type ExportFormat = "pdf" | "docx" | "tex";
const EXPORT_FORMATE: [ExportFormat, string][] = [["pdf", "PDF (.pdf)"], ["docx", "Word (.docx)"], ["tex", "LaTeX (.tex)"]];
const FAECHER = ["", "Deutsch", "Mathematik", "Englisch", "Biologie", "Chemie", "Physik", "Geschichte", "Geographie", "Informatik", "Musik", "Kunst", "Sport", "Ethik", "Religion"];

// ---------------------------------------------------------------------------
// Tool Picker Modal
// ---------------------------------------------------------------------------

const LINK_TYPE = "link";
const LINK_LABEL = "🔗 Link / URL";

function ToolPicker({ refs, onConfirm, onClose }: {
  refs: ToolRefs;
  onConfirm: (link: ToolLink) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<string>("");
  const [refId, setRefId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const tool = refs.find(t => t.type === type);
  const isLink = type === LINK_TYPE;

  function handleTypeChange(t: string) {
    setType(t);
    setRefId(null);
    setUrl("");
    setLabel("");
    const info = refs.find(x => x.type === t);
    if (info && !info.requires_ref) {
      setLabel(info.items[0]?.label ?? info.label);
    }
  }

  function handleRefChange(rid: string) {
    setRefId(rid || null);
    const item = tool?.items.find(r => r.ref_id === rid);
    setLabel(item?.label ?? "");
  }

  const urlOk = /^https?:\/\/.+/i.test(url.trim());
  const canConfirm = isLink ? urlOk : (tool && (!tool.requires_ref || refId));

  function confirm() {
    if (isLink) {
      if (!urlOk) return;
      onConfirm({ type: LINK_TYPE, ref_id: null, url: url.trim(), label: label.trim() || url.trim() });
    } else if (tool && canConfirm) {
      onConfirm({ type: tool.type as ToolLink["type"], ref_id: refId, label: label || tool.label });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm mx-4 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-base">Tool einbinden</div>

        <div>
          <label className="text-xs text-muted block mb-1">Tool-Typ</label>
          <div className="grid grid-cols-2 gap-2">
            {[...refs, { type: LINK_TYPE, label: LINK_LABEL }].map(t => (
              <button key={t.type} onClick={() => handleTypeChange(t.type)}
                className="text-left px-3 py-2 rounded-lg border text-sm transition-colors"
                style={{
                  border: type === t.type ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  background: type === t.type ? "rgba(255,235,59,0.08)" : "var(--bg)",
                  color: type === t.type ? "var(--accent)" : "var(--text)",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isLink && (
          <div>
            <label className="text-xs text-muted block mb-1">URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className="input text-sm py-2 w-full" />
            {url.trim() && !urlOk && (
              <p className="text-xs text-red-400 mt-1">Bitte eine gültige http(s)-Adresse eingeben.</p>
            )}
          </div>
        )}

        {tool && tool.requires_ref && (
          <div>
            <label className="text-xs text-muted block mb-1">Welcher Inhalt?</label>
            {tool.items.length === 0 ? (
              <p className="text-xs text-muted">Keine Inhalte gefunden. Erstelle zuerst eins im jeweiligen Tool.</p>
            ) : (
              <select value={refId ?? ""} onChange={e => handleRefChange(e.target.value)} className="input text-sm py-2 w-full">
                <option value="">— bitte wählen —</option>
                {tool.items.map(r => (
                  <option key={r.ref_id} value={r.ref_id ?? ""}>{r.label}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {(tool || isLink) && (
          <div>
            <label className="text-xs text-muted block mb-1">Anzeigetext (optional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder={isLink ? "z.B. Erklärvideo" : tool?.label} className="input text-sm py-2 w-full" />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Abbrechen</button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="btn-primary text-sm py-1.5 px-4">
            Einbinden
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Methoden aus dem Kompendium (public/kompendium, einmal geladen)
// ---------------------------------------------------------------------------

type KompendiumMethode = { id: string; name: string; aliase?: string[]; kurz: string; phasen: string[]; dauer?: string };
const MAX_METHODEN = 5;
let kompendiumLaden: Promise<KompendiumMethode[]> | null = null;

function ladeMethoden(): Promise<KompendiumMethode[]> {
  kompendiumLaden ??= fetch("/kompendium/methoden_kompendium.json")
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => d.methoden as KompendiumMethode[])
    .catch(e => { kompendiumLaden = null; throw e; });
  return kompendiumLaden;
}

function useMethoden(): KompendiumMethode[] {
  const [methoden, setMethoden] = useState<KompendiumMethode[]>([]);
  useEffect(() => { ladeMethoden().then(setMethoden).catch(() => {}); }, []);
  return methoden;
}

// Phasenname → Kompendium-Phase, damit passende Methoden oben stehen
function kompendiumPhase(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("einstieg")) return "einstieg";
  if (/abschluss|sicherung|reflexion/.test(n)) return "abschluss";
  return "hauptteil";
}

function MethodenPicker({ phaseName, gewaehlt, onPick, onClose }: {
  phaseName: string;
  gewaehlt: string[];
  onPick: (m: KompendiumMethode) => void;
  onClose: () => void;
}) {
  const methoden = useMethoden();
  const [suche, setSuche] = useState("");
  const [nurPhase, setNurPhase] = useState(true);
  const phase = kompendiumPhase(phaseName);
  const q = suche.trim().toLowerCase();
  const treffer = methoden
    .filter(m => !gewaehlt.includes(m.id))
    .filter(m => !nurPhase || m.phasen.includes(phase) || m.phasen.includes("uebergreifend"))
    .filter(m => !q || [m.name, m.kurz, ...(m.aliase ?? [])].join(" ").toLowerCase().includes(q))
    .slice(0, 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="card p-6 w-full max-w-lg mx-4 flex flex-col gap-3 max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-base">Methode aus dem Kompendium</div>
        <input autoFocus value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen, z.B. Think-Pair-Share" className="input text-sm py-2 w-full" />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={nurPhase} onChange={e => setNurPhase(e.target.checked)} />
          nur Methoden für diese Phase ({phase === "einstieg" ? "Einstieg" : phase === "abschluss" ? "Abschluss" : "Hauptteil"})
        </label>
        <div className="flex flex-col gap-1 overflow-y-auto min-h-0">
          {methoden.length === 0 && <p className="text-xs text-muted">Lädt…</p>}
          {methoden.length > 0 && treffer.length === 0 && <p className="text-xs text-muted">Keine passende Methode.</p>}
          {treffer.map(m => (
            <button key={m.id} onClick={() => onPick(m)}
              className="text-left px-3 py-2 rounded-lg border border-line hover:border-accent hover:bg-surface-hover transition-colors">
              <div className="text-sm font-semibold">{m.name}{m.dauer && <span className="text-xs text-muted font-normal"> · {m.dauer}</span>}</div>
              <div className="text-xs text-muted line-clamp-2">{m.kurz}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Schließen</button>
        </div>
      </div>
    </div>
  );
}

function MethodenChips({ phase, readOnly, onChange }: { phase: Phase; readOnly: boolean; onChange: (p: Phase) => void }) {
  const methoden = useMethoden();
  const [picker, setPicker] = useState(false);
  const ids = phase.methoden ?? [];
  const name = (id: string) => methoden.find(m => m.id === id)?.name ?? id;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ids.map(id => (
        <span key={id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-line bg-surface">
          <a href={`/tools/kompendium?m=${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
            📚 {name(id)}
          </a>
          {!readOnly && (
            <button onClick={() => onChange({ ...phase, methoden: ids.filter(x => x !== id) })} className="text-red-400 hover:underline">✕</button>
          )}
        </span>
      ))}
      {!readOnly && ids.length < MAX_METHODEN && (
        <button onClick={() => setPicker(true)} className="text-xs text-muted hover:text-accent transition-colors border border-dashed border-line px-3 py-1 rounded-full hover:border-accent">
          + Methode aus Kompendium
        </button>
      )}
      {picker && (
        <MethodenPicker
          phaseName={phase.name}
          gewaehlt={ids}
          onPick={m => {
            onChange({ ...phase, methoden: [...ids, m.id], methode: phase.methode || m.name });
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase Card
// ---------------------------------------------------------------------------

const MATERIAL_ICONS: Record<string, string> = {
  ".pdf": "📕", ".docx": "📄", ".odt": "📄", ".pptx": "📊", ".odp": "📊",
  ".xlsx": "📈", ".ods": "📈", ".txt": "📝", ".csv": "📝", ".md": "📝",
};
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

function materialIcon(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (IMAGE_EXT.includes(ext)) return "🖼️";
  return MATERIAL_ICONS[ext] ?? "📎";
}

function MaterialChips({ planId, phaseId, readOnly }: { planId: number; phaseId: string | null | undefined; readOnly: boolean }) {
  const { toast } = useToast();
  const { setViewingMaterial } = useLessonSession();
  const [materials, setMaterials] = useState<LessonMaterialOut[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    if (!phaseId) return;
    api.stundenplaner.materials.list(planId).then(all => {
      setMaterials(all.filter(m => m.phase_id === phaseId));
    }).catch(() => {});
  }, [planId, phaseId]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !phaseId) return;
    setUploading(true);
    try {
      await api.stundenplaner.materials.upload(planId, phaseId, file);
      load();
    } catch (err: any) {
      toast(err.message ?? "Upload fehlgeschlagen", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(materialId: number) {
    try {
      await api.stundenplaner.materials.remove(planId, materialId);
      setMaterials(prev => prev.filter(m => m.id !== materialId));
    } catch (err: any) {
      toast(err.message ?? "Löschen fehlgeschlagen", "error");
    }
  }

  if (!phaseId) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {materials.map(m => (
        <span key={m.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-line bg-surface">
          <button onClick={() => setViewingMaterial(m)} className="hover:text-accent transition-colors">
            {materialIcon(m.original_filename)} {m.original_filename}
          </button>
          {!readOnly && (
            <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:underline">🗑</button>
          )}
        </span>
      ))}
      {!readOnly && (
        <label className="text-xs text-muted hover:text-accent transition-colors border border-dashed border-line px-3 py-1 rounded-full hover:border-accent cursor-pointer">
          {uploading ? "Lädt hoch…" : "+ Material"}
          <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      )}
    </div>
  );
}

function PhaseCard({ phase, index, total, refs, planId, klasse, readOnly, onChange, onMove, onDelete }: {
  phase: Phase;
  index: number;
  total: number;
  refs: ToolRefs;
  planId: number;
  klasse: string;
  readOnly: boolean;
  onChange: (p: Phase) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [showPicker, setShowPicker] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (!phase.tool_link || starting) return;
    setStarting(true);
    try {
      const url = await launchTool(phase.tool_link, klasse);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast(e.message ?? "Starten fehlgeschlagen", "error");
    } finally {
      setStarting(false);
    }
  }

  function set<K extends keyof Phase>(key: K, value: Phase[K]) {
    onChange({ ...phase, [key]: value });
  }

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        <span className="text-xs text-muted font-mono w-5 shrink-0">{index + 1}</span>
        <span className="font-semibold text-sm flex-1">{phase.name || "Phase"}</span>
        <span className="text-xs text-muted shrink-0">{phase.dauer_min} min</span>
        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-xs px-1.5 py-0.5 rounded-sm hover:bg-surface-hover disabled:opacity-30">↑</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-xs px-1.5 py-0.5 rounded-sm hover:bg-surface-hover disabled:opacity-30">↓</button>
          <button onClick={onDelete} className="text-xs px-1.5 py-0.5 rounded-sm text-red-400 hover:bg-red-400/10">🗑</button>
        </div>
        <span className="text-xs text-muted shrink-0">{expanded ? "▾" : "▸"}</span>
      </div>

      {expanded && (
        <div className="p-3 flex flex-col gap-3 bg-page">
          {/* Name + Dauer row */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-40">
              <label className="text-xs text-muted">Phasenname</label>
              <div className="flex gap-1">
                <select
                  value={PHASE_PRESETS.includes(phase.name) ? phase.name : CUSTOM_PHASE}
                  onChange={e => set("name", e.target.value === CUSTOM_PHASE ? "" : e.target.value)}
                  className="input text-sm py-1.5 flex-1"
                >
                  {PHASE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value={CUSTOM_PHASE}>Eigener Name…</option>
                </select>
                {!PHASE_PRESETS.includes(phase.name) && (
                  <input
                    value={phase.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="Eigener Name"
                    className="input text-sm py-1.5 flex-1"
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 w-24 shrink-0">
              <label className="text-xs text-muted">Dauer (min)</label>
              <input type="number" min={1} max={300} value={phase.dauer_min} onChange={e => set("dauer_min", Number(e.target.value))} className="input text-sm py-1.5" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-32">
              <label className="text-xs text-muted">Sozialform</label>
              <select value={phase.sozialform} onChange={e => set("sozialform", e.target.value)} className="input text-sm py-1.5">
                {SOZIALFORMEN.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Inhalt */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Inhalt / Verlauf</label>
            <textarea value={phase.inhalt} onChange={e => set("inhalt", e.target.value)} rows={2} placeholder="Was passiert in dieser Phase?" className="input text-sm resize-y" />
          </div>

          {/* Methode + Material */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-32">
              <label className="text-xs text-muted">Methode</label>
              <input value={phase.methode} onChange={e => set("methode", e.target.value)} placeholder="z.B. Bildbetrachtung" className="input text-sm py-1.5" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-32">
              <label className="text-xs text-muted">Material / Medien</label>
              <input value={phase.material} onChange={e => set("material", e.target.value)} placeholder="z.B. Beamer, AB" className="input text-sm py-1.5" />
            </div>
          </div>

          {/* Methoden aus dem Kompendium */}
          <MethodenChips phase={phase} readOnly={readOnly} onChange={onChange} />

          {/* Tool Link */}
          <div>
            {phase.tool_link ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleStart} disabled={starting}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50">
                  {starting ? "Startet…" : <>▶ {phase.tool_link.label || phase.tool_link.type}</>}
                </button>
                <button onClick={() => set("tool_link", null)} className="text-xs text-red-400 hover:underline">entfernen</button>
              </div>
            ) : (
              <button onClick={() => setShowPicker(true)} className="text-xs text-muted hover:text-accent transition-colors border border-dashed border-line px-3 py-1 rounded-full hover:border-accent">
                + Tool einbinden
              </button>
            )}
          </div>

          {/* Materials */}
          <MaterialChips planId={planId} phaseId={phase.id} readOnly={readOnly} />
        </div>
      )}

      {showPicker && (
        <ToolPicker
          refs={refs}
          onConfirm={link => { set("tool_link", link); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share Panel
// ---------------------------------------------------------------------------

function SharePanel({ plan, onUpdate }: { plan: LessonPlanOut; onUpdate: (p: LessonPlanOut) => void }) {
  const { toast } = useToast();
  const [allTeachers, setAllTeachers] = useState<{ id: number; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    api.apiFetch<{ id: number; first_name: string; last_name: string }[]>("teachers").then(ts => {
      setAllTeachers(ts.map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}` })));
    }).catch(() => {});
  }, []);

  const sharedIds = new Set(plan.shared_with.map(s => s.teacher_id));
  const suggestions = query.trim()
    ? allTeachers.filter(t => !sharedIds.has(t.id) && t.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  async function add(teacherId: number) {
    setAdding(teacherId);
    try {
      const share = await api.stundenplaner.addShare(plan.id, teacherId);
      onUpdate({ ...plan, shared_with: [...plan.shared_with, share] });
      setQuery("");
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    } finally {
      setAdding(null);
    }
  }

  async function remove(teacherId: number) {
    try {
      await api.stundenplaner.removeShare(plan.id, teacherId);
      onUpdate({ ...plan, shared_with: plan.shared_with.filter(s => s.teacher_id !== teacherId) });
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Lehrkraft suchen…"
          className="input text-sm py-2 w-full"
        />
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 bg-surface border border-line rounded-xl mt-1 overflow-hidden shadow-lg">
            {suggestions.slice(0, 6).map(t => (
              <button key={t.id} onClick={() => add(t.id)} disabled={adding === t.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors flex items-center justify-between">
                {t.name}
                <span className="text-xs text-accent">{adding === t.id ? "…" : "+ einladen"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {plan.shared_with.length === 0 ? (
        <p className="text-xs text-muted">Noch mit niemandem geteilt.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {plan.shared_with.map(s => (
            <li key={s.teacher_id} className="flex items-center justify-between text-sm">
              <span>{s.name}</span>
              <button onClick={() => remove(s.teacher_id)} className="text-xs text-red-400 hover:underline">entfernen</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Class Share Panel (scaffolding — no student-facing view yet)
// ---------------------------------------------------------------------------

function ClassSharePanel({ planId }: { planId: number }) {
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: number; code: string; display_name: string }[]>([]);
  const [shared, setShared] = useState<{ class_id: number; code: string; display_name: string }[]>([]);
  const [selected, setSelected] = useState<number | "">("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.classes.list().then(cs => setClasses(cs.map(c => ({ id: c.id, code: c.code, display_name: c.display_name })))).catch(() => {});
    api.stundenplaner.classShares.list(planId).then(setShared).catch(() => {});
  }, [planId]);

  const sharedIds = new Set(shared.map(s => s.class_id));
  const available = classes.filter(c => !sharedIds.has(c.id));

  async function add() {
    if (!selected) return;
    setAdding(true);
    try {
      const share = await api.stundenplaner.classShares.add(planId, Number(selected));
      setShared(prev => [...prev, share]);
      setSelected("");
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    } finally {
      setAdding(false);
    }
  }

  async function remove(classId: number) {
    try {
      await api.stundenplaner.classShares.remove(planId, classId);
      setShared(prev => prev.filter(s => s.class_id !== classId));
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <select value={selected} onChange={e => setSelected(e.target.value ? Number(e.target.value) : "")} className="input text-sm py-2 flex-1 min-w-0">
          <option value="">Klasse wählen…</option>
          {available.map(c => <option key={c.id} value={c.id}>{c.display_name} ({c.code})</option>)}
        </select>
        <button onClick={add} disabled={!selected || adding}
          className="shrink-0 w-auto rounded-lg border border-line text-fg font-semibold text-sm py-1.5 px-4 hover:bg-surface-hover transition-colors disabled:opacity-40">
          + hinzufügen
        </button>
      </div>

      {shared.length === 0 ? (
        <p className="text-xs text-muted">Noch mit keiner Klasse geteilt.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shared.map(s => (
            <li key={s.class_id} className="flex items-center justify-between text-sm">
              <span>{s.display_name} ({s.code})</span>
              <button onClick={() => remove(s.class_id)} className="text-xs text-red-400 hover:underline">entfernen</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time Bar
// ---------------------------------------------------------------------------

function TimeBar({ phasen, total }: { phasen: Phase[]; total: number }) {
  const used = phasen.reduce((s, p) => s + (p.dauer_min || 0), 0);
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const over = used > total;
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? "#f87171" : "var(--accent)" }} />
      </div>
      <span className={over ? "text-red-400 font-semibold" : ""}>{used} / {total} min</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Editor
// ---------------------------------------------------------------------------

export default function StundenplanerEditor() {
  const params = useParams();
  const router = useRouter();
  const { auth } = useAuth();
  const { toast } = useToast();
  const lessonSession = useLessonSession();
  const isTeacher = auth?.user_type === "teacher";

  const [plan, setPlan] = useState<LessonPlanOut | null>(null);
  const [refs, setRefs] = useState<ToolRefs>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  // Editable fields
  const [title, setTitle] = useState("");
  const [fach, setFach] = useState("");
  const [klasse, setKlasse] = useState("");
  const [datum, setDatum] = useState("");
  const [dauerMin, setDauerMin] = useState(45);
  const [lernziele, setLernziele] = useState<string[]>([]);
  const [phasen, setPhasen] = useState<Phase[]>([]);
  const [hausaufgaben, setHausaufgaben] = useState("");
  const [notizen, setNotizen] = useState("");

  const id = Number(params.id);

  function loadFromPlan(p: LessonPlanOut) {
    setPlan(p);
    setTitle(p.title ?? "");
    setFach(p.fach ?? "");
    setKlasse(p.klasse ?? "");
    setDatum(p.datum ?? "");
    setDauerMin(p.dauer_min ?? 45);
    setLernziele(p.lernziele ?? []);
    setPhasen(p.phasen ?? []);
    setHausaufgaben(p.hausaufgaben ?? "");
    setNotizen(p.notizen ?? "");
    setDirty(false);
  }

  useEffect(() => {
    if (!auth || !isTeacher) return;
    Promise.all([
      api.stundenplaner.get(id),
      api.stundenplaner.toolRefs(),
    ]).then(([p, r]) => {
      loadFromPlan(p);
      setRefs(r);
    }).catch(() => {
      toast("Planung nicht gefunden", "error");
      router.push("/stundenplaner");
    }).finally(() => setLoading(false));
  }, [auth, id]);

  function mark() { setDirty(true); }

  function buildBody() {
    return { title, fach, klasse, datum: datum || null, dauer_min: dauerMin, lernziele, phasen, hausaufgaben, notizen };
  }

  async function save() {
    if (!plan?.is_owner) return;
    setSaving(true);
    try {
      const updated = await api.stundenplaner.update(id, buildBody());
      loadFromPlan({ ...updated, shared_with: plan.shared_with });
      toast("Gespeichert", "success");
    } catch (e: any) {
      toast(e.message ?? "Fehler beim Speichern", "error");
    } finally {
      setSaving(false);
    }
  }

  async function exportieren(fmt: ExportFormat) {
    setShowExport(false);
    setExporting(fmt);
    try {
      const { datei, name } = await api.stundenplaner.export(id, fmt);
      const url = URL.createObjectURL(datei);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast(e.message ?? "Export fehlgeschlagen", "error");
    } finally {
      setExporting(null);
    }
  }

  function addPhase() {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    setPhasen(prev => [...prev, { id, name: "Neue Phase", dauer_min: 10, inhalt: "", sozialform: "Plenum", methode: "", material: "", tool_link: null }]);
    mark();
  }

  function updatePhase(i: number, p: Phase) { setPhasen(prev => prev.map((x, j) => j === i ? p : x)); mark(); }

  function movePhase(i: number, dir: -1 | 1) {
    setPhasen(prev => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
    mark();
  }

  function deletePhase(i: number) { setPhasen(prev => prev.filter((_, j) => j !== i)); mark(); }

  function addLernziel() { setLernziele(prev => [...prev, ""]); mark(); }
  function updateLernziel(i: number, v: string) { setLernziele(prev => prev.map((x, j) => j === i ? v : x)); mark(); }
  function removeLernziel(i: number) { setLernziele(prev => prev.filter((_, j) => j !== i)); mark(); }

  if (!auth || !isTeacher) return <div className="p-8 text-muted">Nur für Lehrkräfte.</div>;
  if (loading) return <div className="p-8 text-muted">Laden…</div>;
  if (!plan) return null;

  const readOnly = !plan.is_owner;
  const lessonIsThisPlan = lessonSession.session?.plan_id === plan.id;

  return (
    <div className="max-w-seite mx-auto px-4 py-6 w-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push("/stundenplaner")} className="text-sm text-muted hover:text-fg transition-colors shrink-0">
          ← Übersicht
        </button>
        <div className="flex-1" />
        {readOnly && (
          <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">Nur Ansicht · von {plan.owner_name}</span>
        )}
        <button
          onClick={() => lessonIsThisPlan ? lessonSession.setCollapsed(false) : lessonSession.start(plan.id)}
          className="btn-secondary text-sm py-1.5 px-4"
        >
          {lessonIsThisPlan ? "▶ Stunde läuft…" : "▶ Stunde starten"}
        </button>
        {plan.is_owner && (
          <button onClick={() => setShowShare(v => !v)} className="btn-secondary text-sm py-1.5 px-4">
            👥 Teilen {plan.shared_with.length > 0 ? `(${plan.shared_with.length})` : ""}
          </button>
        )}
        {!readOnly && (
          <button onClick={save} disabled={saving || !dirty} className="btn-primary text-sm py-1.5 px-5">
            {saving ? "Speichere…" : dirty ? "💾 Speichern" : "Gespeichert"}
          </button>
        )}
        <div className="relative">
          <button onClick={() => setShowExport(v => !v)} disabled={exporting !== null}
            className="btn-secondary text-sm py-1.5 px-3" title="Als Dokument exportieren">
            {exporting ? "Exportiere…" : "📄 Export ▾"}
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-line rounded-xl overflow-hidden shadow-lg min-w-48">
              {EXPORT_FORMATE.map(([fmt, label]) => (
                <button key={fmt} onClick={() => exportieren(fmt)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors">
                  {label}
                </button>
              ))}
              {dirty && <p className="px-3 py-2 text-xs text-muted border-t border-line">Ungespeicherte Änderungen fehlen im Export.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Share panel */}
      {showShare && plan.is_owner && (
        <div className="bg-surface border border-line rounded-xl p-4 mb-6">
          <div className="font-semibold text-sm mb-3">Planung teilen</div>
          <SharePanel plan={plan} onUpdate={p => setPlan(p)} />
          <div className="font-semibold text-sm mt-5 mb-3">Mit Klasse teilen</div>
          <ClassSharePanel planId={plan.id} />
        </div>
      )}

      {/* Two-column layout on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-6">
        {/* Left: Kopfdaten */}
        <div className="flex flex-col gap-5">
          <section className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
            <div className="font-semibold text-sm text-muted uppercase tracking-wide">Kopfdaten</div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Titel *</label>
              <input value={title} onChange={e => { setTitle(e.target.value); mark(); }} disabled={readOnly} className="input text-sm py-2" placeholder="Stundentitel" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex flex-col gap-1 flex-1 min-w-28">
                <label className="text-xs text-muted">Fach</label>
                <select value={fach} onChange={e => { setFach(e.target.value); mark(); }} disabled={readOnly} className="input text-sm py-2">
                  {FAECHER.map(f => <option key={f} value={f}>{f || "—"}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-20">
                <label className="text-xs text-muted">Klasse</label>
                <input value={klasse} onChange={e => { setKlasse(e.target.value); mark(); }} disabled={readOnly} className="input text-sm py-2" placeholder="z.B. 7b" />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-muted">Datum</label>
                <input type="date" value={datum} onChange={e => { setDatum(e.target.value); mark(); }} disabled={readOnly} className="input text-sm py-2" />
              </div>
              <div className="flex flex-col gap-1 w-24 shrink-0">
                <label className="text-xs text-muted">Dauer (min)</label>
                <input type="number" min={1} max={300} value={dauerMin} onChange={e => { setDauerMin(Number(e.target.value)); mark(); }} disabled={readOnly} className="input text-sm py-2" />
              </div>
            </div>
          </section>

          {/* Lernziele */}
          <section className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
            <div className="font-semibold text-sm text-muted uppercase tracking-wide">Lernziele</div>
            {lernziele.map((z, i) => (
              <div key={i} className="flex gap-2 items-start">
                <textarea
                  value={z}
                  onChange={e => updateLernziel(i, e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  placeholder={`SuS können …`}
                  className="input text-sm flex-1 resize-none"
                />
                {!readOnly && (
                  <button onClick={() => removeLernziel(i)} className="text-red-400 text-xs mt-2 hover:underline shrink-0">✕</button>
                )}
              </div>
            ))}
            {!readOnly && lernziele.length < 10 && (
              <button onClick={addLernziel} className="text-xs text-muted hover:text-accent border border-dashed border-line rounded-lg py-1.5 hover:border-accent transition-colors">
                + Lernziel
              </button>
            )}
          </section>

          {/* Hausaufgaben */}
          <section className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2">
            <div className="font-semibold text-sm text-muted uppercase tracking-wide">Hausaufgaben</div>
            <textarea value={hausaufgaben} onChange={e => { setHausaufgaben(e.target.value); mark(); }} disabled={readOnly} rows={2} placeholder="Hausaufgabe aufgeben…" className="input text-sm resize-y" />
          </section>

          {/* Notizen */}
          <section className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2">
            <div className="font-semibold text-sm text-muted uppercase tracking-wide">Notizen / Differenzierung</div>
            <textarea value={notizen} onChange={e => { setNotizen(e.target.value); mark(); }} disabled={readOnly} rows={3} placeholder="Interne Notizen, Differenzierungshinweise…" className="input text-sm resize-y" />
          </section>
        </div>

        {/* Right: Verlaufsplanung */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm text-muted uppercase tracking-wide">Verlaufsplanung</div>
            <span className="text-xs text-muted">{phasen.length} Phasen</span>
          </div>

          <TimeBar phasen={phasen} total={dauerMin} />

          <div className="flex flex-col gap-3">
            {phasen.map((p, i) => (
              <PhaseCard
                key={i}
                phase={p}
                index={i}
                total={phasen.length}
                refs={refs}
                planId={plan.id}
                klasse={klasse}
                readOnly={readOnly}
                onChange={readOnly ? () => {} : (np) => updatePhase(i, np)}
                onMove={readOnly ? () => {} : (dir) => movePhase(i, dir)}
                onDelete={readOnly ? () => {} : () => deletePhase(i)}
              />
            ))}
          </div>

          {!readOnly && phasen.length < 15 && (
            <button onClick={addPhase} className="border border-dashed border-line rounded-xl py-3 text-sm text-muted hover:text-accent hover:border-accent transition-colors">
              + Phase hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          nav, aside, button, .no-print { display: none !important; }
          body { font-size: 11pt; }
          .max-w-4xl { max-width: 100%; padding: 0; }
          .grid { display: block; }
          section { break-inside: avoid; margin-bottom: 12pt; border: 1px solid #ccc; padding: 8pt; border-radius: 4pt; }
        }
      `}</style>
    </div>
  );
}
