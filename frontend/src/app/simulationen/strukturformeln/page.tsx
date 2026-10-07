"use client";
import Strukturformeln from "@/components/struktur/Strukturformeln";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function StrukturformelnPage() {
  return (
    <RequireAccount icon="⬡" title="Strukturformeln">
      <Strukturformeln action={<ToolSessionBar tool="strukturformeln" title="Strukturformeln" />} />
    </RequireAccount>
  );
}
