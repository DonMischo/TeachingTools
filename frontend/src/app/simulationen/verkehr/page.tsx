"use client";
import Verkehr from "@/components/verkehr/Verkehr";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function VerkehrPage() {
  return (
    <RequireAccount icon="🚦" title="Verkehrssicherheit">
      <Verkehr action={<ToolSessionBar tool="verkehr" title="Verkehrssicherheit" />} />
    </RequireAccount>
  );
}
