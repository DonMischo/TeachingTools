"use client";
import DiagrammWerkstatt from "@/components/diagramme/DiagrammWerkstatt";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function DiagrammePage() {
  return (
    <RequireAccount icon="🔀" title="Diagramm-Werkstatt">
      <DiagrammWerkstatt action={<ToolSessionBar tool="diagramme" title="Diagramm-Werkstatt" />} />
    </RequireAccount>
  );
}
