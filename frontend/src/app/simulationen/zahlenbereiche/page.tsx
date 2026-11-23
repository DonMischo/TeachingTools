"use client";
import Zahlenbereiche from "@/components/zahlenbereiche/Zahlenbereiche";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function ZahlenbereichePage() {
  return (
    <RequireAccount icon="🪆" title="Zahlenbereiche">
      <Zahlenbereiche action={<ToolSessionBar tool="zahlenbereiche" title="Zahlenbereiche" />} />
    </RequireAccount>
  );
}
