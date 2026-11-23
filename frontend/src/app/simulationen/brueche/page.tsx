"use client";
import Brueche from "@/components/brueche/Brueche";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function BruechePage() {
  return (
    <RequireAccount icon="🍕" title="Brüche">
      <Brueche action={<ToolSessionBar tool="brueche" title="Brüche" />} />
    </RequireAccount>
  );
}
