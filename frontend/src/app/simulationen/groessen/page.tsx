"use client";
import Groessen from "@/components/groessen/Groessen";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function GroessenPage() {
  return (
    <RequireAccount icon="🪜" title="Größen & Einheiten">
      <Groessen action={<ToolSessionBar tool="groessen" title="Größen & Einheiten" />} />
    </RequireAccount>
  );
}
