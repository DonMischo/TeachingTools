"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, curriculumGuest } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { useHubIdentity } from "@/hooks/useHubIdentity";

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { auth } = useAuth();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ["curriculum-guest-status", code],
    queryFn: () => api.curriculum.guestStatus(code.trim()),
    enabled: code.trim().length >= 4,
  });
  const open = status?.allow_guests === true;

  const join = useCallback(async (guestName: string) => {
    setJoining(true);
    try {
      const res = await api.curriculum.guestJoin(code.trim(), guestName.trim());
      curriculumGuest.set(res.plan_id, res.token);
      router.push(`/tools/curriculum/${res.plan_id}`);
    } catch (e: any) {
      toast(e.message ?? "Beitritt fehlgeschlagen", "error");
      setJoining(false);
    }
  }, [code, router, toast]);

  // Angemeldete Lehrkräfte brauchen keinen Gastnamen.
  useEffect(() => {
    if (auth && open && status?.plan_id) router.replace(`/tools/curriculum/${status.plan_id}`);
  }, [auth, open, status?.plan_id, router]);

  // Über /play gekommen: der Name steht schon fest.
  const hubJoin = useCallback(({ name }: { name: string }) => { setName(name); join(name); }, [join]);
  useHubIdentity(code.trim(), open && !auth, hubJoin);

  return (
    <div className="max-w-md mx-auto p-6 mt-10">
      <div className="rounded-2xl border border-line bg-page p-6 shadow-lg">
        <h1 className="text-xl font-bold mb-1">Curriculum-Plan beitreten</h1>
        <p className="text-sm text-muted mb-5">Als Gast im Plan einer Fachschaft.</p>

        <label className="label">Code</label>
        <input className="input mb-3 font-mono tracking-wider" value={code}
          onChange={e => setCode(e.target.value.toUpperCase())} placeholder="z. B. K7P2QX" maxLength={12} />

        {code.trim().length >= 4 && (
          <div className="mb-3 text-sm">
            {isLoading ? <span className="text-muted">Prüfe Code…</span>
              : open ? <span className="text-ok">✓ {status?.plan_name} · {status?.permission === "edit" ? "darf mitbearbeiten" : "nur lesen"}</span>
                : <span className="text-bad">Kein gültiger oder freigeschalteter Code.</span>}
          </div>
        )}

        <label className="label">Dein Name</label>
        <input className="input mb-5" value={name} onChange={e => setName(e.target.value)} placeholder="Anzeigename" maxLength={100}
          onKeyDown={e => { if (e.key === "Enter" && open && name.trim()) join(name); }} />

        <button className="btn-primary w-full" disabled={!open || !name.trim() || joining} onClick={() => join(name)}>
          {joining ? "Trete bei…" : "Beitreten"}
        </button>
      </div>
    </div>
  );
}

export default function CurriculumJoinPage() {
  return <Suspense fallback={null}><JoinInner /></Suspense>;
}
