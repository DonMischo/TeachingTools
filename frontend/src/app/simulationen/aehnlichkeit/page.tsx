"use client";
import Aehnlichkeit from "@/components/aehnlichkeit/Aehnlichkeit";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function AehnlichkeitPage() {
  return (
    <RequireAccount icon="🔍" title="Ähnlichkeit und Maßstab">
      <Aehnlichkeit action={<ToolSessionBar tool="aehnlichkeit" title="Ähnlichkeit und Maßstab" />} />
    </RequireAccount>
  );
}
