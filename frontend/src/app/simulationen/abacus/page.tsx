"use client";
import Abakus from "@/components/simulationen/Abakus";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function AbacusPage() {
  return (
    <RequireAccount icon="🧮" title="Abakus">
      <Abakus action={<ToolSessionBar tool="abacus" title="Abakus" />} />
    </RequireAccount>
  );
}
