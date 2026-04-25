"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Home,
  MessageSquare,
  Bell,
  Search,
  User,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { notifications as notifApi } from "@/lib/api";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread notification count every 15s
  useEffect(() => {
    if (!user) return;
    const fetchCount = () =>
      notifApi.list().then((items) => setUnreadCount(items.filter((n) => !n.read).length)).catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [user]);

  // Clear badge when on the notifications page
  useEffect(() => {
    if (pathname === "/notifications") setUnreadCount(0);
  }, [pathname]);

  // Sliding indicator refs
  const navInnerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const firstPositionSet = useRef(false);
  const lastNavNodeRef = useRef<HTMLDivElement | null>(null);

  const isAuthPage = pathname.startsWith("/auth/");

  const protectedPrefixes = ["/messages", "/notifications", "/create-post", "/settings", "/dashboard"];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  const shouldRedirect = !isAuthPage && isProtected && !loading && !user;

  useEffect(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("kec-theme") : null;
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/auth/sign-in");
    }
  }, [shouldRedirect, router]);

  const isHome = pathname === "/";
  const reservedTopLevel = new Set([
    "auth", "feed", "messages", "notifications", "create-post",
    "settings", "dashboard", "post", "profile", "public-posts",
    "search", "tag", "api", "groups", "invite",
  ]);
  const topLevelSegment = pathname.split("/").filter(Boolean);
  const isTopLevelProfileRoute =
    topLevelSegment.length === 1 && !reservedTopLevel.has(topLevelSegment[0]);
  const isPostDetailRoute =
    topLevelSegment.length === 2 && !reservedTopLevel.has(topLevelSegment[0]);
  const hideNavbarForOtherProfile =
    isTopLevelProfileRoute && (!user?.username || topLevelSegment[0] !== user.username);
  const isGroupChat =
    pathname.startsWith("/messages/group-") ||
    pathname.startsWith("/groups/") ||
    pathname.startsWith("/invite/");
  const hideNavbar = hideNavbarForOtherProfile || isPostDetailRoute || isGroupChat;

  const profileHref = user
    ? user.username ? `/${user.username}` : `/profile/${user.id}`
    : "/auth/sign-in";
  const canCreatePost = user && (user.role === "faculty" || user.role === "admin");
  const isAdmin = user?.role === "admin";

  const NAV_LINKS = [
    { href: "/feed",           label: "Home",        icon: Home           },
    { href: "/search",         label: "Search",      icon: Search         },
    ...(canCreatePost ? [{ href: "/create-post", label: "Create", icon: Plus }] : []),
    { href: "/messages",       label: "Messages",    icon: MessageSquare  },
    { href: "/notifications",  label: "Notifications", icon: Bell         },
    ...(isAdmin ? [{ href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard }] : []),
    { href: profileHref,       label: "Profile",     icon: User, isProfile: true },
  ];

  // Slide the active indicator to the correct tab after every render that
  // could change which link is active (pathname, user, loading).
  useLayoutEffect(() => {
    const nav = navInnerRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    const activeEl = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
    if (!activeEl) return;

    const left = activeEl.offsetLeft;

    // Detect nav remount (e.g. returning from a chat where hideNavbar was true).
    // The DOM node changes → the indicator element is brand new and sits at translateX(0).
    // Reset firstPositionSet so we snap instead of animating from 0.
    const navChanged = nav !== lastNavNodeRef.current;
    if (navChanged) {
      lastNavNodeRef.current = nav;
      firstPositionSet.current = false;
    }

    if (!firstPositionSet.current) {
      // First paint or remount: snap with no transition so it doesn't slide from 0
      indicator.style.transition = "none";
      indicator.style.transform = `translateX(${left}px)`;
      firstPositionSet.current = true;
      // Re-enable transition after the browser has committed this frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (indicatorRef.current) {
            indicatorRef.current.style.transition =
              "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)";
          }
        });
      });
    } else {
      indicator.style.transform = `translateX(${left}px)`;
    }
  });

  if (isAuthPage) {
    return <div className="min-h-dvh bg-white">{children}</div>;
  }

  if (shouldRedirect) return null;

  const showAvatar = !loading && !!user?.avatar_base64;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Content */}
      <main
        ref={mainRef}
        className={`flex-1 ${isHome ? "" : "mx-auto w-full max-w-3xl px-6 py-8"}`}
      >
        <div className="animate-page">{children}</div>
      </main>

      {/* Bottom Pill Navbar */}
      {!isHome && !hideNavbar && (
        <nav className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div
            ref={navInnerRef}
            className="relative flex items-center gap-1 rounded-full border px-2 py-2 shadow-lg shadow-black/5 backdrop-blur-xl"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "color-mix(in srgb, var(--bg) 90%, transparent)",
            }}
          >
            {/* Sliding black indicator — moves behind the active icon */}
            <div
              ref={indicatorRef}
              className="pointer-events-none absolute top-2 h-10 w-10 rounded-full bg-black"
              style={{ left: 0 }}
            />

            {NAV_LINKS.map((link) => {
              const active = link.isProfile
                ? isActive(pathname, "/profile") ||
                  (!!user?.username && pathname === `/${user.username}`)
                : isActive(pathname, link.href);

              // Profile with avatar — avatar image covers the sliding indicator;
              // add a ring on active so it's still visually clear.
              if (link.isProfile && showAvatar) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-nav-active={active ? "true" : undefined}
                    title={link.label}
                    aria-label={link.label}
                    className={`relative z-10 grid h-10 w-10 place-items-center rounded-full transition-[box-shadow] overflow-hidden ${
                      active ? "ring-2 ring-black ring-offset-1" : "hover:opacity-90"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user!.avatar_base64!}
                      alt="Profile"
                      className="h-full w-full rounded-full object-cover"
                    />
                  </Link>
                );
              }

              const showBadge = link.href === "/notifications" && unreadCount > 0 && !active;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-nav-active={active ? "true" : undefined}
                  title={link.label}
                  aria-label={link.label}
                  className={`relative z-10 grid h-10 w-10 place-items-center rounded-full transition-colors ${
                    active
                      ? "text-white"
                      : "text-gray-400 hover:text-black hover:bg-gray-100"
                  }`}
                >
                  <link.icon size={18} />
                  {showBadge && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
