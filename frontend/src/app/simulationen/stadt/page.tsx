"use client";
import Stadtentwicklung from "@/components/stadt/Stadtentwicklung";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function StadtPage() {
  return (
    <RequireAccount icon="🏘️" title="Stadtentwicklung">
      <Stadtentwicklung action={<ToolSessionBar tool="stadt" title="Stadtentwicklung" />} />
    </RequireAccount>
  );
}
