"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api, ClassOut, StudentGroupOut } from "@/lib/api";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

export default function AdminAvailabilityPage() {
  const { auth } = useAuth();
  const router = useRouter();
  // "global" | "class:<id>" | "group:<id>" — eine A/B-Gruppe ist die halbe Klasse.
  const [scope, setScope] = useState<string>("global");

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  const { data: classes } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    enabled: auth?.role === "admin",
  });
  const { data: abGroups } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "ab_gruppe"],
    queryFn: () => api.groups.list({ group_type: "ab_gruppe" }),
    enabled: auth?.role === "admin",
  });

  if (!auth || auth.role !== "admin") return null;

  const groupId = scope.startsWith("group:") ? Number(scope.split(":")[1]) : null;
  // Eine Gruppe erbt von ihrer Klasse — die Matrix braucht sie für den „Standard"-Wert.
  const classId = groupId != null
    ? (abGroups ?? []).find(g => g.id === groupId)?.class_id ?? null
    : scope.startsWith("class:") ? Number(scope.split(":")[1]) : null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div>
        <Link href="/admin" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Admin</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🧩 Verfügbarkeit</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Lege fest, wer welche Werkzeuge sehen und nutzen darf. Nicht freigeschaltete Elemente
          verschwinden komplett. „Standard" folgt dem Vorgabewert{scope === "global" ? "" : " bzw. der nächsthöheren Ebene"}.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)] max-w-xs">
        Geltungsbereich
        <select
          className="input text-sm py-2"
          value={scope}
          onChange={e => setScope(e.target.value)}
        >
          <option value="global">🌐 Global (Standard für alle)</option>
          {(classes ?? []).map(c => (
            <optgroup key={c.id} label={c.display_name}>
              <option value={`class:${c.id}`}>{c.display_name} — ganze Klasse</option>
              {(abGroups ?? [])
                .filter(g => g.class_id === c.id)
                .sort((a, b) => a.name.localeCompare(b.name, "de"))
                .map(g => (
                  <option key={g.id} value={`group:${g.id}`}>
                    {c.display_name} – Gruppe {g.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <AvailabilityGrid key={scope} classId={classId} groupId={groupId} canEdit />
    </div>
  );
}
