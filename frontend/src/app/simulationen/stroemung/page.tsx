"use client";
import { useEffect, useState } from "react";
import Stroemung from "@/components/stroemung/Stroemung";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function StroemungPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  // Der Code der Lehrkraft (derselbe wie hinter »Zum Mitmachen«): daran hängt das Rohrnetz für den Baukasten.
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!lehrkraft) return;
    api.toolSessions.create("stroemung").then(s => setCode(s.code)).catch(() => setCode(null));
  }, [lehrkraft]);

  return (
    <RequireAccount icon="💧" title="Druck & Strömung">
      <Stroemung action={<ToolSessionBar tool="stroemung" title="Druck & Strömung" />} code={code} lehrkraft={lehrkraft} />
    </RequireAccount>
  );
}
