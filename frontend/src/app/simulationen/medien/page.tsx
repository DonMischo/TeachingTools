"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Medien from "@/components/medien/Medien";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

/** `?station=telegraf` öffnet die Zeitreise an dieser Station (auch noch gesperrte). */
function MitStation() {
  const station = useSearchParams().get("station");
  return <Medien speicher="konto" vorgabe={station ? { station } : undefined}
    action={<ToolSessionBar tool="medien" title="Geschichte der Medien" />} />;
}

export default function MedienPage() {
  return (
    <RequireAccount icon="📜" title="Geschichte der Medien">
      <Suspense fallback={null}>
        <MitStation />
      </Suspense>
    </RequireAccount>
  );
}
