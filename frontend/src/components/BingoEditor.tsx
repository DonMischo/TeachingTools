"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

type PairDraft = { caller: string; answer: string };
const BLANK = (): PairDraft => ({ caller: "", answer: "" });

const AI_PROMPT = `Create a Bingo card set in JSON format for classroom use.

Format:
{
  "title": "<descriptive title>",
  "subject": "<school subject, e.g. Englisch, Mathematik, Biologie>",
  "tags": ["<tag1>", "<tag2>"],
  "description": "<optional short description for teachers>",
  "max_points": 10,
  "grid_size": 5,
  "grid_cols": 4,
  "pairs": [
    { "caller": "<what the teacher calls out>", "answer": "<what appears on the student card>" },
    ...
  ]
}

Rules:
- Provide at least 30 pairs (more = better, students get random subsets)
- "caller" = the question, definition, or prompt the teacher reads aloud
- "answer" = the short term/word that appears on the student's bingo card
- Keep answers short (1–3 words ideally)
- Do not number the pairs
- "max_points" = points awarded for 100% correct; students get a proportional share based on how many called cells they correctly marked
- Choose 2–4 relevant tags (topic, level, unit name, etc.)

Topic: [DESCRIBE YOUR TOPIC HERE, e.g. "Englisch Vokabeln: Tiere, A1 level, English caller → German answer"]`;

