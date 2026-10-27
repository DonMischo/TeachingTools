"use client";
import Prozent from "@/components/prozent/Prozent";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function ProzentPage() {
  return (
    <RequireAccount icon="💯" title="Prozent- und Zinsrechnung">
      <Prozent action={<ToolSessionBar tool="prozent" title="Prozent- und Zinsrechnung" />} />
    </RequireAccount>
  );
}
