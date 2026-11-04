"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { api, curriculumGuest } from "@/lib/api";
import HelpButton from "@/components/HelpButton";
import { CurriculumEditor } from "@/components/curriculum/Editor";

export default function CurriculumPlanSeite() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  // Angemeldete brauchen kein Gast-Token; Gäste haben eins aus dem QR-Beitritt.
  const [guestToken, setGuestToken] = useState<string | undefined>();
  const [bereit, setBereit] = useState(false);
  useEffect(() => { setGuestToken(auth ? undefined : curriculumGuest.get(id)); setBereit(true); }, [auth, id]);

  const { data: plan, error } = useQuery({
    queryKey: ["curriculum-plan", id, guestToken],
    queryFn: () => api.curriculum.get(id, guestToken),
    enabled: bereit,
    refetchOnWindowFocus: false,
  });

  if (error) return <div className="p-6 text-bad">Plan nicht erreichbar: {(error as Error).message}</div>;
  if (!plan) return <div className="p-6 text-muted">Lade…</div>;

  return (
    <div className="max-w-seite mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-1">
        {!guestToken && <Link href="/tools/curriculum" className="text-muted text-sm">← Pläne</Link>}
        <h1 className="text-xl font-bold flex-1">🧭 {plan.name}</h1>
        {plan.darf_verwalten && (
          <>
            <button className="btn-secondary text-sm" onClick={async () => {
              const neu = prompt("Neuer Name", plan.name);
              if (neu?.trim()) { await api.curriculum.patch(id, { name: neu.trim() }); qc.invalidateQueries({ queryKey: ["curriculum-plan", id] }); }
            }}>✎ Umbenennen</button>
            <button className="btn-danger text-sm" onClick={async () => {
              if (!confirm(`Plan »${plan.name}« für alle löschen?`)) return;
              try { await api.curriculum.remove(id); router.push("/tools/curriculum"); } catch (e: any) { toast(e.message, "error"); }
            }}>🗑</button>
          </>
        )}
        {!guestToken && (
          <button className="btn-secondary text-sm" title="Eigene Kopie, um eine Umstellung durchzuspielen" onClick={async () => {
            const k = await api.curriculum.copy(id); router.push(`/tools/curriculum/${k.id}`);
          }}>⧉ Kopie</button>
        )}
        <HelpButton slug="curriculum" />
      </div>
      <CurriculumEditor key={plan.id} start={plan} guestToken={guestToken} />
    </div>
  );
}
