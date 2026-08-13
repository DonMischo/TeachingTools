"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

/**
 * Guard for an admin sub-page. Redirects to "/" once resolved if the user lacks
 * the feature(s) (any one of an array suffices). Returns `ok` — render the page
 * only when true. Admins always pass.
 */
export function useRequireAdminFeature(feature: string | string[]) {
  const { auth } = useAuth();
  const router = useRouter();
  const { ready, isAdmin, has } = useAdminAccess();
  const slugs = Array.isArray(feature) ? feature : [feature];
  const allowed = isAdmin || slugs.some(has);

  useEffect(() => {
    if (ready && !allowed) router.replace("/");
  }, [ready, allowed, router]);

  return { ok: !!auth && ready && allowed, isAdmin };
}
