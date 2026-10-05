"use client";
import { useParams } from "next/navigation";
import KartenSelbstUeben from "@/components/karten/KartenSelbstUeben";
import { RequireAccount } from "@/components/RequireAccount";

export default function KartenUebenPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAccount icon="🎯" title="Karten üben">
      <KartenSelbstUeben satzId={Number(id)} />
    </RequireAccount>
  );
}
