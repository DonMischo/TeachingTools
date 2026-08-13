"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, ClassOut, StudentOut, SeatingItem, SeatingItemKind, SeatingPlanSummary,
} from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

// Base item footprints in mm — MUST match api/seating_export.py ITEM_SIZES + SIZE_FACTOR.
// SIZE_FACTOR scales every element relative to the A4 canvas (kept in sync BE/FE).
const SIZE_FACTOR = 0.5;
// Sizes chosen so every default (base × SIZE_FACTOR) lands on whole 5 mm grid
// cells: table1 4×4, table2/Lehrertisch 10×4, chair 3×3, Schrank 6×3,
// Tafel 15×1, Smartboard 9×1, Sonstiges 5×3.
const BASE_ITEM_SIZES: Record<SeatingItemKind, { w: number; h: number; seats: number; label: string }> = {
  table1:     { w: 40,  h: 40, seats: 1, label: "Einzeltisch" },
  table2:     { w: 100, h: 40, seats: 2, label: "Doppeltisch" },
  teacher:    { w: 100, h: 40, seats: 0, label: "Lehrertisch" },
  chair:      { w: 30,  h: 30, seats: 1, label: "Stuhl" },
  cabinet:    { w: 60,  h: 30, seats: 0, label: "Schrank" },
  board:      { w: 150, h: 10, seats: 0, label: "Tafel" },
  smartboard: { w: 150, h: 10, seats: 0, label: "Smartboard" },
  custom:     { w: 50,  h: 30, seats: 0, label: "Sonstiges" },
};
const ITEM_SIZES = Object.fromEntries(
  Object.entries(BASE_ITEM_SIZES).map(([k, v]) => [k, { ...v, w: v.w * SIZE_FACTOR, h: v.h * SIZE_FACTOR }])
) as Record<SeatingItemKind, { w: number; h: number; seats: number; label: string }>;

const PALETTE: SeatingItemKind[] = ["table1", "table2", "teacher", "chair", "cabinet", "board", "smartboard", "custom"];
const KIND_EMOJI: Record<SeatingItemKind, string> = {
  table1: "🪑", table2: "🪑🪑", teacher: "🧑‍🏫", chair: "💺", cabinet: "🗄️", board: "🟩", smartboard: "📺", custom: "📦",
};
const KIND_FILL: Record<SeatingItemKind, string> = {
  table1: "#eef2ff", table2: "#eef2ff", teacher: "#fef3c7", chair: "#e0f2fe", cabinet: "#f3f4f6",
  board: "#e5e7eb", smartboard: "#e0e7ff", custom: "#f3f4f6",
};

const SCHULBEGLEITER = "__sb__";

const SNAP_STEP = 5; // mm
const PRINT_MARGIN_MM = 5; // safe-area kept clear of the paper edge
// Font sizes in mm (physical), shared with the PDF export so the on-screen text
// keeps the same size-to-object ratio as the printout. Rendered on screen as
// mm × scale; the PDF uses the mm value directly.
const PRIMARY_FONT_MM = 5.0; // tables + inventory labels
const CHAIR_FONT_MM = 2.6;   // chairs (wraps)
// Student desks keep a fixed grid-aligned footprint; everything else
// (Lehrertisch, chairs, inventory) is resizable via the per-item scale.
const FIXED_SIZE: Set<SeatingItemKind> = new Set(["table1", "table2"]);
const isResizable = (k: SeatingItemKind) => !FIXED_SIZE.has(k);
const SCALE_MIN = 0.4, SCALE_MAX = 3, SCALE_STEP = 0.2;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// Effective footprint in mm (base × per-axis scale). `seats` count is unaffected.
function effSize(it: SeatingItem) {
  const b = ITEM_SIZES[it.kind];
  return { w: b.w * (it.scaleX || 1), h: b.h * (it.scaleY || 1), seats: b.seats };
}

