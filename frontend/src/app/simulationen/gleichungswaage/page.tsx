"use client";
import Gleichungswaage from "@/components/waage/Gleichungswaage";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function GleichungswaagePage() {
  return (
    <RequireAccount icon="⚖️" title="Gleichungswaage">
      <Gleichungswaage action={<ToolSessionBar tool="gleichungswaage" title="Gleichungswaage" />} />
    </RequireAccount>
  );
}
