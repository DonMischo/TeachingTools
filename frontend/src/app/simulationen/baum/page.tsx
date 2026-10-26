"use client";
import Baumleben from "@/components/baum/Baumleben";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function BaumPage() {
  return (
    <RequireAccount icon="🌳" title="Baumleben">
      <Baumleben action={<ToolSessionBar tool="baum" title="Baumleben" />} />
    </RequireAccount>
  );
}
