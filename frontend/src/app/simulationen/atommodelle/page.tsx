"use client";
import Atomwerkstatt from "@/components/atome/Atomwerkstatt";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function AtommodellePage() {
  return (
    <RequireAccount icon="⚛️" title="Atommodelle">
      <Atomwerkstatt action={<ToolSessionBar tool="atommodelle" title="Atommodelle" />} />
    </RequireAccount>
  );
}
