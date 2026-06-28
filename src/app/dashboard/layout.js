"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  emitSessionChange,
  useBusinessSession,
  useDarkModePreference,
  useHydrated,
} from "../../lib/clientSession";

const navItems = [
  { name: "Dashboard", href: "/dashboard", badge: "D" },
  { name: "Customer groups", href: "/dashboard/categories", badge: "G" },
  { name: "Customer overview", href: "/dashboard/customers", badge: "C" },
  { name: "Invoices", href: "/dashboard/invoices", badge: "I" },
  { name: "Payment history", href: "/dashboard/payments", badge: "P" },
  { name: "Settings", href: "/dashboard/settings", badge: "S" },
];

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export default function DashboardLayout({ children }) {
  const [currentTime, setCurrentTime] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const session = useBusinessSession();
  const darkMode = useDarkModePreference();
  const isHydrated = useHydrated();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!session.isLoggedIn) {
      router.replace("/auth/login");
    }
  }, [isHydrated, router, session.isLoggedIn]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [isHydrated]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncSidebar = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };

    syncSidebar();
    window.addEventListener("resize", syncSidebar);
    return () => window.removeEventListener("resize", syncSidebar);
  }, []);

  const formattedDate =
    currentTime?.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) || "";

  const formattedTime =
    currentTime?.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) || "";

  const handleLogout = useCallback(() => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("businessName");
    localStorage.removeItem("businessType");
    localStorage.removeItem("businessLogo");
    emitSessionChange();
    router.replace("/auth/login");
  }, [router]);

  useEffect(() => {
    if (!isHydrated || !session.isLoggedIn || typeof window === "undefined") {
      return undefined;
    }

    let timeoutId = null;

    const logoutForInactivity = () => {
      localStorage.setItem("logoutReason", "inactive");
      handleLogout();
    };

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(logoutForInactivity, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [handleLogout, isHydrated, pathname, session.isLoggedIn]);

  const handleNavClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  if (!isHydrated || !session.isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 lg:h-screen">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-800 dark:bg-gray-900 lg:static lg:z-auto lg:w-72 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 p-6 dark:border-gray-800">
          {session.businessLogo ? (
            <Image
              src={session.businessLogo}
              alt={session.businessName || "Business logo"}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 rounded-2xl border border-gray-200 object-cover dark:border-gray-700"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 font-semibold text-white">
              {(session.businessName || session.userName || "I").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 dark:text-white">
              {session.businessName || "InvoiceHub"}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Billing and collections workspace
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`mb-1 flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {item.badge}
                </span>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-gray-200 p-4 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-red-600 transition-all hover:bg-red-50 dark:hover:bg-red-950/50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-xs font-semibold dark:bg-red-950/50">
              Q
            </span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-slate-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            {sidebarOpen ? "Close menu" : "Open menu"}
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3 sm:gap-4">
            <div className="hidden text-right text-sm text-gray-500 dark:text-gray-400 xl:block">
              {currentTime ? `${formattedDate} | ${formattedTime}` : ""}
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {session.userName || "User"}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {session.businessType || "Business"}
                </p>
              </div>

              {session.businessLogo ? (
                <Image
                  src={session.businessLogo}
                  alt={session.businessName || "Business logo"}
                  width={36}
                  height={36}
                  unoptimized
                  className="h-9 w-9 rounded-full border border-gray-200 object-cover dark:border-gray-700"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-medium text-white">
                  {(session.userName || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 p-4 dark:bg-gray-950 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
