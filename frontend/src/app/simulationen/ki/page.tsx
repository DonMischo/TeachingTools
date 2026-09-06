"use client";
import KiWerkstatt from "@/components/ki/KiWerkstatt";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function KiPage() {
  return (
    <RequireAccount icon="🤖" title="KI-Werkstatt">
      <KiWerkstatt action={<ToolSessionBar tool="ki" title="KI-Werkstatt" />} />
    </RequireAccount>
  );
}
