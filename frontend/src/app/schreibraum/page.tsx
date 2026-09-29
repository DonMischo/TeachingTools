"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, SchreibraumRoom } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";

export default function SchreibraumListPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const isTeacher = auth?.user_type === "teacher";
  const { toast } = useToast();
  const { can } = useAvailability();

  const [rooms, setRooms] = useState<SchreibraumRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create room state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState("next-free-line");
  const [newPermanent, setNewPermanent] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Filter/search state
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.schreibraum.list();
      setRooms(data);
    } catch (e: any) {
      setError(e.message ?? "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) return;
    load();
  }, [auth]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const room = await api.schreibraum.create({ title: newTitle.trim(), mode: newMode, is_permanent: newPermanent });
      setRooms((prev) => [room, ...prev]);
      setShowCreate(false);
      setNewTitle("");
      router.push(`/schreibraum/${room.code}`);
    } catch (e: any) {
      toast(e.message ?? "Fehler beim Erstellen", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(room: SchreibraumRoom) {
    if (!confirm(`Raum "${room.title}" löschen?`)) return;
    try {
      await api.schreibraum.delete(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (e: any) {
      toast(e.message ?? "Fehler beim Löschen", "error");
    }
  }

  const creators = useMemo(() => {
    const names = [...new Set(rooms.map(r => r.creator_name))].sort();
    return names;
  }, [rooms]);

  const filtered = useMemo(() => {
    let r = rooms;
    if (creatorFilter) r = r.filter(room => room.creator_name === creatorFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(room =>
        room.title.toLowerCase().includes(q) || room.creator_name.toLowerCase().includes(q)
      );
    }
    return r;
  }, [rooms, creatorFilter, search]);

  if (!auth) {
    return (
      <div className="p-8 text-[var(--text-muted)]">
        Bitte anmelden, um den Schreibraum zu nutzen.
      </div>
    );
  }

  return (
    <div className="max-w-[var(--seite-breite)] mx-auto px-4 py-8 w-full">
      <button onClick={() => router.push("/tools")} className="mb-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
        ← Tools
      </button>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-black tracking-tight">📝 Schreibraum</h1>
        <div className="flex items-center gap-2">
          {isTeacher && can("schreibraum", "create") && (
            <button
              onClick={() => { setShowCreate(v => !v); }}
              className="btn-primary text-sm py-1.5 px-4"
            >
              + Neuer Raum
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && isTeacher && (
        <form onSubmit={handleCreate} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-6 flex flex-col gap-3">
          <div className="font-semibold text-sm">Neuen Raum erstellen</div>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titel des Raums"
            required
            className="input text-sm py-2"
          />

          {/* Settings toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowSettings(v => !v)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1"
            >
              {showSettings ? "▾" : "▸"} ⚙ Einstellungen
            </button>
            {showSettings && (
              <div className="mt-2 flex gap-4 flex-wrap">
                <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  Modus:{" "}
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value)}
                    className="input text-xs py-0.5 ml-1"
                  >
                    <option value="next-free-line">Nächste freie Zeile</option>
                    <option value="add-line">Zeile hinzufügen</option>
                    <option value="wortstaffel">Wortstaffel</option>
                  </select>
                </label>
                <label className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <input type="checkbox" checked={newPermanent} onChange={(e) => setNewPermanent(e.target.checked)} />
                  Dauerhaft
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="btn-primary text-sm py-1.5 px-4">
              {creating ? "Erstelle…" : "Erstellen"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm py-1.5 px-4">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Filter / search bar */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Name oder Ersteller…"
          className="input text-sm py-1.5 flex-1 min-w-48"
        />
        {creators.length > 1 && (
          <select
            value={creatorFilter}
            onChange={e => setCreatorFilter(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">Alle Ersteller</option>
            {creators.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="text-[var(--text-muted)] text-sm">Laden…</div>}
      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-[var(--text-muted)] text-center mt-12 text-sm">
          {rooms.length === 0
            ? (isTeacher ? "Noch keine Räume. Erstelle deinen ersten Raum!" : "Du hast noch keinen Zugang zu einem Schreibraum.")
            : "Keine Räume gefunden."}
        </div>
      )}

      {/* Responsive grid: 3–6 columns */}
      <div className="grid gap-3 grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filtered.map((room) => (
          <div
            key={room.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2"
          >
            <div className="font-semibold text-sm leading-snug">{room.title}</div>
            <div className="text-xs text-[var(--text-muted)] flex flex-col gap-0.5">
              <span>Code: <b>{room.code}</b></span>
              <span>von {room.creator_name}</span>
              <span>{room.mode === "add-line" ? "Zeile hinzufügen" : "Nächste freie Zeile"}</span>
              {!room.is_permanent && <span className="text-amber-400">Temporär</span>}
              {room.access.length > 0 && (
                <span>{room.access.length} Zugang{room.access.length !== 1 ? "sregeln" : ""}</span>
              )}
            </div>
            <div className="flex gap-2 mt-auto pt-1">
              <button
                onClick={() => router.push(`/schreibraum/${room.code}`)}
                className="btn-primary text-xs py-1 px-3 flex-1"
              >
                Öffnen
              </button>
              {isTeacher && room.created_by === auth.teacher?.id && (
                <button
                  onClick={() => handleDelete(room)}
                  className="text-xs px-2 py-1 rounded border border-red-400 text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
