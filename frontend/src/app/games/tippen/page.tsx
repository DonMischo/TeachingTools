"use client";
import Tippen from "@/components/tippen/Tippen";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function TippenPage() {
  return (
    <RequireAccount icon="⌨️" title="Tippen">
      <Tippen action={<ToolSessionBar tool="tippen" title="Tippen" />} verwaltung />
    </RequireAccount>
  );
}
