"use client";
import Erosion from "@/components/erosion/Erosion";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function ErosionPage() {
  return (
    <RequireAccount icon="🌧️" title="Erosion">
      <Erosion action={<ToolSessionBar tool="erosion" title="Erosion" />} />
    </RequireAccount>
  );
}
