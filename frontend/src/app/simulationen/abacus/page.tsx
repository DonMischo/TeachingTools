"use client";
import Abakus from "@/components/simulationen/Abakus";
import { ToolSessionBar } from "@/components/ToolSessionBar";

export default function AbacusPage() {
  return <Abakus action={<ToolSessionBar tool="abacus" title="Abakus" />} />;
}
