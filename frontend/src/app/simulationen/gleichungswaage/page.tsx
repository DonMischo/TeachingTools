"use client";
import Gleichungswaage from "@/components/waage/Gleichungswaage";
import { ToolSessionBar } from "@/components/ToolSessionBar";

export default function GleichungswaagePage() {
  return <Gleichungswaage action={<ToolSessionBar tool="gleichungswaage" title="Gleichungswaage" />} />;
}
