"use client";
import Wachstum from "@/components/dla/Wachstum";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function DlaPage() {
  return (
    <RequireAccount icon="🪸" title="Fraktales Wachstum">
      <Wachstum action={<ToolSessionBar tool="dla" title="Fraktales Wachstum" />} />
    </RequireAccount>
  );
}
