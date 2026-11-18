"use client";
import Stadtentwicklung from "@/components/stadt/Stadtentwicklung";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function StadtPage() {
  const { auth } = useAuth();
  return (
    <RequireAccount icon="🏘️" title="Stadtentwicklung">
      <Stadtentwicklung action={<ToolSessionBar tool="stadt" title="Stadtentwicklung" />}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "geraet"} />
    </RequireAccount>
  );
}
