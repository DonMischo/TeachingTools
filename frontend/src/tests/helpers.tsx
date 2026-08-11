import { ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TeacherOut } from "@/lib/api";

export function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

export function makeTeacher(overrides: Partial<TeacherOut> = {}): TeacherOut {
  return {
    id: 1,
    first_name: "Anna",
    last_name: "Müller",
    active: true,
    role: "teacher",
    nummer: null,
    email: null,
    teacher_role: null,
    klasse: null,
    klasse_id: null,
    assignments: [],
    korrektur: 0,
    notiz: null,
    av_stunden: null,
    total_ws: 0,
    ...overrides,
  };
}

export function makeClass(overrides = {}) {
  return {
    id: 1,
    code: "5a",
    display_name: "",
    symbol_emoji: null,
    symbol_image: null,
    total_points: 0,
    ...overrides,
  };
}
