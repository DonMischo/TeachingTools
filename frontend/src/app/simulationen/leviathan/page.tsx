"use client";
import { useEffect, useState } from "react";
import Leviathan from "@/components/leviathan/Leviathan";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function LeviathanPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  // Die Lehrkraft hat ihren Code (derselbe wie hinter »Zum Mitmachen«); an ihm
  // hängen die Einstellungen für die Klasse. Schüler:innen ohne Code spielen frei.
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!lehrkraft) return;
    api.toolSessions.create("leviathan").then((s) => setCode(s.code)).catch(() => setCode(null));
  }, [lehrkraft]);

  return (
    <RequireAccount icon="🐋" title="Leviathan">
      <Leviathan action={<ToolSessionBar tool="leviathan" title="Leviathan" />}
        code={code} lehrkraft={lehrkraft}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "geraet"} />
    </RequireAccount>
  );
}
