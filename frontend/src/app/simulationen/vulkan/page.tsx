"use client";
import Vulkan from "@/components/vulkan/Vulkan";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";

export default function VulkanPage() {
  return (
    <RequireAccount icon="🌋" title="Vulkane">
      <Vulkan action={<ToolSessionBar tool="vulkan" title="Vulkane" />} />
    </RequireAccount>
  );
}
