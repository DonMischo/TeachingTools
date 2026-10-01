"use client";
import Karten from "@/components/karten/Karten";
import { RequireAccount } from "@/components/RequireAccount";

export default function KartenPage() {
  return (
    <RequireAccount icon="🗺️" title="Karten">
      <Karten />
    </RequireAccount>
  );
}
