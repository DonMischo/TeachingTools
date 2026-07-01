"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join() {
    const c = code.trim().toUpperCase();
    if (c) router.push(`/play/${c}`);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
      <h1 className="text-3xl font-bold">Spiel beitreten</h1>
      <input
        autoFocus
        className="w-full max-w-xs border rounded px-4 py-3 text-center text-2xl font-mono tracking-widest uppercase"
        placeholder="CODE"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && join()}
      />
      <button
        onClick={join}
        disabled={!code.trim()}
        className="w-full max-w-xs py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40"
      >
        Beitreten
      </button>
    </div>
  );
}
