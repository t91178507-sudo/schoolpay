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
import { getCustomerLabels } from "../../lib/businessLabels";
import { authFetch } from "../../lib/authFetch";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export default function DashboardLayout({ children }) {
  const [currentTime, setCurrentTime] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const session = useBusinessSession();
  const darkMode = useDarkModePreference();
  const isHydrated = useHydrated();
  const customerLabels = getCustomerLabels(session.businessType);
  const navItems = [
    { name: "Dashboard", href: "/dashboard", badge: "D" },
    { name: `${customerLabels.singularTitle} groups`, href: "/dashboard/categories", badge: "G" },
    { name: `${customerLabels.singularTitle} overview`, href: "/dashboard/customers", badge: "C" },
    { name: "Invoices", href: "/dashboard/invoices", badge: "I" },
    { name: "Communication", href: "/dashboard/communication", badge: "M" },
    { name: "Collections history", href: "/dashboard/payments", badge: "P" },
    { name: "Receipt validation", href: "/dashboard/receipts", badge: "V" },
    { name: "Users & Staff", href: "/dashboard/staff", badge: "U" },
    { name: "Settings", href: "/dashboard/settings", badge: "S" },
  ];

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!session.isLoggedIn) {
      router.replace("/auth/login");
      return;
    }

    if (session.accountType === "staff") {
      router.replace("/mobile");
    }
  }, [isHydrated, router, session.accountType, session.isLoggedIn]);

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
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
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

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);

    try {
      const res = await authFetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to change password");
      }

      setPasswordMessage("Password changed successfully.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setPasswordError(error.message || "Unable to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const openProfileModal = () => {
    setAccountMenuOpen(false);
    setProfileModalOpen(true);
    setPasswordMessage("");
    setPasswordError("");
  };

  if (!isHydrated || !session.isLoggedIn || session.accountType === "staff") {
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
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900 lg:static lg:z-auto ${
          sidebarOpen
            ? "translate-x-0 lg:w-72"
            : "-translate-x-full lg:w-0 lg:border-r-0"
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
              Reconciliation and customer operations workspace
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
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-slate-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white lg:hidden"
          >
            {sidebarOpen ? "Close menu" : "Open menu"}
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3 sm:gap-4">
            <div className="hidden text-right text-sm text-gray-500 dark:text-gray-400 xl:block">
              {currentTime ? `${formattedDate} | ${formattedTime}` : ""}
            </div>

            <div className="relative flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
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
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {session.userName || "User"}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {session.userEmail || session.businessName || "Business account"}
                    </p>
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={openProfileModal}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      View profile
                    </button>
                    <button
                      type="button"
                      onClick={openProfileModal}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Change password
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 p-4 dark:bg-gray-950 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {profileModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                  Account profile
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  {session.userName || "User"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-semibold text-white">
                  {(session.userName || "U").charAt(0).toUpperCase()}
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                  <p className="text-xs font-medium uppercase text-slate-400">Full name</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {session.userName || "-"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                  <p className="text-xs font-medium uppercase text-slate-400">Email</p>
                  <p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-white">
                    {session.userEmail || "-"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                  <p className="text-xs font-medium uppercase text-slate-400">Business</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {session.businessName || "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {session.businessType || "Business"}
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Change password
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter your current password before setting a new one.
                  </p>
                </div>

                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((form) => ({
                      ...form,
                      currentPassword: event.target.value,
                    }))
                  }
                  placeholder="Current password"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((form) => ({
                      ...form,
                      newPassword: event.target.value,
                    }))
                  }
                  placeholder="New password"
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((form) => ({
                      ...form,
                      confirmPassword: event.target.value,
                    }))
                  }
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />

                {passwordMessage ? (
                  <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    {passwordMessage}
                  </p>
                ) : null}
                {passwordError ? (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {passwordError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700"
                >
                  {changingPassword ? "Updating..." : "Update password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
