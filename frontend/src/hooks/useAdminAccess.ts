"use client";
import { useQuery } from "@tanstack/react-query";
import { api, AdminAccessMe } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Which admin features the logged-in user may reach. Drives the Sidebar admin
 * icon, the /admin card grid, and per-page guards. Admins get everything;
 * students get nothing. `has(slug)` is false until resolved, so gated UI stays
 * hidden rather than flashing.
 */
export function useAdminAccess() {
  const { auth } = useAuth();
  const { data, isLoading } = useQuery<AdminAccessMe>({
    queryKey: ["admin-access-me"],
    queryFn: api.adminAccess.me,
    enabled: !!auth && auth.user_type === "teacher",
    staleTime: 5 * 60 * 1000,
  });

  const ready = !!auth && (auth.user_type !== "teacher" || (!isLoading && !!data));
  const isAdmin = data?.is_admin ?? false;
  const features = data?.features ?? [];

  return {
    ready,
    isAdmin,
    features,
    has: (slug: string) => features.includes(slug),
    hasAny: features.length > 0,
  };
}
