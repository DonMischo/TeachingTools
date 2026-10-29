"use client";
import Klikk from "@/components/klikk/Klikk";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function KlikkPage() {
  const { auth } = useAuth();
  return (
    <RequireAccount icon="📱" title="Klikk">
      <Klikk action={<ToolSessionBar tool="klikk" title="Klikk" />} verwaltung={!!auth && auth.user_type !== "student"} />
    </RequireAccount>
  );
}
