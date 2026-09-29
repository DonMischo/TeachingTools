"use client";
import RegelLabor from "@/components/regeln/RegelLabor";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function RegelnPage() {
  return (
    <RequireAccount icon="🧬" title="Regel-Labor">
      <RegelLabor action={<ToolSessionBar tool="regeln" title="Regel-Labor" />} />
    </RequireAccount>
  );
}
