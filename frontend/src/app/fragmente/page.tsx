"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, FragmentCollectionOut, FragmentPermission } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { CollectionModal } from "@/components/fragmente/CollectionSettingsDialog";

const PERM_LABEL: Record<FragmentPermission, string> = {
  read: "Nur lesen",
  contribute: "Beitragen",
  manage: "Verwalten",
};

// Collection create/settings dialog lives in components/fragmente (shared with the board).

// ── Collection card ────────────────────────────────────────────────────────────

function CollectionCard({
  coll, onOpen, onEdit, onDelete,
}: {
  coll: FragmentCollectionOut;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canManage = coll.my_permission === "manage";
  const audience = coll.grants.length === 0
    ? "Privat"
    : coll.grants.some(g => g.grantee_type === "all_teachers")
      && !coll.grants.some(g => g.grantee_type === "class" || g.grantee_type === "group")
      ? "Öffentlich (Lehrer)"
      : `${coll.grants.length} Gruppe${coll.grants.length === 1 ? "" : "n"}`;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col gap-2 hover:border-[var(--accent)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button className="text-left flex-1 min-w-0" onClick={onOpen}>
          <div className="font-semibold truncate">{coll.name}</div>
          {coll.subject && <div className="text-xs text-[var(--text-muted)]">{coll.subject}</div>}
        </button>
        {coll.my_permission !== "manage" && (
          <span className="text-[10px] shrink-0 px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)]">
            {PERM_LABEL[coll.my_permission as FragmentPermission] ?? "—"}
          </span>
        )}
      </div>

      {coll.description && <p className="text-xs text-[var(--text-muted)] line-clamp-2">{coll.description}</p>}

      <div className="text-xs text-[var(--text-muted)] flex items-center gap-3 mt-auto pt-1">
        <span>📝 {coll.fragment_count}</span>
        <span>📎 {coll.research_count}</span>
        <span className="truncate">· {audience}</span>
        {coll.allow_guests && <span title="Gastzugang aktiv">🔗</span>}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 mt-1">
        <span className="text-[10px] text-[var(--text-muted)] truncate">{coll.is_owner ? "Deine Sammlung" : coll.owner_name}</span>
        <div className="flex gap-1">
          <button className="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]" onClick={onOpen}>Öffnen</button>
          {canManage && (
            <button className="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]" onClick={onEdit}
              title="Einstellungen" aria-label="Einstellungen">⚙️</button>
          )}
          {coll.is_owner && <button className="text-xs px-2 py-1 rounded hover:bg-red-500/10 text-red-500" onClick={onDelete}>Löschen</button>}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FragmentsLandingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  const isTeacher = auth?.user_type === "teacher";

  const [modal, setModal] = useState<null | { collection: FragmentCollectionOut | null }>(null);
  const [confirmDel, setConfirmDel] = useState<FragmentCollectionOut | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<string>("");   // "" | meine | public | geteilt | alle | class:<id>

  const { data: collections = [], isLoading } = useQuery<FragmentCollectionOut[]>({
    queryKey: ["fragment-collections"],
    queryFn: () => api.fragments.listCollections(),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.fragments.deleteCollection(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fragment-collections"] }); toast("Gelöscht", "success"); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const isPublic = (c: FragmentCollectionOut) => c.grants.some(g => g.grantee_type === "all_teachers");

  // Distinct classes present across visible collections → filter chips.
  const classChips = useMemo(() => {
    const seen = new Map<number, string>();
    for (const c of collections)
      for (const g of c.grants)
        // group-Grants (A/B-Gruppen) tragen die Klasse ihrer Gruppe.
        if (g.class_id != null && (g.grantee_type === "class" || g.grantee_type === "group"))
          seen.set(g.class_id, g.class_code ?? String(g.class_id));
    return [...seen.entries()].map(([id, code]) => ({ id, code }));
  }, [collections]);

  const shown = useMemo(() => collections.filter(c => {
    if (filter === "meine") return c.is_owner;
    if (filter === "public") return isPublic(c);
    if (filter === "geteilt") return !c.is_owner && !isPublic(c);
    if (filter === "alle") return true;
    if (filter.startsWith("class:")) {
      const cid = Number(filter.split(":")[1]);
      return c.grants.some(g => (g.grantee_type === "class" || g.grantee_type === "group") && g.class_id === cid);
    }
    // default: teachers see own + public; students see everything shared with them.
    return isTeacher ? (c.is_owner || isPublic(c)) : true;
  }), [collections, filter, isTeacher]);

  const chip = (key: string, label: string) => (
    <button key={key} onClick={() => setFilter(f => f === key ? "" : key)}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        filter === key ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-[92%] max-w-[var(--seite-breite)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Fragmente</h1>
          <p className="text-sm text-[var(--text-muted)]">Pinnwände mit Karten & Clippings</p>
        </div>
        {isTeacher && (
          <button className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90"
            onClick={() => setModal({ collection: null })}>
            + Neue Sammlung
          </button>
        )}
      </div>

      {/* Filter bar + view toggle */}
      {collections.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {isTeacher && chip("meine", "Meine")}
          {isTeacher && chip("public", "Öffentlich")}
          {isTeacher && chip("geteilt", "Geteilt")}
          {classChips.map(c => chip(`class:${c.id}`, `Klasse ${c.code}`))}
          {chip("alle", "Alle")}
          <div className="ml-auto flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
            <button className={`px-2 py-1 text-sm ${view === "grid" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
              onClick={() => setView("grid")} title="Raster">▦</button>
            <button className={`px-2 py-1 text-sm ${view === "list" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
              onClick={() => setView("list")} title="Liste">☰</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-[var(--text-muted)]">Lädt…</p>
      ) : collections.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <p>Noch keine Sammlungen.</p>
          {isTeacher && <p className="text-sm mt-1">Erstelle deine erste Pinnwand.</p>}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm py-16 text-center">Keine Sammlungen für diesen Filter.</p>
      ) : (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2"}>
          {shown.map(c => (
            <CollectionCard key={c.id} coll={c}
              onOpen={() => router.push(`/fragmente/${c.id}`)}
              onEdit={() => setModal({ collection: c })}
              onDelete={() => setConfirmDel(c)}
            />
          ))}
        </div>
      )}

      {modal && <CollectionModal initial={modal.collection} onClose={() => setModal(null)} />}
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] p-5 shadow-2xl"
            style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">Sammlung löschen?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              „{confirmDel.name}" wird mit allen {confirmDel.fragment_count} Karten und {confirmDel.research_count} Clippings dauerhaft gelöscht.
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                onClick={() => setConfirmDel(null)}>Abbrechen</button>
              <button className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-semibold hover:opacity-90"
                onClick={() => { del.mutate(confirmDel.id); setConfirmDel(null); }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
