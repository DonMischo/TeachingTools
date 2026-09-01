"use client";
import Funktionen from "@/components/simulationen/Funktionen";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function FunktionenPage() {
  return (
    <RequireAccount icon="📈" title="Funktionen">
      <Funktionen action={<ToolSessionBar tool="funktionen" title="Funktionen" />} />
    </RequireAccount>
  );
}