function pageDims(orientation: "landscape" | "portrait") {
  return orientation === "portrait" ? { w: 210, h: 297 } : { w: 297, h: 210 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

function shortName(s: StudentOut | undefined): string {
  if (!s) return "";
  return `${s.vorname} ${s.nachname ? s.nachname[0] + "." : ""}`.trim();
}

function fullName(s: StudentOut | undefined): string {
  if (!s) return "";
  return `${s.vorname} ${s.nachname}`.trim();
}

// Dynamic font (mm): shrink `baseMm` just enough that the longest word fits
// `availMm` (rough width ≈ 0.55·font per char). Text also wraps, so multi-word
// labels use several lines instead of overflowing. Deterministic (no DOM
// measuring), so it renders identically on screen and in the A4 print.
function fitFontMm(text: string, availMm: number, baseMm: number): number {
  const longest = text.trim().split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  const byWord = availMm / (longest * 0.55);
  return Math.max(1.6, Math.min(baseMm, byWord));
}

function newItem(kind: SeatingItemKind, count: number): SeatingItem {
  const size = ITEM_SIZES[kind];
  return {
    id: uid(),
    kind,
    x: 20 + (count % 6) * 8,
    y: 20 + (count % 6) * 8,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    locked: false,
    label: null,
    seats: Array.from({ length: size.seats }, () => ({ id: uid(), student_id: null, label: null, locked: false })),
  };
}

export default function SitzplanPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  const classId = Number(params.classId);
  const isTeacher = auth?.user_type === "teacher";
  const isAdmin = auth?.teacher?.role === "admin";

  // ── Data ──
  const { data: classes = [] } = useQuery<ClassOut[]>({ queryKey: ["classes"], queryFn: api.classes.list });
  const cls = classes.find(c => c.id === classId);

  // Students only reach this page as a granted Klassensprecher of THIS class.
  const { data: myMgmt } = useQuery<{ class_id: number | null }>({
    queryKey: ["my-management"], queryFn: api.classes.myManagement, enabled: !!auth && !isTeacher,
  });
  const grantedHere = !isTeacher && myMgmt?.class_id === classId;
  useEffect(() => {
    if (auth && !isTeacher && myMgmt && myMgmt.class_id !== classId) router.replace("/");
  }, [auth, isTeacher, myMgmt, classId, router]);

  // Teachers get the full roster; a granted Klassensprecher gets the minimal one
  // (names + Geschlecht) that class-manager access allows.
  const { data: teacherStudents = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", classId],
    queryFn: () => api.students.list({ klasse: cls!.code }),
    enabled: !!cls && isTeacher,
  });
  const { data: roster = [] } = useQuery({
    queryKey: ["roster", classId], queryFn: () => api.classes.roster(classId),
    enabled: !!cls && grantedHere,
  });
  const students: StudentOut[] = useMemo(() => isTeacher ? teacherStudents : roster.map(r => ({
    id: r.id, nummer: null, nachname: r.nachname, vorname: r.vorname, klasse: cls?.code ?? "",
    class_id: classId, jahrgang: null, geschlecht: r.geschlecht, geburtsdatum: null,
    username: null, active: true, has_credentials: false,
  })), [isTeacher, teacherStudents, roster, cls?.code, classId]);
  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const { data: plans = [] } = useQuery<SeatingPlanSummary[]>({
    queryKey: ["seating", classId],
    queryFn: () => api.seating.list(classId),
  });

  const [planId, setPlanId] = useState<number | null>(null);
  useEffect(() => {
    if (planId == null && plans.length > 0) setPlanId(plans[0].id);
    if (planId != null && plans.length > 0 && !plans.some(p => p.id === planId)) setPlanId(plans[0].id);
  }, [plans, planId]);

  const { data: detail } = useQuery({
    queryKey: ["seating-plan", planId],
    queryFn: () => api.seating.get(planId!),
    enabled: planId != null,
    staleTime: Infinity,
  });

  // The default "Klassenraum" (first/lowest-id plan) is editable only by the
  // Klassenlehrer/admin; additional rooms by any teacher or granted
  // Klassensprecher. Mirrors the backend (api/routers/seating.py).
  const mayEditAdditional = isTeacher || grantedHere;
  const isClassTeacher = isAdmin || auth?.teacher?.klasse_id === classId;
  const isDefaultPlan = plans.length > 0 && planId === plans[0].id;
  const canEdit = isDefaultPlan ? isClassTeacher : mayEditAdditional;

  // ── Editable local state (autosaved) ──
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [items, setItems] = useState<SeatingItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState(false);
  const [alternate, setAlternate] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const savedRef = useRef<string>("");

  // Load a plan's detail into local state (only when the plan id changes).
  useEffect(() => {
    if (!detail || detail.id !== planId) return;
    setName(detail.name);
    setOrientation(detail.orientation);
    setItems(detail.items);
    setSelectedId(null);
    savedRef.current = JSON.stringify({ name: detail.name, orientation: detail.orientation, items: detail.items });
    setSaveState("saved");
  }, [detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autosave (only when the current user may edit this plan).
  useEffect(() => {
    if (planId == null || !canEdit) return;
    const payload = { name, orientation, items };
    const ser = JSON.stringify(payload);
    if (ser === savedRef.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const updated = await api.seating.update(planId, payload);
        savedRef.current = ser;
        setSaveState("saved");
        // Keep the cached detail truthful so switching away and back doesn't
        // serve the stale (pre-edit) copy — the query uses staleTime: Infinity
        // and would otherwise never refetch. (id unchanged → no reload effect.)
        qc.setQueryData(["seating-plan", planId], updated);
        qc.invalidateQueries({ queryKey: ["seating", classId] });
      } catch {
        setSaveState("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [name, orientation, items, planId, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvasRef = useRef<HTMLDivElement>(null);
  const dims = pageDims(orientation);
  // Fonts are sized in container-query width units (cqw = 1% of the canvas
  // width). Since the canvas is dims.w mm wide, `mm/dims.w*100` cqw == that many
  // mm — resolution-independent, so it renders identically on screen and when
  // the canvas is blown up to A4 for print (no measured px scale needed).
  const cqw = (mm: number, floorPx: number) => `max(${floorPx}px, ${((mm / dims.w) * 100).toFixed(3)}cqw)`;

  // ── Item mutations ──
  const patchItem = (id: string, patch: Partial<SeatingItem>) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = (kind: SeatingItemKind) => {
    const it = newItem(kind, items.length);
    setItems(prev => [...prev, it]);
    setSelectedId(it.id);
  };
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const rotate = (id: string) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, rotation: (it.rotation + 45) % 360 } : it)));
  const toggleLock = (id: string) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, locked: !it.locked } : it)));

  const setSeatOccupant = (itemId: string, seatId: string, patch: { student_id?: number | null; label?: string | null }) =>
    setItems(prev => prev.map(it => it.id === itemId
      ? { ...it, seats: it.seats.map(s => (s.id === seatId ? { ...s, ...patch } : s)) }
      : it));
  const toggleSeatLock = (itemId: string, seatId: string) =>
    setItems(prev => prev.map(it => it.id === itemId
      ? { ...it, seats: it.seats.map(s => (s.id === seatId ? { ...s, locked: !s.locked } : s)) }
      : it));

  // ── Drag (percentage-based; math derives mm from the live canvas rect, so it
  // never depends on a possibly-stale measured scale) ──
  const drag = useRef<{ id: string; offX: number; offY: number } | null>(null);
  function pointerToMm(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (dims.w / rect.width),
      y: (e.clientY - rect.top) * (dims.h / rect.height),
    };
  }
  function onItemPointerDown(e: React.PointerEvent, it: SeatingItem) {
    setSelectedId(it.id);
    if (!canEdit || it.locked) return;
    e.preventDefault();
    const p = pointerToMm(e);
    drag.current = { id: it.id, offX: p.x - it.x, offY: p.y - it.y };
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function onCanvasPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const size = effSize(items.find(i => i.id === d.id)!);
    const p = pointerToMm(e);
    let nx = p.x - d.offX;
    let ny = p.y - d.offY;
    nx = Math.max(PRINT_MARGIN_MM, Math.min(dims.w - PRINT_MARGIN_MM - size.w, nx));
    ny = Math.max(PRINT_MARGIN_MM, Math.min(dims.h - PRINT_MARGIN_MM - size.h, ny));
    if (snap) { nx = Math.round(nx / SNAP_STEP) * SNAP_STEP; ny = Math.round(ny / SNAP_STEP) * SNAP_STEP; }
    patchItem(d.id, { x: nx, y: ny });
  }
  function onCanvasPointerUp(e: React.PointerEvent) {
    if (drag.current) { try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch {} }
    drag.current = null;
  }

  // Print to PDF. The browser's Save-as-PDF dialog takes its default filename
  // from document.title, so name it "<Klasse>_<YYYYMMDD>" (e.g. 10c_20260813)
  // for the duration of the print, then restore the page title.
  function printPdf() {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const prev = document.title;
    document.title = `${cls?.code ?? "Sitzplan"}_${ymd}`;
    window.print();
    setTimeout(() => { document.title = prev; }, 500);
  }

  // Clear every unlocked seat on an unlocked item (locked seats/items keep theirs).
  function emptySeats() {
    setItems(prev => prev.map(it =>
      it.locked ? it : { ...it, seats: it.seats.map(s => (s.locked ? s : { ...s, student_id: null, label: null })) }
    ));
  }

  // ── Randomizer ──
  function randomAssign() {
    // Seats that stay put: locked items/seats, and seats occupied by a
    // Schulbegleiter (label). Students fixed in those seats are held out of the
    // shuffle pool so they aren't also placed elsewhere.
    const slots: { itemId: string; seatId: string; x: number; y: number }[] = [];
    const fixedStudentIds = new Set<number>();
    for (const it of items) {
      it.seats.forEach((seat, idx) => {
        const available = !it.locked && !seat.locked && !seat.label;
        if (available) {
          slots.push({ itemId: it.id, seatId: seat.id, x: it.x + idx, y: it.y });
        } else if (seat.student_id != null) {
          fixedStudentIds.add(seat.student_id);
        }
      });
    }
    slots.sort((a, b) => a.y - b.y || a.x - b.x);

    const available = students.filter(s => !fixedStudentIds.has(s.id));
    let pool: StudentOut[];
    if (alternate) {
      const boys = shuffle(available.filter(s => s.geschlecht === "männlich"));
      const girls = shuffle(available.filter(s => s.geschlecht === "weiblich"));
      const others = shuffle(available.filter(s => s.geschlecht !== "männlich" && s.geschlecht !== "weiblich"));
      pool = interleave(boys, girls).concat(others);
    } else {
      pool = shuffle(available);
    }

    const assign = new Map<string, number | null>();
    slots.forEach((slot, i) => assign.set(`${slot.itemId}:${slot.seatId}`, pool[i]?.id ?? null));
    setItems(prev => prev.map(it => ({
      ...it,
      seats: it.seats.map(seat => {
        const key = `${it.id}:${seat.id}`;
        return assign.has(key) ? { ...seat, student_id: assign.get(key)! } : seat;
      }),
    })));
    if (slots.length < students.length) {
      toast(`${students.length - slots.length} Schüler:innen ohne Platz — mehr Tische hinzufügen.`, "info");
    }
  }

  // ── Plan management mutations ──
  const createMut = useMutation({
    mutationFn: (planName: string) => api.seating.create(classId, { name: planName || "Klassenraum" }),
    onSuccess: (p) => {
      // Seed the detail cache and add the new plan to the list *before* selecting
      // it, so the plan-selection guard (which resets planId when the list lacks
      // it) doesn't bounce us to an old plan while the list refetch is in flight.
      qc.setQueryData(["seating-plan", p.id], p);
      qc.setQueryData<SeatingPlanSummary[]>(["seating", classId], (old = []) =>
        old.some(x => x.id === p.id) ? old : [...old, p]);
      qc.invalidateQueries({ queryKey: ["seating", classId] });
      setPlanId(p.id);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.seating.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["seating", classId] }); setPlanId(null); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const selected = items.find(i => i.id === selectedId) ?? null;
  const usedIds = new Set(items.flatMap(it => it.seats.map(s => s.student_id).filter((x): x is number => x != null)));

  // Ungranted student (or grant still resolving) — render nothing while the
  // guard redirect settles.
  if (!auth || (!isTeacher && !grantedHere)) return null;

  // ── No-plan empty state ──
  if (plans.length === 0) {
    return (
      <div className="p-6 flex flex-col gap-6 min-h-full">
        <BackBar cls={cls} router={router} />
        <div className="flex flex-col items-center justify-center gap-4 flex-1 py-20 text-center">
          <div className="text-6xl">🪑</div>
          <p className="text-lg font-semibold">Noch kein Sitzplan für {cls?.code ?? "diese Klasse"}</p>
          {isClassTeacher ? (
            <button
              onClick={() => createMut.mutate("Klassenraum")}
              disabled={createMut.isPending}
              className="px-5 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              + Klassenraum anlegen
            </button>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Die Klassenleitung muss zuerst einen Klassenraum anlegen.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 min-h-full">
      {/* Print: show ONLY the canvas, filling an exact A4 page in the plan's
          orientation. The printout is therefore pixel-identical to this view. */}
      <style>{`
        @media print {
          @page { size: ${dims.w}mm ${dims.h}mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .sitzplan-print, .sitzplan-print * { visibility: visible !important; }
          .sitzplan-print {
            position: fixed !important; left: 0; top: 0;
            width: ${dims.w}mm !important; height: ${dims.h}mm !important;
            aspect-ratio: auto !important;
            border: none !important; border-radius: 0 !important; box-shadow: none !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
      <BackBar cls={cls} router={router} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3">
        {/* Plan selector */}
        <select
          value={planId ?? ""}
          onChange={e => setPlanId(Number(e.target.value))}
          className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm font-semibold"
        >
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {mayEditAdditional && (
          <button
            onClick={() => { const n = prompt("Name des Raums:", "Klassenraum"); if (n !== null) createMut.mutate(n.trim()); }}
            className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
          >+ Raum</button>
        )}
        {planId != null && canEdit && (
          <button
            onClick={() => { if (confirm(`Raum „${name}" löschen?`)) deleteMut.mutate(planId); }}
            className="text-sm px-2.5 py-1.5 rounded-lg text-red-400 border border-red-900/40 hover:bg-red-900/20"
          >🗑</button>
        )}

        {canEdit ? (
          <>
            <span className="w-px h-6 bg-[var(--border)] mx-1" />

            {/* Room name */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm w-40"
              placeholder="Raumname"
            />

            {/* Orientation */}
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs">
              {(["landscape", "portrait"] as const).map(o => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`px-3 py-1.5 font-semibold ${orientation === o ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)]"}`}
                >{o === "landscape" ? "Querformat" : "Hochformat"}</button>
              ))}
            </div>

            {/* Snap */}
            <button
              onClick={() => setSnap(s => !s)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${snap ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
            >🧲 Raster {snap ? "an" : "aus"}</button>

            {/* Fit all items into the 5 mm print area */}
            <button
              onClick={() => setItems(prev => prev.map(it => {
                const s = effSize(it);
                return {
                  ...it,
                  x: Math.max(PRINT_MARGIN_MM, Math.min(dims.w - PRINT_MARGIN_MM - s.w, it.x)),
                  y: Math.max(PRINT_MARGIN_MM, Math.min(dims.h - PRINT_MARGIN_MM - s.h, it.y)),
                };
              }))}
              title="Alle Elemente in den 5-mm-Druckbereich verschieben"
              className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >🖨 Einpassen</button>
          </>
        ) : (
          <span className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--surface-hover)] text-[var(--text-muted)]">
            👁 Nur ansehen{isDefaultPlan ? " · Klassenraum (nur Klassenleitung)" : ""}
          </span>
        )}

        <span className="flex-1" />

        {/* Save state */}
        {canEdit && (
          <span className="text-xs text-[var(--text-muted)]">
            {saveState === "saving" ? "Speichern…" : saveState === "error" ? "⚠️ Fehler" : "✓ Gespeichert"}
          </span>
        )}
        {planId != null && (
          <button
            onClick={printPdf}
            title="Öffnet den Druckdialog — dort „Als PDF speichern“ wählen. Der Dateiname ist Klasse + Datum, der Ausdruck exakt diese Ansicht."
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white font-semibold hover:opacity-90"
          >🖨 Als PDF (A4)</button>
        )}
      </div>

      {/* Palette */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {PALETTE.map(kind => (
            <button
              key={kind}
              onClick={() => addItem(kind)}
              className="text-sm px-3 py-2 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-2"
            >
              <span>{KIND_EMOJI[kind]}</span>{ITEM_SIZES[kind].label}
            </button>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={randomAssign}
            className="text-sm px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90"
          >🎲 Namen zufällig verteilen</button>
          <button
            onClick={emptySeats}
            title="Alle nicht gesperrten Plätze leeren (gesperrte bleiben)"
            className="text-sm px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >🧹 Plätze leeren</button>
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={alternate} onChange={e => setAlternate(e.target.checked)} className="accent-[var(--accent)] w-4 h-4" />
            Junge/Mädchen abwechselnd
          </label>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <div
            ref={canvasRef}
            onPointerDown={() => setSelectedId(null)}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            className="sitzplan-print relative w-full bg-white rounded-xl border border-[var(--border)] overflow-hidden select-none touch-none"
            style={{
              aspectRatio: `${dims.w} / ${dims.h}`,
              containerType: "inline-size",
              backgroundImage: snap
                ? `linear-gradient(#00000010 1px, transparent 1px), linear-gradient(90deg, #00000010 1px, transparent 1px)`
                : undefined,
              backgroundSize: snap ? `${(SNAP_STEP / dims.w) * 100}% ${(SNAP_STEP / dims.h) * 100}%` : undefined,
            }}
          >
            {/* 5 mm print safe-area frame */}
            <div
              className="absolute pointer-events-none border border-dashed border-[#d1d5db]"
              style={{
                left: `${(PRINT_MARGIN_MM / dims.w) * 100}%`,
                top: `${(PRINT_MARGIN_MM / dims.h) * 100}%`,
                right: `${(PRINT_MARGIN_MM / dims.w) * 100}%`,
                bottom: `${(PRINT_MARGIN_MM / dims.h) * 100}%`,
              }}
            />
            {items.map(it => {
              const size = effSize(it);
              const isSel = it.id === selectedId;
              const isChair = it.kind === "chair";
              const baseMm = isChair ? CHAIR_FONT_MM : PRIMARY_FONT_MM;
              return (
                <div
                  key={it.id}
                  onPointerDown={e => { e.stopPropagation(); onItemPointerDown(e, it); }}
                  className="absolute flex items-stretch rounded-md text-[#1f2937]"
                  style={{
                    left: `${(it.x / dims.w) * 100}%`,
                    top: `${(it.y / dims.h) * 100}%`,
                    width: `${(size.w / dims.w) * 100}%`,
                    height: `${(size.h / dims.h) * 100}%`,
                    transform: `rotate(${it.rotation}deg)`,
                    transformOrigin: "center",
                    background: KIND_FILL[it.kind],
                    border: `${isSel ? 2 : 1}px solid ${isSel ? "var(--accent)" : "#9ca3af"}`,
                    cursor: it.locked ? "not-allowed" : "grab",
                    boxShadow: isSel ? "0 0 0 2px var(--accent)33" : undefined,
                  }}
                >
                  {size.seats > 0 ? (
                    it.seats.map((seat, i) => {
                      const isSb = seat.student_id == null && !!seat.label;
                      const text = seat.student_id != null
                        ? (isChair ? fullName(studentById.get(seat.student_id)) : shortName(studentById.get(seat.student_id)))
                        : (seat.label ?? "");
                      const seatWmm = size.w / it.seats.length;
                      const fontStr = cqw(fitFontMm(text || "x", seatWmm - 2, baseMm), isChair ? 5 : 6);
                      return (
                        <div
                          key={seat.id}
                          className="relative flex-1 flex items-center justify-center px-0.5 text-center overflow-hidden"
                          style={{
                            minWidth: 0,
                            borderLeft: i > 0 ? "1px solid #9ca3af" : undefined,
                            fontSize: fontStr,
                            fontWeight: 600,
                            fontStyle: isSb ? "italic" : "normal",
                            color: isSb ? "#0369a1" : "#1f2937",
                            opacity: seat.locked ? 0.55 : 1,
                            lineHeight: 1.05,
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                          }}
                        >
                          {text}
                          {seat.locked && <span className="absolute top-0 right-0.5" style={{ fontSize: cqw(2.4, 6) }}>📌</span>}
                        </div>
                      );
                    })
                  ) : (() => {
                    const label = it.label || ITEM_SIZES[it.kind].label;
                    return (
                      <div className="flex-1 flex items-center justify-center text-[#6b7280] px-1 text-center overflow-hidden"
                        style={{ minWidth: 0, fontSize: cqw(fitFontMm(label, size.w - 3, PRIMARY_FONT_MM), 6), whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.05 }}>
                        {label}
                      </div>
                    );
                  })()}
                  {it.locked && <span className="absolute -top-1.5 -right-1.5 text-xs">🔒</span>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {orientation === "landscape" ? "A4 quer" : "A4 hoch"} · Element antippen zum Bearbeiten · ziehen zum Verschieben
          </p>
        </div>

        {/* Inspector */}
        <div className="lg:w-72 shrink-0">
          {!canEdit ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm text-[var(--text-muted)]">
              👁 Nur-Ansicht. {isDefaultPlan
                ? "Den Klassenraum bearbeitet nur die Klassenleitung — zusätzliche Räume darfst du anlegen und bearbeiten."
                : "Du hast keine Bearbeitungsrechte für diesen Raum."}
            </div>
          ) : selected ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{KIND_EMOJI[selected.kind]} {ITEM_SIZES[selected.kind].label}</span>
                <button onClick={() => removeItem(selected.id)} className="text-red-400 text-sm hover:underline">Löschen</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => rotate(selected.id)} className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]">↻ 45°</button>
                <button
                  onClick={() => toggleLock(selected.id)}
                  className={`flex-1 text-sm px-3 py-1.5 rounded-lg border ${selected.locked ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border)]"}`}
                >{selected.locked ? "🔒 Gesperrt" : "🔓 Frei"}</button>
              </div>

              {isResizable(selected.kind) && (
                <div className="flex flex-col gap-1.5">
                  {([["Breite", "scaleX"], ["Höhe", "scaleY"]] as const).map(([label, key]) => {
                    const val = selected[key] || 1;
                    const set = (v: number) => patchItem(selected.id, { [key]: Math.round(v * 10) / 10 } as Partial<SeatingItem>);
                    return (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => set(Math.max(SCALE_MIN, val - SCALE_STEP))}
                            className="w-7 h-7 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-lg leading-none"
                          >−</button>
                          <span className="text-sm tabular-nums w-12 text-center">{Math.round(val * 100)}%</span>
                          <button
                            onClick={() => set(Math.min(SCALE_MAX, val + SCALE_STEP))}
                            className="w-7 h-7 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-lg leading-none"
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {ITEM_SIZES[selected.kind].seats > 0 ? (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">Plätze</p>
                  {selected.seats.map((seat, i) => {
                    const value = seat.student_id != null ? String(seat.student_id) : seat.label ? SCHULBEGLEITER : "";
                    const isSb = seat.student_id == null && !!seat.label;
                    return (
                      <div key={seat.id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <select
                            value={value}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === "") setSeatOccupant(selected.id, seat.id, { student_id: null, label: null });
                              else if (v === SCHULBEGLEITER) setSeatOccupant(selected.id, seat.id, { student_id: null, label: seat.label || "Schulbegleiter" });
                              else setSeatOccupant(selected.id, seat.id, { student_id: Number(v), label: null });
                            }}
                            className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                          >
                            <option value="">Platz {i + 1} — frei</option>
                            <option value={SCHULBEGLEITER}>🧑‍🏫 Schulbegleiter</option>
                            <optgroup label="Schüler:innen">
                              {students.map(s => (
                                <option key={s.id} value={s.id} disabled={usedIds.has(s.id) && s.id !== seat.student_id}>
                                  {s.vorname} {s.nachname}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          <button
                            onClick={() => toggleSeatLock(selected.id, seat.id)}
                            title="Platz fixieren — wird beim Zufällig-Verteilen nicht getauscht"
                            className={`text-sm px-2 py-1.5 rounded-lg border ${seat.locked ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border)]"}`}
                          >{seat.locked ? "📌" : "📍"}</button>
                        </div>
                        {isSb && (
                          <input
                            value={seat.label ?? ""}
                            onChange={e => setSeatOccupant(selected.id, seat.id, { label: e.target.value || "Schulbegleiter" })}
                            placeholder="Name Schulbegleiter"
                            className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-1 pt-1">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Beschriftung</label>
                  <input
                    value={selected.label ?? ""}
                    onChange={e => patchItem(selected.id, { label: e.target.value || null })}
                    placeholder={ITEM_SIZES[selected.kind].label}
                    className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm text-[var(--text-muted)]">
              Kein Element ausgewählt. Aus der Palette oben ein Möbelstück hinzufügen oder ein Element im Plan antippen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackBar({ cls, router }: { cls: ClassOut | undefined; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => router.push("/haeuser")} className="self-start text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Zurück zu Häuser &amp; Klassen</button>
      <h1 className="text-2xl font-bold">🪑 Sitzplan {cls ? `— ${cls.code}${cls.class_name ? ` „${cls.class_name}"` : ""}` : ""}</h1>
    </div>
  );
}
