"use client";
import Quadratisch from "@/components/quadratisch/Quadratisch";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function QuadratischPage() {
  return (
    <RequireAccount icon="⛲" title="Quadratische Funktionen">
      <Quadratisch action={<ToolSessionBar tool="quadratisch" title="Quadratische Funktionen" />} />
    </RequireAccount>
  );
}
