"use client";
import Medien from "@/components/medien/Medien";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function MedienPage() {
  return (
    <RequireAccount icon="📜" title="Geschichte der Medien">
      <Medien speicher="konto" action={<ToolSessionBar tool="medien" title="Geschichte der Medien" />} />
    </RequireAccount>
  );
}
