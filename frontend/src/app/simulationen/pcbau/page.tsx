"use client";
import PcWerkstatt from "@/components/pcbau/PcWerkstatt";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function PcBauPage() {
  return (
    <RequireAccount icon="🪛" title="PC-Werkstatt">
      <PcWerkstatt action={<ToolSessionBar tool="pcbau" title="PC-Werkstatt" />} />
    </RequireAccount>
  );
}
