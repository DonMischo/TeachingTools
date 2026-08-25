"use client";

import { useParams } from "next/navigation";
import { SeatingEditor } from "@/components/SeatingEditor";

export default function KlassenSitzplanPage() {
  const params = useParams();
  return <SeatingEditor scope={{ kind: "class", id: Number(params.classId) }} />;
}
