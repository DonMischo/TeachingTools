"use client";
import ErdAufbau from "@/components/erde/ErdAufbau";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function ErdAufbauPage() {
  return (
    <RequireAccount icon="🌍" title="Aufbau der Erde">
      <ErdAufbau action={<ToolSessionBar tool="erdaufbau" title="Aufbau der Erde" />} />
    </RequireAccount>
  );
}
