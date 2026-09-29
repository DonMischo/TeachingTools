"use client";
import WilsonZyklus from "@/components/wilson/WilsonZyklus";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function WilsonPage() {
  return (
    <RequireAccount icon="🌋" title="Wilson-Zyklus">
      <WilsonZyklus action={<ToolSessionBar tool="wilson" title="Wilson-Zyklus" />} />
    </RequireAccount>
  );
}
