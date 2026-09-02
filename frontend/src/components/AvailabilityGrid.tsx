"use client";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, CatalogToolOut, AvailabilityOverride, ToolCapability, AudienceKind } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

type CellState = "default" | "on" | "off";

const SURFACE_LABEL: Record<string, string> = { games: "🎮 Spiele", simulationen: "🔬 Simulationen", tools: "🔨 Tools" };

function keyOf(slug: string, cap: string, audience: string) {
  return `${slug}|${cap}|${audience}`;
}

/**
 * Editable availability matrix for one scope: global (classId null), a whole
 * class, or one A/B-Gruppe of a class (groupId set — classId then names the
 * group's class, whose values the group inherits). Each (tool, capability,
 * audience) cell is tri-state: Standard (inherits the baseline), Ja (allow),
 * Nein (sperren). The baseline is what the cell would resolve to one step up the
 * chain: Gruppe → Klasse → global → Katalog-Vorgabe.
 */
export function AvailabilityGrid(
  { classId, groupId = null, canEdit }: { classId: number | null; groupId?: number | null; canEdit: boolean },
) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: catalog } = useQuery<CatalogToolOut[]>({
    queryKey: ["availability-catalog"],
    queryFn: api.availability.catalog,
    staleTime: Infinity,
  });
  const { data: scopeRows } = useQuery<AvailabilityOverride[]>({
    queryKey: ["availability-overrides", classId, groupId],
    queryFn: () => api.availability.overrides(classId, groupId),
  });
  // Baseline für Gruppenzellen: die Zeilen der Klasse, aus der sie erben.
  const { data: classRows } = useQuery<AvailabilityOverride[]>({
    queryKey: ["availability-overrides", classId, null],
    queryFn: () => api.availability.overrides(classId),
    enabled: groupId != null && classId != null,
  });
  // Baseline for per-class cells: the global rows they inherit from.
  const { data: globalRows } = useQuery<AvailabilityOverride[]>({
    queryKey: ["availability-overrides", null, null],
    queryFn: () => api.availability.overrides(null),
    enabled: classId != null,
  });

  const scopeMap = useMemo(() => {
    const m = new Map<string, boolean>();
    (scopeRows ?? []).forEach(r => m.set(keyOf(r.tool_slug, r.capability, r.audience), r.allowed));
    return m;
  }, [scopeRows]);
  const globalMap = useMemo(() => {
    const m = new Map<string, boolean>();
    (globalRows ?? []).forEach(r => m.set(keyOf(r.tool_slug, r.capability, r.audience), r.allowed));
    return m;
  }, [globalRows]);
  const classMap = useMemo(() => {
    const m = new Map<string, boolean>();
    (classRows ?? []).forEach(r => m.set(keyOf(r.tool_slug, r.capability, r.audience), r.allowed));
    return m;
  }, [classRows]);

  const setMut = useMutation({
    mutationFn: (body: AvailabilityOverride) => api.availability.setOverride(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability-overrides", classId, groupId] });
      qc.invalidateQueries({ queryKey: ["availability-me"] });
    },
    onError: (e: any) => toast(e.message ?? "Fehler beim Speichern", "error"),
  });
  const clearMut = useMutation({
    mutationFn: (p: { tool_slug: string; capability: ToolCapability; audience: AudienceKind }) =>
      api.availability.clearOverride({ ...p, class_id: groupId != null ? null : classId, group_id: groupId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability-overrides", classId, groupId] });
      qc.invalidateQueries({ queryKey: ["availability-me"] });
    },
    onError: (e: any) => toast(e.message ?? "Fehler beim Speichern", "error"),
  });

  if (!catalog || !scopeRows) {
    return <div className="text-sm text-[var(--text-muted)]">Lade…</div>;
  }

  const bySurface: Record<string, CatalogToolOut[]> = { games: [], simulationen: [], tools: [] };
  catalog.forEach(t => (bySurface[t.surface] ?? bySurface.tools).push(t));

  function baseline(slug: string, cap: string, audience: AudienceKind, catalogDefault: boolean): boolean {
    if (classId == null) return catalogDefault;
    const k = keyOf(slug, cap, audience);
    const inherited = groupId != null ? classMap.get(k) ?? globalMap.get(k) : globalMap.get(k);
    return inherited ?? catalogDefault;
  }

  function stateOf(slug: string, cap: string, audience: AudienceKind): CellState {
    const v = scopeMap.get(keyOf(slug, cap, audience));
    return v === undefined ? "default" : v ? "on" : "off";
  }

  function apply(slug: string, cap: ToolCapability, audience: AudienceKind, next: CellState) {
    if (!canEdit) return;
    if (next === "default") {
      clearMut.mutate({ tool_slug: slug, capability: cap, audience });
    } else {
      setMut.mutate({
        tool_slug: slug, capability: cap, audience,
        class_id: groupId != null ? null : classId, group_id: groupId,
        allowed: next === "on",
      });
    }
  }

  function Segmented({ slug, cap, audience, catalogDefault }: {
    slug: string; cap: ToolCapability; audience: AudienceKind; catalogDefault: boolean;
  }) {
    const state = stateOf(slug, cap, audience);
    const base = baseline(slug, cap, audience, catalogDefault);
    const opts: { key: CellState; label: string }[] = [
      { key: "default", label: `Standard (${base ? "✓" : "✕"})` },
      { key: "on", label: "Ja" },
      { key: "off", label: "Nein" },
    ];
    return (
      <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-[11px]">
        {opts.map(o => {
          const active = state === o.key;
          return (
            <button
              key={o.key}
              type="button"
              disabled={!canEdit}
              onClick={() => apply(slug, cap, audience, o.key)}
              className={`px-2 py-1 leading-none transition-colors ${
                active
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
              } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  const renderTool = (t: CatalogToolOut) => (
    <div key={t.slug} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="font-semibold text-sm mb-2">{t.label}</div>
      <div className="flex flex-col gap-3">
        {t.capabilities.map(c => (
          <div key={c.capability} className="flex flex-col gap-1.5">
            <div className="text-xs font-medium text-[var(--text)]">{c.label}</div>
            <div className="flex flex-col gap-1 pl-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] w-14 shrink-0">Lehrer</span>
                <Segmented slug={t.slug} cap={c.capability} audience="teacher" catalogDefault={c.teacher_default} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] w-14 shrink-0">Schüler</span>
                <Segmented slug={t.slug} cap={c.capability} audience="student" catalogDefault={c.student_default} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {(["games", "simulationen", "tools"] as const).map(surface => (
        <div key={surface} className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[var(--text-muted)]">{SURFACE_LABEL[surface]}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {bySurface[surface].map(renderTool)}
          </div>
        </div>
      ))}
    </div>
  );
}
