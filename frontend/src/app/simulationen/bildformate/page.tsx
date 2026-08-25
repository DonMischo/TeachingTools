"use client";
import Bildformate from "@/components/simulationen/Bildformate";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function BildformatePage() {
  return (
    <RequireAccount icon="🖼️" title="Bildformate">
      <Bildformate action={<ToolSessionBar tool="bildformate" title="Bildformate" />} />
    </RequireAccount>
  );
}
