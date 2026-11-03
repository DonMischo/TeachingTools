"use client";
import Koerper from "@/components/koerper/Koerper";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function KoerperPage() {
  return (
    <RequireAccount icon="🧊" title="Körper">
      <Koerper action={<ToolSessionBar tool="koerper" title="Körper" />} />
    </RequireAccount>
  );
}
