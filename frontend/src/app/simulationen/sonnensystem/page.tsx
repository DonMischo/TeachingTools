"use client";
import { useEffect, useState } from "react";
import Sonnensystem from "@/components/sonnensystem/Sonnensystem";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function SonnensystemPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  // Wie im Verkehr: die Lehrkraft fliegt gleich im Live-Raum ihres Codes mit.
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!lehrkraft) return;
    api.toolSessions.create("sonnensystem").then((s) => setCode(s.code)).catch(() => setCode(null));
  }, [lehrkraft]);
  return (
    <RequireAccount icon="🪐" title="Sonnensystem">
      <Sonnensystem
        action={<ToolSessionBar tool="sonnensystem" title="Sonnensystem" />}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "geraet"}
        lehrkraft={lehrkraft}
        zugang={code ? { code } : null}
      />
    </RequireAccount>
  );
}