/** Anlegen (ohne editId) oder ein vorhandenes Set bearbeiten. */
export default function BingoEditor({ editId }: { editId?: number }) {
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const { auth } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null"); return d?.title ?? ""; } catch { return ""; }
  });
  const [subject, setSubject] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null"); return d?.subject ?? ""; } catch { return ""; }
  });
  const [tagsInput, setTagsInput] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null"); return Array.isArray(d?.tags) ? d.tags.join(", ") : ""; } catch { return ""; }
  });
  const [description, setDescription] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null"); return d?.description ?? ""; } catch { return ""; }
  });
  const [maxPoints, setMaxPoints] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null"); return typeof d?.max_points === "number" ? d.max_points : 10; } catch { return 10; }
  });
  const [gridRows, setGridRows] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null"); return d?.grid_size ?? 5; } catch { return 5; }
  });
  const [gridCols, setGridCols] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null"); return d?.grid_cols ?? 4; } catch { return 4; }
  });
  const [pairs, setPairs] = useState<PairDraft[]>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem("bingo_import") ?? "null");
      if (Array.isArray(d?.pairs) && d.pairs.length > 0) {
        sessionStorage.removeItem("bingo_import");
        return d.pairs.map((p: { caller?: unknown; answer?: unknown }) => ({ caller: String(p.caller ?? ""), answer: String(p.answer ?? "") }));
      }
    } catch {}
    return Array.from({ length: 20 }, BLANK);
  });
  // Beim Bearbeiten unverändert zurückschicken — das Formular zeigt sie nicht.
  const [grades, setGrades] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(!editId);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    if (!editId) return;
    api.bingo.getSet(editId).then(s => {
      setTitle(s.title);
      setSubject(s.subject ?? "");
      setTagsInput(s.tags.join(", "));
      setDescription(s.description ?? "");
      setMaxPoints(s.max_points);
      setGridRows(s.grid_size);
      setGridCols(s.grid_cols);
      setGrades(s.grades);
      setPairs(s.pairs.map(p => ({ caller: p.caller, answer: p.answer })));
      setLoaded(true);
    }).catch((e: unknown) => toast((e as Error).message ?? "Fehler", "error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);
  const [copied, setCopied] = useState(false);

  function updatePair(i: number, field: keyof PairDraft, val: string) {
    setPairs(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  function handleGridChange(rows: number, cols: number) {
    setGridRows(rows);
    setGridCols(cols);
    const cells = rows * cols;
    setPairs(prev => prev.length < cells
      ? [...prev, ...Array.from({ length: cells - prev.length }, BLANK)]
      : prev);
  }

  function handleJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.title) setTitle(data.title);
        if (data.subject) setSubject(data.subject);
        if (Array.isArray(data.tags)) setTagsInput(data.tags.join(", "));
        if (data.description) setDescription(data.description);
        if (typeof data.max_points === "number") setMaxPoints(data.max_points);
        const rows = data.grid_size ?? 5;
        const cols = data.grid_cols ?? 4;
        setGridRows(rows);
        setGridCols(cols);
        if (Array.isArray(data.pairs)) {
          setPairs(data.pairs.map((p: { caller?: unknown; answer?: unknown }) => ({
            caller: String(p.caller ?? ""), answer: String(p.answer ?? ""),
          })));
        }
        toast("JSON importiert", "success");
      } catch {
        toast("Ungültiges JSON", "error");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(AI_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const cells = gridRows * gridCols;
  const validCount = pairs.filter(p => p.caller.trim() && p.answer.trim()).length;
  const tags = tagsInput.split(",").map((t: string) => t.trim()).filter(Boolean);

  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";

  const createMut = useMutation<{ kind: "session"; code: string } | { kind: "set" } | { kind: "edited" }>({
    mutationFn: () => {
      const validPairs = pairs.filter(p => p.caller.trim() && p.answer.trim());
      if (validPairs.length < cells) throw new Error(`Mindestens ${cells} vollständige Paare benötigt`);
      const body = {
        title, subject: subject || null, tags, description: description || null,
        max_points: maxPoints, grid_size: gridRows, grid_cols: gridCols, pairs: validPairs,
      };
      if (editId) {
        return api.bingo.updateSet(editId, { ...body, grade: grades }).then(() => ({ kind: "edited" as const }));
      }
      // Teachers create-and-host in one step; students only create the set
      // (hosting a live round stays teacher-only).
      return isTeacher
        ? api.bingo.create(body).then(s => ({ kind: "session" as const, code: s.code }))
        : api.bingo.createSet(body).then(() => ({ kind: "set" as const }));
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["bingo"] });
      qc.invalidateQueries({ queryKey: ["bingo-sets"] });
      qc.invalidateQueries({ queryKey: ["bingo-set", editId] });
      if (r.kind === "edited") router.push(`/aktivitaeten/bingo/${editId}`);
      else if (r.kind === "session") router.push(`/aktivitaeten/bingo/host/${r.code}`);
      else router.push("/aktivitaeten/bingo");
    },
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  if (!auth) {
    return <div className="p-8 text-(--text-muted)">Bitte einloggen.</div>;
  }
  if (!loaded) return <div className="p-6 text-(--text-muted) text-sm">Laden…</div>;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-(--seite-breite) mx-auto w-full">
      <div>
        <Link href={editId ? `/aktivitaeten/bingo/${editId}` : "/aktivitaeten/bingo"} className="text-sm text-(--text-muted) hover:text-(--text)">← Bingo</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">{editId ? "Bingo bearbeiten" : "Neue Bingo-Runde"}</h1>
      </div>

      {/* Import + grid */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select
          className="input w-44"
          value={`${gridRows}x${gridCols}`}
          onChange={e => {
            const n = Number(e.target.value.split("x")[0]);
            handleGridChange(n, n);
          }}
        >
          <option value="3x3">3 × 3 (9 Felder)</option>
          <option value="4x4">4 × 4 (16 Felder)</option>
          <option value="5x5">5 × 5 (25 Felder)</option>
        </select>
        <div className="flex gap-2">
          <a href="/api/bingo/template" download="bingo_vorlage.json"
            className="text-xs px-3 py-1.5 border border-(--border) rounded-lg text-(--text-muted) hover:border-gray-500 transition-colors">
            Vorlage
          </a>
          <label className="text-xs px-3 py-1.5 bg-(--accent) text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity">
            JSON importieren
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleJsonFile} />
          </label>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 flex-wrap">
          <input className="input flex-1 min-w-[200px]" placeholder="Titel *"
            value={title} onChange={e => setTitle(e.target.value)} />
          <input className="input w-44" placeholder="Fach (z. B. Englisch)"
            value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="flex gap-3 flex-wrap">
          <input className="input flex-1" placeholder="Tags, kommagetrennt (z. B. Vokabeln, A1, Tiere)"
            value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-(--text-muted) shrink-0">
            Punkte (bei 100% richtig)
            <input className="input w-20" type="number" min={0} title="Punkte, die bei vollständig korrekt markierter Karte vergeben werden"
              value={maxPoints} onChange={e => setMaxPoints(Number(e.target.value))} />
          </label>
        </div>
        <input className="input" placeholder="Beschreibung (optional)"
          value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      {/* Pairs */}
      <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto pr-1">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-(--text-muted) px-1">
          <span>Aufrufen (Frage/Begriff)</span>
          <span>Antwort (auf Karte)</span>
          <span />
        </div>
        {pairs.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <input className="input text-sm py-1" placeholder={`Frage ${i + 1}`}
              value={p.caller} onChange={e => updatePair(i, "caller", e.target.value)} />
            <input className="input text-sm py-1" placeholder={`Antwort ${i + 1}`}
              value={p.answer} onChange={e => updatePair(i, "answer", e.target.value)} />
            <button onClick={() => setPairs(prev => prev.filter((_, idx) => idx !== i))}
              className="text-(--text-muted) hover:text-red-400 text-lg w-6">🗑</button>
          </div>
        ))}
        <button onClick={() => setPairs(prev => [...prev, BLANK()])}
          className="text-xs text-(--text-muted) hover:text-(--text) self-start mt-1">
          + Paar hinzufügen
        </button>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => createMut.mutate()}
          disabled={!title.trim() || validCount < cells || createMut.isPending}
          className="btn-primary"
        >
          {createMut.isPending ? (editId ? "Speichere…" : "Erstelle…") : editId ? "Speichern" : "Bingo starten"}
        </button>
        <span className="text-xs text-(--text-muted)">{validCount}/{cells} Paare ausgefüllt</span>
      </div>

      {/* AI instructions — at bottom */}
      <div className="rounded-xl border border-(--border) overflow-hidden">
        <button
          onClick={() => setShowAi(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-(--text-muted) hover:bg-(--surface-hover) transition-colors"
        >
          <span>🤖 Mit KI erstellen</span>
          <span>{showAi ? "▲" : "▼"}</span>
        </button>
        {showAi && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t border-(--border)">
            <p className="text-xs text-(--text-muted) pt-3 leading-relaxed">
              Kopiere den Prompt, füge ihn in ChatGPT, Claude oder ein anderes KI-Tool ein,
              passe das Thema am Ende an, und importiere die erzeugte JSON-Datei oben.
            </p>
            <pre className="text-xs bg-(--bg) border border-(--border) rounded-lg p-3 whitespace-pre-wrap leading-relaxed text-(--text-muted) max-h-48 overflow-y-auto">
              {AI_PROMPT}
            </pre>
            <button
              onClick={copyPrompt}
              className="self-start text-xs px-3 py-1.5 bg-(--accent) text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              {copied ? "✓ Kopiert!" : "Prompt kopieren"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
