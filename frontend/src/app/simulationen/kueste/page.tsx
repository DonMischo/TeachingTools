"use client";
import Kueste from "@/components/kueste/Kueste";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function KuestePage() {
  return (
    <RequireAccount icon="🌊" title="Küstendynamik">
      <Kueste action={<ToolSessionBar tool="kueste" title="Küstendynamik" />} />
    </RequireAccount>
  );
}
