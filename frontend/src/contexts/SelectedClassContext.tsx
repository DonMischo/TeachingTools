"use client";

import { createContext, useContext, useState } from "react";
import { ClassOut } from "@/lib/api";

type Ctx = { selectedClass: ClassOut | null; setSelectedClass: (c: ClassOut | null) => void };

const SelectedClassContext = createContext<Ctx>({ selectedClass: null, setSelectedClass: () => {} });

export function SelectedClassProvider({ children }: { children: React.ReactNode }) {
  const [selectedClass, setSelectedClass] = useState<ClassOut | null>(null);
  return (
    <SelectedClassContext.Provider value={{ selectedClass, setSelectedClass }}>
      {children}
    </SelectedClassContext.Provider>
  );
}

export function useSelectedClass() {
  return useContext(SelectedClassContext);
}
