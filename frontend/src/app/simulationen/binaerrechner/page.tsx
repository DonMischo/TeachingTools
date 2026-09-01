"use client";
import Binaerrechner from "@/components/simulationen/Binaerrechner";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function BinaerrechnerPage() {
  return (
    <RequireAccount icon="◈" title="Binär-Rechner">
      <Binaerrechner action={<ToolSessionBar tool="binaerrechner" title="Binär-Rechner" />} />
    </RequireAccount>
  );
}
