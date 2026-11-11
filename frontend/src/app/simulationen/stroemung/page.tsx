"use client";
import Stroemung from "@/components/stroemung/Stroemung";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function StroemungPage() {
  return (
    <RequireAccount icon="💧" title="Druck & Strömung">
      <Stroemung action={<ToolSessionBar tool="stroemung" title="Druck & Strömung" />} />
    </RequireAccount>
  );
}
