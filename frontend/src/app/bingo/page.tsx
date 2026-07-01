"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, BingoOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

type PairDraft = { caller: string; answer: string };

const BLANK = (): PairDraft => ({ caller: "", answer: "" });

const STATUS_LABEL: Record<string, string> = {
  waiting: "Wartend", active: "Läuft", closed: "Beendet",
};

const AI_PROMPT = `Create a Bingo card set in JSON format for classroom use.

Format:
{
  "title": "<descriptive title>",
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

Topic: [DESCRIBE YOUR TOPIC HERE, e.g. "English vocab: animals, A1 level, English caller → German answer"]`;

export default function BingoPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";

  const [title, setTitle] = useState("");
  const [gridRows, setGridRows] = useState(5);
  const [gridCols, setGridCols] = useState(4);
  const [pairs, setPairs] = useState<PairDraft[]>(() => Array.from({ length: 20 }, BLANK));
  const [showAi, setShowAi] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: sessions = [], isLoading } = useQuery<BingoOut[]>({
    queryKey: ["bingo"],
    queryFn: () => api.bingo.list(),
    staleTime: 30_000,
  });

  function updatePair(i: number, field: keyof PairDraft, val: string) {
    setPairs(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  function handleGridChange(rows: number, cols: number) {
    setGridRows(rows);
    setGridCols(cols);
    const cells = rows * cols;
    setPairs(prev => {
      if (prev.length < cells) return [...prev, ...Array.from({ length: cells - prev.length }, BLANK)];
      return prev;
    });
  }

  function handleJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.title) setTitle(data.title);
        const rows = data.grid_size ?? 5;
        const cols = data.grid_cols ?? 4;
        setGridRows(rows);
        setGridCols(cols);
        if (Array.isArray(data.pairs)) {
          setPairs(data.pairs.map((p: any) => ({ caller: String(p.caller ?? ""), answer: String(p.answer ?? "") })));
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

  const createMut = useMutation({
    mutationFn: () => {
      const validPairs = pairs.filter(p => p.caller.trim() && p.answer.trim());
      if (validPairs.length < cells) {
        throw new Error(`Mindestens ${cells} vollständige Paare benötigt`);
      }
      return api.bingo.create({ title, grid_size: gridRows, grid_cols: gridCols, pairs: validPairs });
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["bingo"] });
      router.push(`/bingo/host/${s.code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.bingo.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bingo"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🎰 Bingo</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Vokabeln, Gleichungen, Daten – als Bingo-Spiel für die Klasse.
        </p>
      </div>

      {canEdit && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Neue Bingo-Runde</h2>
            <div className="flex gap-2">
              <a
                href="/api/bingo/template"
                download="bingo_vorlage.json"
                className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:border-gray-500 transition-colors"
              >
                Vorlage
              </a>
              <label className="text-xs px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity">
                JSON importieren
                <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleJsonFile} />
              </label>
            </div>
          </div>

          {/* AI instructions */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setShowAi(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <span>🤖 Mit KI erstellen</span>
              <span>{showAi ? "▲" : "▼"}</span>
            </button>
            {showAi && (
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] pt-3 leading-relaxed">
                  Kopiere den Prompt, füge ihn in ChatGPT, Claude oder ein anderes KI-Tool ein,
                  passe das Thema am Ende an, und importiere die erzeugte JSON-Datei oben.
                </p>
                <pre className="text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 whitespace-pre-wrap leading-relaxed text-[var(--text-muted)] max-h-48 overflow-y-auto">
                  {AI_PROMPT}
                </pre>
                <button
                  onClick={copyPrompt}
                  className="self-start text-xs px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  {copied ? "✓ Kopiert!" : "Prompt kopieren"}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              className="input flex-1 min-w-[200px]"
              placeholder="Titel (z. B. English Vokabeln – Tiere)"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <select
              className="input w-44"
              value={`${gridRows}x${gridCols}`}
              onChange={e => {
                const [r, c] = e.target.value.split("x").map(Number);
                handleGridChange(r, c);
              }}
            >
              <option value="3x3">3 × 3 (9 Felder)</option>
              <option value="4x4">4 × 4 (16 Felder)</option>
              <option value="5x4">5 × 4 (20 Felder)</option>
              <option value="5x5">5 × 5 (25 Felder)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-[var(--text-muted)] px-1">
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
                  className="text-[var(--text-muted)] hover:text-red-400 text-lg w-6">✕</button>
              </div>
            ))}
            <button onClick={() => setPairs(prev => [...prev, BLANK()])}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] self-start mt-1">
              + Paar hinzufügen
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => createMut.mutate()}
              disabled={!title.trim() || validCount < cells || createMut.isPending}
              className="btn-primary"
            >
              {createMut.isPending ? "Erstelle…" : "Bingo starten"}
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              {validCount}/{cells} Paare ausgefüllt
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : sessions.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm">
          Noch keine Bingo-Runden.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map(s => (
            <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{s.title}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {s.grid_size}×{(s as any).grid_cols ?? s.grid_size} · {s.total_pairs} Paare · {STATUS_LABEL[s.status] ?? s.status}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => router.push(`/bingo/host/${s.code}`)}
                  className="btn-secondary text-xs py-1 px-3">Öffnen</button>
                {canEdit && (
                  <button onClick={() => deleteMut.mutate(s.code)}
                    className="text-xs border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-3 py-1 transition-colors">
                    Löschen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
