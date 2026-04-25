"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Invisible client component — sole job is to redirect
 * logged-in users to /feed. Keeps page.tsx as a pure server component.
 */
export function HomeAuthRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/feed");
  }, [loading, user, router]);

  return null;
}