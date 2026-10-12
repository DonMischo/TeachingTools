"use client";
import Periodensystem from "@/components/pse/Periodensystem";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function AtommodellePage() {
  return (
    <RequireAccount icon="⚛️" title="Atommodelle">
      <Periodensystem nur="modelle"
        action={<ToolSessionBar tool="atommodelle" title="Atommodelle" />} />
    </RequireAccount>
  );
}
