"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api, StudentGroupOut } from "@/lib/api";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

/**
 * Per-class availability for a Klassenlehrer: the same matrix admins use, but
 * locked to the teacher's own class (Teacher.klasse_id) so they can open up or
 * lock down tools for their class without going through an admin.
 */
export default function ClassAvailabilityPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const klasseId = auth?.teacher?.klasse_id ?? null;
  // "class" oder "group:<id>" — die A/B-Gruppen der eigenen Klasse.
  const [scope, setScope] = useState<string>("class");

  const { data: abGroups } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "ab_gruppe", klasseId],
    queryFn: () => api.groups.list({ group_type: "ab_gruppe", class_id: klasseId! }),
    enabled: klasseId != null,
  });

  // Only a teacher who is Klassenlehrer of a class may use this page.
  useEffect(() => {
    if (auth && (auth.user_type !== "teacher" || klasseId == null)) router.replace("/");
  }, [auth, klasseId, router]);

  if (!auth || auth.user_type !== "teacher" || klasseId == null) return null;

  const groupId = scope.startsWith("group:") ? Number(scope.split(":")[1]) : null;
  const groups = [...(abGroups ?? [])].sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div>
        <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Start</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">
          🧩 Verfügbarkeit · {auth.teacher?.klasse ?? "meine Klasse"}
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Schalte Werkzeuge für deine Klasse frei oder sperre sie. „Standard" folgt der
          nächsthöheren Ebene; „Ja"/„Nein" überschreiben sie nur für den gewählten
          Geltungsbereich.
        </p>
      </div>

      {groups.length > 0 && (
        <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)] max-w-xs">
          Geltungsbereich
          <select className="input text-sm py-2" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="class">Ganze Klasse</option>
            {groups.map(g => (
              <option key={g.id} value={`group:${g.id}`}>Gruppe {g.name}</option>
            ))}
          </select>
        </label>
      )}

      <AvailabilityGrid key={scope} classId={klasseId} groupId={groupId} canEdit />
    </div>
  );
}
