"use client";
import Periodensystem from "@/components/pse/Periodensystem";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function PsePage() {
  return (
    <RequireAccount icon="🧪" title="Periodensystem">
      <Periodensystem action={<ToolSessionBar tool="pse" title="Periodensystem" />} />
    </RequireAccount>
  );
}
