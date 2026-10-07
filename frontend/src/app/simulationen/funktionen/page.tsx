"use client";
import FunktionenWerkzeug from "@/components/simulationen/FunktionenWerkzeug";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function FunktionenPage() {
  return (
    <RequireAccount icon="📈" title="Funktionen und Koordinatensystem">
      <FunktionenWerkzeug action={<ToolSessionBar tool="funktionen" title="Funktionen und Koordinatensystem" />} />
    </RequireAccount>
  );
}
