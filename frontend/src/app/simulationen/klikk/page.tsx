"use client";
import Klikk from "@/components/klikk/Klikk";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function KlikkPage() {
  return (
    <RequireAccount icon="📱" title="Klikk">
      <Klikk action={<ToolSessionBar tool="klikk" title="Klikk" />} />
    </RequireAccount>
  );
}
