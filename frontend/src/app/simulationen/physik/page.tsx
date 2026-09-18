"use client";
import Baukasten from "@/components/physik/baukasten/Baukasten";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function PhysikPage() {
  const { auth } = useAuth();
  return (
    <RequireAccount icon="🔬" title="Physiklabor">
      <Baukasten
        action={<ToolSessionBar tool="physik" title="Physiklabor" />}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "geraet"}
      />
    </RequireAccount>
  );
}
