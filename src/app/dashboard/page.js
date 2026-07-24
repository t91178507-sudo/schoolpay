"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiChevronRight, FiMessageCircle } from "react-icons/fi";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PageShell,
  StatCard,
  StatGrid,
  SurfaceCard,
} from "../../components/DashboardUI";
import { authFetch } from "../../lib/authFetch";
import { getCustomerLabels } from "../../lib/businessLabels";
import { useBusinessSession, useHydrated } from "../../lib/clientSession";

async function readJsonSafely(response, fallback) {
  if (!response?.ok) {
    return fallback;
  }

  try {
    const raw = await response.text();
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function getWhatsAppStatusView(status = {}) {
  const normalizedStatus = String(status.status || "loading").toLowerCase();

  if (normalizedStatus === "ready") {
    return {
      label: "Connected",
      detail: status.connectedNumber || "Ready to send",
      dotClassName: "bg-emerald-500",
      iconClassName: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    };
  }

  if (["qr", "pairing_code"].includes(normalizedStatus)) {
    return {
      label: normalizedStatus === "qr" ? "Scan QR code" : "Pairing code ready",
      detail: "Open WhatsApp settings",
      dotClassName: "bg-amber-500",
      iconClassName: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    };
  }

  if (["authenticated", "loading", "retrying", "connecting"].includes(normalizedStatus)) {
    return {
      label: "Connecting",
      detail: "Checking WhatsApp session",
      dotClassName: "bg-amber-500",
      iconClassName: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    };
  }

  if (normalizedStatus === "not_configured") {
    return {
      label: "Not configured",
      detail: "Set up WhatsApp",
      dotClassName: "bg-slate-400",
      iconClassName: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    };
  }

  if (normalizedStatus === "loading") {
    return {
      label: "Checking status",
      detail: "WhatsApp connection",
      dotClassName: "animate-pulse bg-slate-400",
      iconClassName: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    };
  }

  return {
    label: "Disconnected",
    detail: "Open settings to reconnect",
    dotClassName: "bg-red-500",
    iconClassName: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
}

function getCurrentYearMonthlyCollections(invoices = []) {
  const currentYear = new Date().getFullYear();
  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const totals = new Array(12).fill(0);

  invoices.forEach((invoice) => {
    const rawDate = invoice.paidAt || invoice.paymentConfirmedAt || invoice.updatedAt || invoice.date;
    const date = rawDate ? new Date(rawDate) : null;

    if (!date || Number.isNaN(date.getTime()) || date.getFullYear() !== currentYear) {
      return;
    }

    const amount = Number(invoice.paidAmount || invoice.amountPaid || 0);
    totals[date.getMonth()] += amount;
  });

  return monthLabels.map((label, index) => ({
    label,
    value: totals[index],
  }));
}

function getLastFiveYearsCollections(invoices = []) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 4 + index);
  const totals = Object.fromEntries(years.map((year) => [year, 0]));

  invoices.forEach((invoice) => {
    const rawDate = invoice.paidAt || invoice.paymentConfirmedAt || invoice.updatedAt || invoice.date;
    const date = rawDate ? new Date(rawDate) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return;
    }

    const year = date.getFullYear();
    if (!(year in totals)) {
      return;
    }

    const amount = Number(invoice.paidAmount || invoice.amountPaid || 0);
    totals[year] += amount;
  });

  return years.map((year) => ({
    label: String(year),
    value: totals[year],
  }));
}

