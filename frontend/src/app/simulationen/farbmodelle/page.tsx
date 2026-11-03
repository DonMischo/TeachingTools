"use client";
import Farbmodelle from "@/components/farbmodelle/Farbmodelle";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function FarbmodellePage() {
  return (
    <RequireAccount icon="🎨" title="Farbmodelle">
      <Farbmodelle action={<ToolSessionBar tool="farbmodelle" title="Farbmodelle" />} />
    </RequireAccount>
  );
}
