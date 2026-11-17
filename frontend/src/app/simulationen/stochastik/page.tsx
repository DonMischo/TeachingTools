"use client";
import Stochastik from "@/components/stochastik/Stochastik";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function StochastikPage() {
  return (
    <RequireAccount icon="🎲" title="Daten und Stochastik">
      <Stochastik action={<ToolSessionBar tool="stochastik" title="Daten und Stochastik" />} />
    </RequireAccount>
  );
}
