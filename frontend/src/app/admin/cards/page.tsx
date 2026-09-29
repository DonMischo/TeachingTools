"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useRouter } from "next/navigation";
import { api, StudentCardData } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type CardField = {
  id: string;       // stable key for React
  dbKey: string;    // field name in student.fields
  alias: string;    // label shown on card
};

// ── Default label suggestions ────────────────────────────────────────────────

const FIELD_SUGGESTIONS: Record<string, string> = {
  nummer: "Nr.",
  geschlecht: "Geschlecht",
  geburtsdatum: "Geburtsdatum",
  username: "Benutzername",
  password: "Passwort",
};

// ── Student card (preview + print) ───────────────────────────────────────────

function StudentCard({
  student,
  cardFields,
}: {
  student: StudentCardData;
  cardFields: CardField[];
}) {
  const rows = cardFields.filter(f => student.fields[f.dbKey]);

  return (
    <div
      className="student-card rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
    >
      <div className="bg-[var(--accent)] px-4 pt-3 pb-2.5">
        <div className="font-black text-[var(--accent-text)] text-base leading-tight tracking-wide uppercase">
          {student.nachname}
        </div>
        <div className="font-semibold text-[var(--accent-text)] text-sm opacity-90">
          {student.vorname}
        </div>
        <div className="text-[var(--accent-text)] text-xs opacity-70 mt-0.5 font-mono">
          {student.klasse}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="px-4 py-2.5 flex flex-col gap-1.5">
          {rows.map(f => (
            <div key={f.id} className="flex gap-2 text-xs">
              <span className="text-[var(--text-muted)] shrink-0 w-28 truncate">
                {f.alias || f.dbKey}:
              </span>
              <span className="font-mono font-medium break-all">{student.fields[f.dbKey]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Field builder ─────────────────────────────────────────────────────────────

function FieldBuilder({
  cardFields,
  onChange,
  availableKeys,
}: {
  cardFields: CardField[];
  onChange: (fields: CardField[]) => void;
  availableKeys: string[];
}) {
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!dropdownRect) return;
    function handler(e: MouseEvent) {
      const el = document.getElementById("field-add-dropdown");
      if (!el?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setDropdownRect(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownRect]);

  const usedKeys = new Set(cardFields.map(f => f.dbKey));
  const unused = availableKeys.filter(k => !usedKeys.has(k));

  function toggleDropdown() {
    if (dropdownRect) { setDropdownRect(null); return; }
    setDropdownRect(btnRef.current?.getBoundingClientRect() ?? null);
  }

  function addField(dbKey: string) {
    const alias = FIELD_SUGGESTIONS[dbKey] || dbKey;
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    onChange([...cardFields, { id, dbKey, alias }]);
    setDropdownRect(null);
  }

  function removeField(id: string) {
    onChange(cardFields.filter(f => f.id !== id));
  }

  function updateAlias(id: string, alias: string) {
    onChange(cardFields.map(f => f.id === id ? { ...f, alias } : f));
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...cardFields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Active fields list */}
      {cardFields.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] italic py-1">
          Noch keine Felder gewählt — unten hinzufügen.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {cardFields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 bg-[var(--bg)] rounded-lg px-2 py-1.5 border border-[var(--border)]">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="text-[8px] leading-none text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20 px-0.5" title="Nach oben">▲</button>
                <button onClick={() => move(i, 1)} disabled={i === cardFields.length - 1}
                  className="text-[8px] leading-none text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20 px-0.5" title="Nach unten">▼</button>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)] w-32 shrink-0 truncate" title={f.dbKey}>{f.dbKey}</span>
              <input
                type="text"
                value={f.alias}
                onChange={e => updateAlias(f.id, e.target.value)}
                placeholder={FIELD_SUGGESTIONS[f.dbKey] || f.dbKey}
                className="input text-xs py-1 flex-1 min-w-0"
                title="Bezeichnung auf der Karte"
              />
              <button onClick={() => removeField(f.id)}
                className="text-[var(--text-muted)] hover:text-red-400 transition-colors text-sm px-1 shrink-0" title="Entfernen">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        ref={btnRef}
        onClick={toggleDropdown}
        disabled={availableKeys.length === 0}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${dropdownRect ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
      >
        <span className="text-base leading-none">+</span>
        Feld hinzufügen
        {unused.length > 0 && <span className="text-[var(--text-muted)]">({unused.length} verfügbar)</span>}
        {availableKeys.length === 0 && <span className="text-[var(--text-muted)]">(Schüler laden…)</span>}
      </button>

      {/* Fixed-position dropdown — escapes any overflow:hidden parent */}
      {dropdownRect && (
        <div
          id="field-add-dropdown"
          style={{
            position: "fixed",
            top: dropdownRect.bottom + 6,
            left: dropdownRect.left,
            minWidth: Math.max(dropdownRect.width, 260),
            zIndex: 9999,
          }}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden"
        >
          {unused.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--text-muted)]">Alle verfügbaren Felder bereits hinzugefügt.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {unused.map(key => (
                <button
                  key={key}
                  onClick={() => addField(key)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--surface-hover)] flex items-center gap-3 transition-colors"
                >
                  <span className="font-mono text-xs text-[var(--text-muted)] w-36 shrink-0 truncate">{key}</span>
                  {FIELD_SUGGESTIONS[key] && (
                    <span className="text-[var(--text-muted)] text-xs">→ {FIELD_SUGGESTIONS[key]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

function StudentListRow({
  student,
  selected,
  onToggle,
  cardFields,
}: {
  student: StudentCardData;
  selected: boolean;
  onToggle: () => void;
  cardFields: CardField[];
}) {
  return (
    <tr
      onClick={onToggle}
      className={`border-b border-[var(--border)]/40 cursor-pointer transition-colors hover:bg-[var(--surface-hover)] ${selected ? "bg-[var(--accent)]/5" : ""}`}
    >
      <td className="py-2 px-3">
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={e => e.stopPropagation()} className="accent-[var(--accent)]" />
      </td>
      <td className="py-2 px-3 font-medium">{student.nachname}</td>
      <td className="py-2 px-3">{student.vorname}</td>
      <td className="py-2 px-3 font-mono text-xs">{student.klasse}</td>
      {cardFields.map(f => (
        <td key={f.id} className="py-2 px-3 font-mono text-xs text-[var(--text-muted)]">
          {student.fields[f.dbKey] ?? "–"}
        </td>
      ))}
    </tr>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StudentCardsPage() {
  const { auth } = useAuth();
  const router = useRouter();

  const [klasseFilter, setKlasseFilter] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cardFields, setCardFields] = useState<CardField[]>([]);
  const [showFieldPanel, setShowFieldPanel] = useState(true);

  const { ready: aReady, isAdmin: aAdmin, has: aHas } = useAdminAccess();
  const allowed = aAdmin || aHas("students");
  useEffect(() => {
    if (aReady && !allowed) router.replace("/");
  }, [aReady, allowed, router]);

  const { data: students = [], isLoading } = useQuery<StudentCardData[]>({
    queryKey: ["student-card-data", klasseFilter],
    queryFn: () => api.students.cardData(klasseFilter || undefined),
    staleTime: 60_000,
  });

  // All distinct field keys across loaded students
  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of students) Object.keys(s.fields).forEach(k => keys.add(k));
    return [...keys].sort();
  }, [students]);

  const classes = useMemo(() => [...new Set(students.map(s => s.klasse))].sort(), [students]);

  const displayStudents = useMemo(
    () => selected.size > 0 ? students.filter(s => selected.has(s.id)) : students,
    [students, selected]
  );

  const toggleStudent = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  function selectAll() { setSelected(new Set(students.map(s => s.id))); }
  function selectNone() { setSelected(new Set()); }

  function handlePrint() {
    const cards = displayStudents.map(student => {
      const rows = cardFields
        .filter(f => student.fields[f.dbKey])
        .map(f => {
          const label = f.alias || f.dbKey;
          const val = student.fields[f.dbKey];
          return `<div class="field-row"><span class="label">${label}:</span><span class="value">${val}</span></div>`;
        })
        .join("");

      return `<div class="card">
        <div class="card-header">
          <div class="name-last">${student.nachname}</div>
          <div class="name-first">${student.vorname}</div>
          <div class="klasse">${student.klasse}</div>
        </div>
        ${rows ? `<div class="card-body">${rows}</div>` : ""}
      </div>`;
    }).join("");

    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#3b82f6";
    const accentText = getComputedStyle(document.documentElement).getPropertyValue("--accent-text").trim() || "#fff";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Schülerkarten</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: system-ui, sans-serif; background: #fff; color: #111; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; padding: 10mm; }
      .card { border: 1px solid #ccc; border-radius: 6px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      .card-header { background: ${accent}; color: ${accentText}; padding: 8px 12px 7px; }
      .name-last { font-size: 14pt; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; line-height: 1.1; }
      .name-first { font-size: 11pt; font-weight: 600; opacity: .9; }
      .klasse { font-size: 8pt; font-family: monospace; opacity: .7; margin-top: 2px; }
      .card-body { padding: 7px 12px 9px; display: flex; flex-direction: column; gap: 4px; }
      .field-row { display: flex; gap: 6px; font-size: 8.5pt; }
      .label { color: #666; width: 90px; flex-shrink: 0; }
      .value { font-family: monospace; font-weight: 500; word-break: break-all; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body><div class="grid">${cards}</div></body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  }

  if (!auth || !aReady || !allowed) return null;

  return (
    <div className="flex flex-col gap-5 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      {/* Header */}
      <div>
        <button onClick={() => router.push("/admin")} className="mb-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Zurück</button>
        <h1 className="text-2xl font-black tracking-tight">🪪 Schülerkarten</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Felder wählen · Karten auswählen · PDF drucken</p>
      </div>

      {/* Field builder panel */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <button
          onClick={() => setShowFieldPanel(p => !p)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--surface-hover)] transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">Kartenfelder</span>
            {cardFields.length > 0 ? (
              <span className="text-xs text-[var(--accent)]">
                {cardFields.map(f => f.alias || f.dbKey).join(" · ")}
              </span>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Keine Felder — nur Name &amp; Klasse</span>
            )}
          </div>
          <span className="text-[var(--text-muted)] text-xs">{showFieldPanel ? "▲" : "▼"}</span>
        </button>

        {showFieldPanel && (
          <div className="px-5 pb-5 pt-1 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Wähle, welche Datenbankfelder auf der Karte erscheinen und wie sie beschriftet werden. Reihenfolge per ▲▼ anpassen.
            </p>
            <FieldBuilder
              cardFields={cardFields}
              onChange={setCardFields}
              availableKeys={availableKeys}
            />
          </div>
        )}
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={klasseFilter}
          onChange={e => { setKlasseFilter(e.target.value); setSelected(new Set()); }}
          className="input text-sm py-1.5 w-36"
        >
          <option value="">Alle Klassen</option>
          {classes.map(k => <option key={k} value={k}>{k}</option>)}
        </select>

        <div className="flex gap-2 text-xs items-center">
          <button onClick={selectAll} className="underline opacity-70 hover:opacity-100">Alle</button>
          <button onClick={selectNone} className="underline opacity-70 hover:opacity-100">Keine</button>
          {selected.size > 0 && (
            <span className="text-[var(--accent)] font-medium">{selected.size} ausgewählt</span>
          )}
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {(["cards", "list"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm transition-colors ${view === v ? "bg-[var(--accent)] text-[var(--accent-text)]" : "hover:bg-[var(--surface-hover)]"}`}
            >
              {v === "cards" ? "⊞ Karten" : "≡ Liste"}
            </button>
          ))}
        </div>

        <button
          onClick={handlePrint}
          disabled={displayStudents.length === 0}
          className="btn-primary text-sm py-1.5 px-4"
        >
          🖨 PDF drucken {displayStudents.length > 0 && `(${displayStudents.length})`}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Lade Schülerdaten…</div>
      ) : students.length === 0 ? (
        <div className="flex items-center justify-center h-40 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm">
          Keine Schüler gefunden. Erst CSV importieren.
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {students.map(s => (
            <div
              key={s.id}
              onClick={() => toggleStudent(s.id)}
              className={`cursor-pointer transition-opacity rounded-xl ${selected.size === 0 || selected.has(s.id) ? "opacity-100" : "opacity-30"}`}
            >
              <StudentCard student={s} cardFields={cardFields} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs">
                <th className="w-8 py-2 px-3" />
                <th className="text-left py-2 px-3">Nachname</th>
                <th className="text-left py-2 px-3">Vorname</th>
                <th className="text-left py-2 px-3">Klasse</th>
                {cardFields.map(f => (
                  <th key={f.id} className="text-left py-2 px-3">{f.alias || f.dbKey}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <StudentListRow
                  key={s.id}
                  student={s}
                  selected={selected.has(s.id)}
                  onToggle={() => toggleStudent(s.id)}
                  cardFields={cardFields}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {students.length > 0 && selected.size === 0 && (
        <p className="text-xs text-[var(--text-muted)] text-center">
          Karte anklicken zum Auswählen · ohne Auswahl werden alle {students.length} Karten gedruckt
        </p>
      )}
    </div>
  );
}
