"use client";
import Trigonometrie from "@/components/trigonometrie/Trigonometrie";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function TrigonometriePage() {
  return (
    <RequireAccount icon="🔺" title="Trigonometrie">
      <Trigonometrie action={<ToolSessionBar tool="trigonometrie" title="Trigonometrie" />} />
    </RequireAccount>
  );
}
