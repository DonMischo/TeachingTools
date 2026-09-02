"use client";
import Rechenregeln from "@/components/simulationen/Rechenregeln";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function RechenregelnPage() {
  return (
    <RequireAccount icon="🍎" title="Rechenregeln">
      <Rechenregeln action={<ToolSessionBar tool="rechenregeln" title="Rechenregeln" />} />
    </RequireAccount>
  );
}
