"use client";
import Sonnensystem from "@/components/sonnensystem/Sonnensystem";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function SonnensystemPage() {
  const { auth } = useAuth();
  return (
    <RequireAccount icon="🪐" title="Sonnensystem">
      <Sonnensystem
        action={<ToolSessionBar tool="sonnensystem" title="Sonnensystem" />}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "geraet"}
        lehrkraft={auth?.role === "teacher" || auth?.role === "admin"}
      />
    </RequireAccount>
  );
}
