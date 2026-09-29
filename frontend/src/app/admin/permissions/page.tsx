"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  api, AdminFeatureOut, AdminTeacherRole, AdminFeatureGrant, TeacherOut,
} from "@/lib/api";

/**
 * Admin-only: grant each admin feature to whole teacher groups (TeacherRole)
 * and/or to individually trusted teachers. Admins always keep everything, so
 * they aren't listed as grant targets.
 */
export default function AdminPermissionsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  const isAdmin = auth?.role === "admin";
  const { data: features = [] } = useQuery<AdminFeatureOut[]>({
    queryKey: ["admin-catalog"], queryFn: api.adminAccess.catalog, enabled: isAdmin,
  });
  const { data: roles = [] } = useQuery<AdminTeacherRole[]>({
    queryKey: ["admin-teacher-roles"], queryFn: api.adminAccess.teacherRoles, enabled: isAdmin,
  });
  const { data: teachers = [] } = useQuery<TeacherOut[]>({
    queryKey: ["teachers"], queryFn: api.teachers.list, enabled: isAdmin,
  });
  const { data: grants = [] } = useQuery<AdminFeatureGrant[]>({
    queryKey: ["admin-grants"], queryFn: api.adminAccess.grants, enabled: isAdmin,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-grants"] });
    qc.invalidateQueries({ queryKey: ["admin-access-me"] });
  };
  const addMut = useMutation({ mutationFn: api.adminAccess.addGrant, onSuccess: invalidate });
  const removeMut = useMutation({ mutationFn: api.adminAccess.removeGrant, onSuccess: invalidate });

  if (!auth || auth.role !== "admin") return null;

  const hasRole = (feature: string, roleId: number) =>
    grants.some(g => g.feature_slug === feature && g.teacher_role_id === roleId);
  const hasTeacher = (feature: string, teacherId: number) =>
    grants.some(g => g.feature_slug === feature && g.teacher_id === teacherId);

  const toggleRole = (feature: string, roleId: number) =>
    (hasRole(feature, roleId) ? removeMut : addMut).mutate({ feature_slug: feature, teacher_role_id: roleId });
  const toggleTeacher = (feature: string, teacherId: number) =>
    (hasTeacher(feature, teacherId) ? removeMut : addMut).mutate({ feature_slug: feature, teacher_id: teacherId });

  const individuals = teachers.filter(t => t.role !== "admin");

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div>
        <Link href="/admin" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Admin</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🔑 Berechtigungen</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Gib einzelne Admin-Bereiche für Lehrergruppen oder namentlich ausgewählte Lehrkräfte frei.
          Administratoren haben stets vollen Zugriff.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {features.map(f => {
          const indivCount = individuals.filter(t => hasTeacher(f.slug, t.id)).length;
          return (
            <div key={f.slug} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
              <div className="font-semibold">{f.icon} {f.label}</div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] w-24 shrink-0">Lehrergruppen</span>
                {roles.length === 0 && <span className="text-xs text-[var(--text-muted)]">keine Rollen</span>}
                {roles.map(r => {
                  const on = hasRole(f.slug, r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleRole(f.slug, r.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        on ? "bg-[var(--accent)] text-white border-transparent"
                           : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                      }`}
                    >{on ? "✓ " : ""}{r.name}</button>
                  );
                })}
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-[var(--text-muted)] select-none">
                  Einzelne Lehrkräfte{indivCount > 0 ? ` · ${indivCount} ausgewählt` : ""}
                </summary>
                <div className="mt-2 flex flex-col gap-1 max-h-56 overflow-y-auto pl-1">
                  {individuals.length === 0 && <span className="text-[var(--text-muted)]">Keine Lehrkräfte.</span>}
                  {individuals.map(t => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasTeacher(f.slug, t.id)}
                        onChange={() => toggleTeacher(f.slug, t.id)}
                        className="accent-[var(--accent)] w-4 h-4"
                      />
                      {t.first_name} {t.last_name}
                    </label>
                  ))}
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
