"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, fragmentGuest } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ["fragment-guest-status", code],
    queryFn: () => api.fragments.guestStatus(code.trim()),
    enabled: code.trim().length >= 4,
  });

  const open = status?.allow_guests === true;

  const join = async () => {
    setJoining(true);
    try {
      const res = await api.fragments.guestJoin(code.trim(), name.trim());
      fragmentGuest.set(res.collection_id, res.token);
      router.push(`/fragmente/${res.collection_id}`);
    } catch (e: any) {
      toast(e.message ?? "Beitritt fehlgeschlagen", "error");
      setJoining(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 mt-10">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-lg">
        <h1 className="text-xl font-bold mb-1">Pinnwand beitreten</h1>
        <p className="text-sm text-[var(--text-muted)] mb-5">Als Gast einer geteilten Fragmente-Sammlung.</p>

        <label className="label">Code</label>
        <input className="input mb-3 font-mono tracking-wider" value={code}
          onChange={e => setCode(e.target.value.toUpperCase())} placeholder="z. B. K7P2QX" maxLength={12} />

        {code.trim().length >= 4 && (
          <div className="mb-3 text-sm">
            {isLoading ? (
              <span className="text-[var(--text-muted)]">Prüfe Code…</span>
            ) : open ? (
              <span className="text-green-600">✓ {status?.collection_name} · {status?.permission === "contribute" ? "darf beitragen" : "nur lesen"}</span>
            ) : (
              <span className="text-red-500">Kein gültiger oder freigeschalteter Code.</span>
            )}
          </div>
        )}

        <label className="label">Dein Name</label>
        <input className="input mb-5" value={name} onChange={e => setName(e.target.value)}
          placeholder="Anzeigename" maxLength={100} onKeyDown={e => { if (e.key === "Enter" && open && name.trim()) join(); }} />

        <button className="btn-primary disabled:opacity-50"
          disabled={!open || !name.trim() || joining} onClick={join}>
          {joining ? "Trete bei…" : "Beitreten"}
        </button>
      </div>
    </div>
  );
}

export default function FragmentJoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}
