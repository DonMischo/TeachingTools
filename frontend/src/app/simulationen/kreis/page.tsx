"use client";
import Kreis from "@/components/kreis/Kreis";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function KreisPage() {
  return (
    <RequireAccount icon="⭕" title="Kreis">
      <Kreis action={<ToolSessionBar tool="kreis" title="Kreis" />} />
    </RequireAccount>
  );
}
