"use client";
import Markieren from "@/components/markieren/Markieren";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function MarkierenPage() {
  const { auth } = useAuth();
  return (
    <RequireAccount icon="🖍️" title="Markieren & Bearbeiten">
      <Markieren
        action={<ToolSessionBar tool="markieren" title="Markieren & Bearbeiten" />}
        rangliste={{ klasse: auth?.student?.klasse ?? null, verwaltung: !!auth && auth.user_type !== "student" }}
      />
    </RequireAccount>
  );
}
