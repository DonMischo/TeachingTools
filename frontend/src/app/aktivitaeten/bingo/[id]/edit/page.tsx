"use client";
import { useParams } from "next/navigation";
import BingoEditor from "@/components/BingoEditor";

export default function BingoEditPage() {
  const { id } = useParams<{ id: string }>();
  return <BingoEditor editId={Number(id)} />;
}
