"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

/**
 * Per-class availability for a Klassenlehrer: the same matrix admins use, but
 * locked to the teacher's own class (Teacher.klasse_id) so they can open up or
 * lock down tools for their class without going through an admin.
 */
export default function ClassAvailabilityPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const klasseId = auth?.teacher?.klasse_id ?? null;

  // Only a teacher who is Klassenlehrer of a class may use this page.
  useEffect(() => {
    if (auth && (auth.user_type !== "teacher" || klasseId == null)) router.replace("/");
  }, [auth, klasseId, router]);

  if (!auth || auth.user_type !== "teacher" || klasseId == null) return null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div>
        <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Start</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">
          🧩 Verfügbarkeit · {auth.teacher?.klasse ?? "meine Klasse"}
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Schalte Werkzeuge für deine Klasse frei oder sperre sie. „Standard" folgt der
          globalen Einstellung; „Ja"/„Nein" überschreiben sie nur für deine Klasse.
        </p>
      </div>

      <AvailabilityGrid classId={klasseId} canEdit />
    </div>
  );
}
