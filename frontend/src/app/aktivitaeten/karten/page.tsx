"use client";
import Karten from "@/components/karten/Karten";
import { RequireAccount } from "@/components/RequireAccount";
import { ToolSessionBar } from "@/components/ToolSessionBar";

export default function KartenPage() {
  return (
    <RequireAccount icon="🗺️" title="Karten">
      {/* Code ohne Kartensatz: die Klasse erkundet das ganze Kartentool (Quiz-Codes gibt es je Satz) */}
      <Karten action={<ToolSessionBar tool="karten" title="Karten erkunden" />} />
    </RequireAccount>
  );
}
