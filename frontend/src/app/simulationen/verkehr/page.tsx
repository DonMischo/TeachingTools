"use client";
import { useEffect, useState } from "react";
import Verkehr from "@/components/verkehr/Verkehr";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function VerkehrPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  // Die Lehrkraft ist gleich im Live-Raum ihres Codes (derselbe wie hinter
  // »Zum Mitmachen«) und sieht dort, wer wo läuft. Ohne Lehrkraft: allein.
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!lehrkraft) return;
    api.toolSessions.create("verkehr").then((s) => setCode(s.code)).catch(() => setCode(null));
  }, [lehrkraft]);

  return (
    <RequireAccount icon="🚦" title="GTA – Ganztagsaufmerksamkeit im Verkehr – zu Fuß">
      <Verkehr action={<ToolSessionBar tool="verkehr" title="GTA – Ganztagsaufmerksamkeit im Verkehr – zu Fuß" />} zugang={code ? { code } : null}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "geraet"}
        konto={auth?.user_type === "student"} />
    </RequireAccount>
  );
}
