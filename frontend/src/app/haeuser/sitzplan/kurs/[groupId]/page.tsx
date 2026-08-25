"use client";

import { useParams } from "next/navigation";
import { SeatingEditor } from "@/components/SeatingEditor";

export default function KursSitzplanPage() {
  const params = useParams();
  return <SeatingEditor scope={{ kind: "group", id: Number(params.groupId) }} />;
}
