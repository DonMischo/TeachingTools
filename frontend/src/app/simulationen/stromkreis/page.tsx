"use client";
import { useEffect, useState } from "react";
import Stromkreis from "@/components/stromkreis/Stromkreis";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function StromkreisPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  // Die Lehrkraft hat ihren Code (derselbe wie hinter »Zum Mitmachen«); an ihm
  // hängt die Schaltung, mit der die Klasse beginnt.
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!lehrkraft) return;
    api.toolSessions.create("stromkreis").then((s) => setCode(s.code)).catch(() => setCode(null));
  }, [lehrkraft]);

  return (
    <RequireAccount icon="💡" title="Stromkreise">
      <Stromkreis action={<ToolSessionBar tool="stromkreis" title="Stromkreise" />} code={code} lehrkraft={lehrkraft} />
    </RequireAccount>
  );
}
