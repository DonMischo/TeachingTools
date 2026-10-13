"use client";
import Rechenzeichen from "@/components/rechenzeichen/Rechenzeichen";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function RechenzeichenPage() {
  return (
    <RequireAccount icon="➗" title="Rechenzeichen">
      <Rechenzeichen action={<ToolSessionBar tool="rechenzeichen" title="Rechenzeichen" />} />
    </RequireAccount>
  );
}
