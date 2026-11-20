"use client";
import PixelStudio from "@/components/pixel/PixelStudio";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function PixelPage() {
  return (
    <RequireAccount icon="👾" title="Pixel-Studio">
      <PixelStudio action={<ToolSessionBar tool="pixel" title="Pixel-Studio" />} />
    </RequireAccount>
  );
}
