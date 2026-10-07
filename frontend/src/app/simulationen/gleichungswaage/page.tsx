"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Gleichungswaage from "@/components/waage/Gleichungswaage";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

/**
 * `?reaktion=…`, `?gleichung=…` oder `?formel=…` öffnen die Waage mit genau
 * dieser Aufgabe — so verlinkt das Periodensystem seine Reaktionen hierher.
 * Anders als die Vorgabe einer TaskCrawler-Station sperrt das den Moduswechsel
 * nicht: wer über den Link kommt, darf danach weiterprobieren.
 */
function MitVorgabe() {
  const params = useSearchParams();
  const reaktion = params.get("reaktion");
  const gleichung = params.get("gleichung");
  const formel = params.get("formel");
  const start = reaktion
    ? { modus: "chemie" as const, reaktion }
    : formel
      ? { modus: "variablen" as const, formel, nach: params.get("nach") ?? undefined }
      : gleichung
        ? { modus: "zahlen" as const, gleichung }
        : undefined;
  return <Gleichungswaage action={<ToolSessionBar tool="gleichungswaage" title="Gleichungswaage" />} start={start} />;
}

export default function GleichungswaagePage() {
  return (
    <RequireAccount icon="⚖️" title="Gleichungswaage">
      <Suspense fallback={null}>
        <MitVorgabe />
      </Suspense>
    </RequireAccount>
  );
}
