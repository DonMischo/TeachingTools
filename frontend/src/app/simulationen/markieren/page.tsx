"use client";
import Markieren from "@/components/markieren/Markieren";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function MarkierenPage() {
  return (
    <RequireAccount icon="🖍️" title="Markieren & Bearbeiten">
      <Markieren action={<ToolSessionBar tool="markieren" title="Markieren & Bearbeiten" />} />
    </RequireAccount>
  );
}
