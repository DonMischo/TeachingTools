"use client";
import Wellenkollaps from "@/components/wfc/Wellenkollaps";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function WfcPage() {
  return (
    <RequireAccount icon="🧩" title="Wellenfunktionskollaps">
      <Wellenkollaps action={<ToolSessionBar tool="wfc" title="Wellenfunktionskollaps" />} />
    </RequireAccount>
  );
}
