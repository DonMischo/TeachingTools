"use client";
import Schichtenmodell from "@/components/schichten/Schichtenmodell";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function SchichtenPage() {
  return (
    <RequireAccount icon="📶" title="Schichtenmodell">
      <Schichtenmodell action={<ToolSessionBar tool="schichten" title="Schichtenmodell" />} />
    </RequireAccount>
  );
}
