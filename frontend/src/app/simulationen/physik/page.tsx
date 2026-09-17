"use client";
import PhysikLabor from "@/components/physik/PhysikLabor";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function PhysikPage() {
  const { auth } = useAuth();
  return (
    <RequireAccount icon="🔬" title="Physiklabor">
      <PhysikLabor
        action={<ToolSessionBar tool="physik" title="Physiklabor" />}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "geraet"}
      />
    </RequireAccount>
  );
}
