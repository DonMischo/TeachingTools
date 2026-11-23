"use client";
import Schriftlich from "@/components/schriftlich/Schriftlich";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function SchriftlichPage() {
  return (
    <RequireAccount icon="✏️" title="Schriftliche Rechenverfahren">
      <Schriftlich action={<ToolSessionBar tool="schriftlich" title="Schriftliche Rechenverfahren" />} />
    </RequireAccount>
  );
}
