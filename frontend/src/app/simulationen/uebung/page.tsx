"use client";
import Uebung from "@/components/simulationen/Uebung";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function UebungPage() {
  return (
    <RequireAccount icon="📚" title="Übung">
      <Uebung action={<ToolSessionBar tool="uebung" title="Übung" />} />
    </RequireAccount>
  );
}