export default function Dashboard() {
  const session = useBusinessSession();
  const isHydrated = useHydrated();
  const customerLabels = getCustomerLabels(session.businessType);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    expectedRevenue: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    incompleteInvoices: 0,
  });
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [whatsAppStatus, setWhatsAppStatus] = useState({ status: "loading" });

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    if (!session.isLoggedIn) {
      return undefined;
    }

    let cancelled = false;
    let redirectingForAuth = false;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [customersRes, invoicesRes] = await Promise.all([
          authFetch("/api/customers"),
          authFetch("/api/invoices"),
        ]);

        if (customersRes.status === 401 || invoicesRes.status === 401) {
          redirectingForAuth = true;
          return;
        }

        const customers = await readJsonSafely(customersRes, []);
        const invoices = await readJsonSafely(invoicesRes, []);

        const expectedRevenue = invoices.reduce(
          (sum, inv) => sum + Number(inv.amount || 0),
          0
        );

        const totalRevenue = invoices.reduce(
          (sum, inv) => sum + Number(inv.paidAmount || inv.amountPaid || 0),
          0
        );

        const paid = invoices.filter((inv) => inv.status === "Paid").length;
        const incomplete = invoices.filter((inv) => inv.status === "Partially Paid").length;

        if (cancelled) {
          return;
        }

        setStats({
          totalCustomers: customers.length,
          expectedRevenue,
          totalRevenue,
          paidInvoices: paid,
          incompleteInvoices: incomplete,
        });
        setInvoices(Array.isArray(invoices) ? invoices : []);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Failed to load dashboard data");
        }
      } finally {
        if (!cancelled && !redirectingForAuth) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, session.isLoggedIn]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isHydrated || !session.isLoggedIn) {
      return undefined;
    }

    let cancelled = false;

    const loadWhatsAppStatus = async () => {
      try {
        const response = await authFetch("/api/notifications/whatsapp/bridge/status", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setWhatsAppStatus({
            status: response.status === 400 ? "not_configured" : "offline",
            lastError: data.error || "Unable to check WhatsApp status",
          });
          return;
        }

        setWhatsAppStatus(data.status || { status: "offline" });
      } catch {
        if (!cancelled) {
          setWhatsAppStatus({ status: "offline" });
        }
      }
    };

    loadWhatsAppStatus();
    const statusPoll = setInterval(loadWhatsAppStatus, 8000);

    return () => {
      cancelled = true;
      clearInterval(statusPoll);
    };
  }, [isHydrated, session.isLoggedIn]);

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

  const monthlyCollections = useMemo(
    () => getCurrentYearMonthlyCollections(invoices),
    [invoices]
  );
  const yearlyCollections = useMemo(
    () => getLastFiveYearsCollections(invoices),
    [invoices]
  );
  const whatsAppStatusView = getWhatsAppStatusView(whatsAppStatus);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageShell className="flex min-h-full flex-col space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white lg:text-[2rem]">
            Welcome, {session.businessName || "Your Business"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {currentTime ? `${formattedDate} | ${formattedTime}` : ""}
          </p>
        </div>

        <Link
          href="/dashboard/settings#whatsapp"
          className="group flex min-h-16 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:w-[235px] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800"
          aria-label={`WhatsApp status: ${whatsAppStatusView.label}`}
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${whatsAppStatusView.iconClassName}`}>
            <FiMessageCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className={`h-2 w-2 shrink-0 rounded-full ${whatsAppStatusView.dotClassName}`} />
              WhatsApp
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900 dark:text-white">
              {whatsAppStatusView.label}
            </span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
              {whatsAppStatusView.detail}
            </span>
          </span>
          <FiChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
        </Link>
      </div>

      <StatGrid className="gap-3 xl:grid-cols-5">
        <StatCard
          label={`Total ${customerLabels.pluralTitle}`}
          value={stats.totalCustomers}
          tone="blue"
          className="p-3.5"
          labelClassName="text-xs"
          valueClassName="mt-2 text-3xl"
        />
        <StatCard
          label="Open invoice value"
          value={`N${stats.expectedRevenue.toLocaleString()}`}
          tone="violet"
          className="p-3.5"
          labelClassName="text-xs"
          valueClassName="mt-2 text-3xl"
        />
        <StatCard
          label="Collected so far"
          value={`N${stats.totalRevenue.toLocaleString()}`}
          tone="emerald"
          className="p-3.5"
          labelClassName="text-xs"
          valueClassName="mt-2 text-3xl"
        />
        <StatCard
          label="Closed invoices"
          value={stats.paidInvoices}
          tone="emerald"
          className="p-3.5"
          labelClassName="text-xs"
          valueClassName="mt-2 text-3xl"
        />
        <StatCard
          label="Needs follow-up"
          value={stats.incompleteInvoices}
          tone="blue"
          className="p-3.5"
          labelClassName="text-xs"
          valueClassName="mt-2 text-3xl"
        />
      </StatGrid>

      <div className="grid flex-1 gap-3 xl:grid-cols-2">
        <SurfaceCard className="min-w-0 overflow-hidden border border-slate-200/70 bg-white/95 p-0 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Collection flow
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white lg:text-base">
                  Monthly cleared invoices
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  What has already been settled this year.
                </p>
              </div>
              <p className="text-right text-xs font-medium text-slate-500">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
          </div>
          <div className="h-[240px] min-w-[1px] px-2 py-2.5 sm:h-[260px] sm:px-3 xl:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCollections} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="monthlyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="1" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.78" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                <YAxis
                  tickFormatter={(value) => Number(value).toLocaleString()}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                  formatter={(value) => [formatCurrency(value), "Collected"]}
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #dbeafe",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 20px 45px -30px rgba(15, 23, 42, 0.45)",
                  }}
                />
                  <Bar dataKey="value" radius={[12, 12, 4, 4]} maxBarSize={30}>
                  {monthlyCollections.map((entry, index) => (
                    <Cell
                      key={`${entry.label}-${index}`}
                      fill={entry.value > 0 ? "url(#monthlyRevenueFill)" : "#e2e8f0"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard className="min-w-0 overflow-hidden border border-slate-200/70 bg-white/95 p-0 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Revenue trend
            </p>
            <div className="mt-2">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white lg:text-base">
                Five-year collection view
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                A longer view of how cleared collections are moving.
              </p>
            </div>
          </div>
          <div className="h-[240px] min-w-[1px] px-3 py-2.5 sm:h-[260px] sm:px-3 xl:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyCollections} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => Number(value).toLocaleString()}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), "Collected"]}
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #ccfbf1",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 20px 45px -30px rgba(15, 23, 42, 0.45)",
                  }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: "#ffffff", stroke: "#0f766e" }}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#ffffff", stroke: "#0f766e" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
}

