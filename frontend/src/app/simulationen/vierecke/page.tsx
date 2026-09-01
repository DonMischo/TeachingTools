"use client";
import Vierecke from "@/components/simulationen/Vierecke";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function ViereckePage() {
  return (
    <RequireAccount icon="📐" title="Vierecke">
      <Vierecke action={<ToolSessionBar tool="vierecke" title="Vierecke" />} />
    </RequireAccount>
  );
}
