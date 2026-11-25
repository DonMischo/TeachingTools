"use client";
import MainCharacter from "@/components/mainCharacter/MainCharacter";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function MainCharacterPage() {
  const { auth } = useAuth();
  const id = auth?.student?.id ?? auth?.teacher?.id ?? 0;
  return (
    <RequireAccount icon="👑" title="Main Character">
      <MainCharacter
        action={<ToolSessionBar tool="main-character" title="Main Character" anonym />}
        lehrkraft={!!auth && auth.user_type !== "student"}
        speicherSchluessel={`konto-${auth?.user_type ?? "unbekannt"}-${id}`}
      />
    </RequireAccount>
  );
}
