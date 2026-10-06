"use client";
import Algorithmen from "@/components/algo/Algorithmen";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function AlgoPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  return (
    <RequireAccount icon="🔀" title="Algorithmen-Werkstatt">
      <Algorithmen action={<ToolSessionBar tool="algo" title="Algorithmen-Werkstatt" />} verwaltung={lehrkraft}
        speicherSchluessel={auth ? `hp_algo_stand_konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "hp_algo_stand"} />
    </RequireAccount>
  );
}
