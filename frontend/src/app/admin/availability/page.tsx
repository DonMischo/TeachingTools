"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api, ClassOut } from "@/lib/api";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

export default function AdminAvailabilityPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [scope, setScope] = useState<"global" | number>("global");

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  const { data: classes } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    enabled: auth?.role === "admin",
  });

  if (!auth || auth.role !== "admin") return null;

  const classId = scope === "global" ? null : scope;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div>
        <Link href="/admin" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Admin</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🧩 Verfügbarkeit</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Lege fest, wer welche Werkzeuge sehen und nutzen darf. Nicht freigeschaltete Elemente
          verschwinden komplett. „Standard" folgt dem Vorgabewert{scope === "global" ? "" : " bzw. der globalen Einstellung"}.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)] max-w-xs">
        Geltungsbereich
        <select
          className="input text-sm py-2"
          value={scope === "global" ? "global" : String(scope)}
          onChange={e => setScope(e.target.value === "global" ? "global" : Number(e.target.value))}
        >
          <option value="global">🌐 Global (Standard für alle)</option>
          {(classes ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.display_name}</option>
          ))}
        </select>
      </label>

      <AvailabilityGrid key={scope} classId={classId} canEdit />
    </div>
  );
}
