"use client";
import Dreiecke from "@/components/dreiecke/Dreiecke";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function DreieckePage() {
  return (
    <RequireAccount icon="△" title="Dreiecke">
      <Dreiecke action={<ToolSessionBar tool="dreiecke" title="Dreiecke" />} />
    </RequireAccount>
  );
}
