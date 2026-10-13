"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { VorlagenEditor } from "@/components/vorlagen/VorlagenEditor";
import { ChallengeForm, type ChallengeJson } from "@/components/vorlagen/ChallengeForm";
import ChallengeLehrkraft from "@/components/challenge/ChallengeLehrkraft";

export default function ChallengeDetailSeite() {
  const { id } = useParams<{ id: string }>();
  const satzId = Number(id);
  const { auth } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: satz, isLoading } = useQuery({
    queryKey: ["challenge", "satz", satzId], queryFn: () => api.challenge.get(satzId) as Promise<ChallengeJson>,
  });

  if (auth?.role !== "teacher" && auth?.role !== "admin") {
    return <div className="p-8 text-muted">Nur für Lehrkräfte.</div>;
  }
  if (isLoading) return <p className="p-6 text-muted">Wird geladen…</p>;
  if (!satz) return <p className="p-6 text-red-500">Challenge nicht gefunden.</p>;

  return (
    <div className="p-6 max-w-seite mx-auto w-full flex flex-col gap-6">
      <div>
        <Link href="/aktivitaeten/challenge" className="text-sm text-muted hover:text-fg">← Challenge</Link>
        <h1 className="text-2xl font-bold mt-2">{satz.title}</h1>
      </div>

      <VorlagenEditor
        title="Challenge bearbeiten"
        load={() => api.challenge.get(satzId) as Promise<ChallengeJson>}
        render={(v, set) => <ChallengeForm value={v} onChange={set} upload={file => api.challenge.uploadAsset(satzId, file)} satzId={satzId} />}
        save={data => api.challenge.update(satzId, data)}
        fileName="challenge.json"
        onSaved={r => {
          qc.invalidateQueries({ queryKey: ["challenge"] });
          toast(r.warnungen?.length ? `Gespeichert, aber: ${r.warnungen.join(" · ")}` : "Gespeichert", r.warnungen?.length ? "error" : "success");
        }}
      />

      <ChallengeLehrkraft satzId={satzId} titel={satz.title} />
    </div>
  );
}
