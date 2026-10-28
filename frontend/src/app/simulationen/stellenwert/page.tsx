"use client";
import Stellenwert from "@/components/stellenwert/Stellenwert";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function StellenwertPage() {
  return (
    <RequireAccount icon="🔢" title="Stellenwerttafeln">
      <Stellenwert action={<ToolSessionBar tool="stellenwert" title="Stellenwerttafeln" />} />
    </RequireAccount>
  );
}
