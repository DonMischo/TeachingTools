"use client";
import Spielalgorithmen from "@/components/spielalgo/Spielalgorithmen";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function SpielalgoPage() {
  return (
    <RequireAccount icon="🎲" title="Spielalgorithmen">
      <Spielalgorithmen action={<ToolSessionBar tool="spielalgo" title="Spielalgorithmen" />} />
    </RequireAccount>
  );
}
