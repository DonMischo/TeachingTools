"use client";
import Geometrie from "@/components/grundbegriffe/Geometrie";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function GeometriePage() {
  return (
    <RequireAccount icon="📏" title="Geometrie">
      <Geometrie action={<ToolSessionBar tool="geometrie" title="Geometrie" />} />
    </RequireAccount>
  );
}
