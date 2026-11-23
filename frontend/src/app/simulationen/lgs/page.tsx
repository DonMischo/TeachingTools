"use client";
import Lgs from "@/components/lgs/Lgs";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function LgsPage() {
  return (
    <RequireAccount icon="🔀" title="Lineare Gleichungssysteme">
      <Lgs action={<ToolSessionBar tool="lgs" title="Lineare Gleichungssysteme" />} />
    </RequireAccount>
  );
}
