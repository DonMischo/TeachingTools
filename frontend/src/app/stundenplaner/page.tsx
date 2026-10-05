"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, LessonPlanOut, Phase } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";

const FAECHER = ["", "Deutsch", "Mathematik", "Englisch", "Biologie", "Chemie", "Physik", "Geschichte", "Geographie", "Informatik", "Musik", "Kunst", "Sport", "Ethik", "Religion"];

// Standard-Verlauf für "Aus Vorlage erstellen" (Phasen-Ids werden serverseitig ergänzt).
const TEMPLATE_PHASES: Phase[] = [
  { name: "Einstieg", dauer_min: 5, inhalt: "", sozialform: "Plenum", methode: "", material: "", tool_link: null },
  { name: "Erarbeitung", dauer_min: 25, inhalt: "", sozialform: "EA", methode: "", material: "", tool_link: null },
  { name: "Sicherung", dauer_min: 10, inhalt: "", sozialform: "PA", methode: "", material: "", tool_link: null },
  { name: "Abschluss", dauer_min: 5, inhalt: "", sozialform: "Plenum", methode: "", material: "", tool_link: null },
];

function PlanCard({ plan, onDelete }: { plan: LessonPlanOut; onDelete: () => void }) {
  const router = useRouter();
  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-sm leading-snug">{plan.title}</div>
        {!plan.is_owner && (
          <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full shrink-0">geteilt</span>
        )}
      </div>
      <div className="text-xs text-muted flex flex-col gap-0.5">
        {plan.fach && <span>📚 {plan.fach}{plan.klasse ? ` · ${plan.klasse}` : ""}</span>}
        {plan.datum && <span>📅 {plan.datum}</span>}
        <span>⏱ {plan.dauer_min} min · {(plan.phasen ?? []).length} Phasen</span>
        {!plan.is_owner && <span className="text-muted">von {plan.owner_name}</span>}
      </div>
      <div className="flex gap-2 mt-auto pt-1">
        <button onClick={() => router.push(`/stundenplaner/${plan.id}`)} className="btn-primary text-xs py-1 px-3 flex-1">
          {plan.is_owner ? "Bearbeiten" : "Ansehen"}
        </button>
        {plan.is_owner && (
          <button onClick={onDelete} className="text-xs px-2 py-1 rounded-sm border border-red-400 text-red-400 hover:bg-red-400/10 transition-colors">
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export default function StundenplanerListPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { can } = useAvailability();
  const isTeacher = auth?.user_type === "teacher";

  const [own, setOwn] = useState<LessonPlanOut[]>([]);
  const [shared, setShared] = useState<LessonPlanOut[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFach, setNewFach] = useState("");
  const [newKlasse, setNewKlasse] = useState("");
  const [creating, setCreating] = useState(false);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.stundenplaner.list();
      setOwn(data.own);
      setShared(data.shared);
    } catch {
      toast("Fehler beim Laden", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (auth && isTeacher) load(); }, [auth]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const plan = await api.stundenplaner.create({
        title: newTitle.trim(), fach: newFach, klasse: newKlasse,
        dauer_min: 45, phasen: [], lernziele: [],
      });
      router.push(`/stundenplaner/${plan.id}`);
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate() {
    setCreating(true);
    try {
      const plan = await api.stundenplaner.create({
        title: "Neue Stunde (Vorlage)", fach: "", klasse: "",
        dauer_min: 45, phasen: TEMPLATE_PHASES, lernziele: [],
      });
      router.push(`/stundenplaner/${plan.id}`);
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(plan: LessonPlanOut) {
    if (!confirm(`"${plan.title}" löschen?`)) return;
    try {
      await api.stundenplaner.delete(plan.id);
      setOwn(prev => prev.filter(p => p.id !== plan.id));
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    }
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const plan = await api.stundenplaner.importJson(importText.trim());
      toast("Planung importiert", "success");
      router.push(`/stundenplaner/${plan.id}`);
    } catch (e: any) {
      toast("Import fehlgeschlagen: " + (e.message ?? "Ungültiges JSON"), "error");
    } finally {
      setImporting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImportText((ev.target?.result as string) ?? "");
    reader.readAsText(file, "utf-8");
  }

  if (!auth || !isTeacher) {
    return <div className="p-8 text-muted">Nur für Lehrkräfte zugänglich.</div>;
  }

  return (
    <div className="max-w-seite mx-auto px-4 py-8 w-full">
      <button onClick={() => router.push("/tools")} className="mb-3 text-sm text-muted hover:text-fg transition-colors">
        ← Zurück zu Tools
      </button>

      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📋 Stundenplaner</h1>
          <p className="text-sm text-muted mt-0.5">Verlaufsplanungen erstellen und mit Kolleg·innen teilen.</p>
        </div>
        {can("stundenplaner", "create") && (
          <div className="flex gap-2 flex-wrap">
            <a href="/api/stundenplaner/template" download="stundenplaner_vorlage.json"
              className="btn-secondary text-sm py-1.5 px-4 no-underline"
              title="JSON-Vorlage mit KI-Anweisungen herunterladen — von einer KI ausfüllen lassen und importieren.">
              📋 KI-Vorlage
            </a>
            <button onClick={() => { setShowImport(v => !v); setShowCreate(false); }} className="btn-secondary text-sm py-1.5 px-4">
              ↑ Importieren
            </button>
            <button onClick={handleCreateFromTemplate} disabled={creating} className="btn-secondary text-sm py-1.5 px-4">
              {creating ? "…" : "＋ Aus Vorlage"}
            </button>
            <button onClick={() => { setShowCreate(v => !v); setShowImport(false); }} className="btn-primary text-sm py-1.5 px-4">
              + Neue Planung
            </button>
          </div>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-surface border border-line rounded-xl p-5 mb-6 flex flex-col gap-3">
          <div className="font-semibold text-sm">Neue Stundenplanung</div>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titel *" required className="input text-sm py-2" />
          <div className="flex gap-2 flex-wrap">
            <select value={newFach} onChange={e => setNewFach(e.target.value)} className="input text-sm py-2 flex-1 min-w-32">
              {FAECHER.map(f => <option key={f} value={f}>{f || "Fach wählen…"}</option>)}
            </select>
            <input value={newKlasse} onChange={e => setNewKlasse(e.target.value)} placeholder="Klasse (z.B. 7b)" className="input text-sm py-2 flex-1 min-w-32" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="btn-primary text-sm py-1.5 px-4">{creating ? "Erstelle…" : "Erstellen & Bearbeiten"}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm py-1.5 px-4">Abbrechen</button>
          </div>
        </form>
      )}

      {/* Import form */}
      {showImport && (
        <div className="bg-surface border border-line rounded-xl p-5 mb-6 flex flex-col gap-3">
          <div className="font-semibold text-sm">Aus JSON importieren</div>
          <p className="text-xs text-muted">
            JSON einfügen oder Datei hochladen. Tipp: Lade die <strong>KI-Vorlage</strong> herunter, lass sie von einer KI ausfüllen und importiere das Ergebnis hier.
            Tool-Links werden beim Import entfernt und können danach im Editor gesetzt werden.
          </p>
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-1.5 px-3">📂 Datei wählen</button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
            {importText && <span className="text-xs text-muted self-center">{importText.length} Zeichen geladen</span>}
          </div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder='{"title": "Meine Stunde", "fach": "Biologie", ...}'
            rows={6}
            className="input text-xs font-mono resize-y"
          />
          <div className="flex gap-2">
            <button onClick={handleImport} disabled={importing || !importText.trim()} className="btn-primary text-sm py-1.5 px-4">{importing ? "Importiere…" : "Importieren"}</button>
            <button onClick={() => { setShowImport(false); setImportText(""); }} className="btn-secondary text-sm py-1.5 px-4">Abbrechen</button>
          </div>
        </div>
      )}

      {loading && <div className="text-muted text-sm">Laden…</div>}

      {!loading && own.length === 0 && shared.length === 0 && (
        <div className="text-center text-muted mt-16 text-sm">
          Noch keine Planungen. Erstelle deine erste Stundenplanung!
        </div>
      )}

      {own.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wide mb-3">Meine Planungen</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {own.map(p => <PlanCard key={p.id} plan={p} onDelete={() => handleDelete(p)} />)}
          </div>
        </section>
      )}

      {shared.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-muted uppercase tracking-wide mb-3">Geteilt mit mir</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {shared.map(p => <PlanCard key={p.id} plan={p} onDelete={() => {}} />)}
          </div>
        </section>
      )}
    </div>
  );
}
