"use client";
import { useQuery } from "@tanstack/react-query";
import { api, AvailabilityMap, ToolCapability } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Resolved tool availability for the logged-in user. `can(slug, cap)` answers
 * whether the current user may perform that capability — driving both card
 * visibility and host/create/upload button visibility. Elements gated this way
 * are removed entirely, not disabled.
 *
 * While loading (or logged out) `can` returns false, so gated UI stays hidden
 * until the real answer arrives — never flashes then vanishes. Use `ready` to
 * hold back a whole grid until resolved.
 */
export function useAvailability() {
  const { auth } = useAuth();
  const { data, isLoading } = useQuery<AvailabilityMap>({
    queryKey: ["availability-me"],
    queryFn: api.availability.me,
    enabled: !!auth,
    staleTime: 5 * 60 * 1000,
  });

  const ready = !!auth && !isLoading && !!data;

  function can(slug: string, capability: ToolCapability): boolean {
    if (!data) return false;
    return data[slug]?.[capability] ?? false;
  }

  return { can, ready, map: data };
}
