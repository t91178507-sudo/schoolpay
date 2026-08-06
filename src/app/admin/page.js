"use client";

import { useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiBriefcase,
  FiCreditCard,
  FiMessageCircle,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { adminFetch } from "../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function MetricCard({ label, value, hint, icon: Icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 truncate text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        {Icon ? (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.slate}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SectionPanel({ title, description, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        setStats(data);
      } catch {
        setError("Failed to load platform stats");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }

  const bridgeHealth = stats.whatsappBridgeHealth || {};
  const bridgeOnline = bridgeHealth.online === true;
  const billingEnabled = stats.units?.settings?.enabled !== false;
  const lowUnits = Number(stats.units?.businessesWithLowUnits || 0);
  const zeroUnits = Number(stats.units?.businessesWithZeroUnits || 0);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
              InvoiceHub Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Platform overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Monitor business activity, collections, WhatsApp delivery, and unit billing from one workspace.
            </p>
          </div>

          <div className={`rounded-2xl border px-4 py-3 ${
            bridgeOnline
              ? "border-emerald-400/30 bg-emerald-400/10"
              : "border-red-400/30 bg-red-400/10"
          }`}>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${bridgeOnline ? "bg-emerald-400" : "bg-red-400"}`} />
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">WhatsApp bridge</p>
                <p className="mt-0.5 font-semibold">{bridgeOnline ? "Online" : "Offline"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(lowUnits || zeroUnits) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-800">
          <FiAlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            {lowUnits} business{lowUnits === 1 ? "" : "es"} with low units and {zeroUnits} at zero units.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionPanel title="Platform Activity" description="Businesses, customers, invoices, and notification readiness.">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label="Businesses" value={formatNumber(stats.totalBusinesses)} hint={`${formatNumber(stats.monnifyConfiguredBusinesses)} with Monnify configured`} icon={FiBriefcase} tone="blue" />
            <MetricCard label="Customers" value={formatNumber(stats.totalCustomers)} hint="Across all businesses" icon={FiUsers} tone="violet" />
            <MetricCard label="Invoices" value={formatNumber(stats.totalInvoices)} hint={`${formatNumber(stats.paidCount)} paid, ${formatNumber(stats.partialCount)} partial, ${formatNumber(stats.unpaidCount)} unpaid`} icon={FiActivity} tone="slate" />
            <MetricCard label="Prepared receipts" value={formatNumber(stats.preparedNotificationCount)} hint={`${formatNumber(stats.unavailableNotificationCount)} unavailable`} icon={FiCreditCard} tone="emerald" />
          </div>
        </SectionPanel>

        <SectionPanel title="Messaging Health" description="Bridge status and WhatsApp provider usage.">
          <div className={`rounded-2xl border p-5 ${
            bridgeOnline ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={bridgeOnline ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-700"}>
                  WhatsApp bridge
                </p>
                <p className={`mt-3 text-3xl font-semibold ${bridgeOnline ? "text-emerald-700" : "text-red-700"}`}>
                  {bridgeOnline ? "Online" : "Offline"}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                bridgeOnline ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {bridgeHealth.configured === false ? "Not set" : bridgeOnline ? "Live" : "Check"}
              </span>
            </div>
            <p className={bridgeOnline ? "mt-3 break-all text-xs text-emerald-700/80" : "mt-3 break-all text-xs text-red-700/80"}>
              {bridgeHealth.url || "No bridge URL configured"}
            </p>
            {!bridgeOnline && bridgeHealth.error ? (
              <p className="mt-2 text-xs text-red-600">{bridgeHealth.error}</p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <MetricCard label="WhatsApp Web businesses" value={formatNumber(stats.whatsappWebBusinesses)} hint="Using bridge provider" icon={FiMessageCircle} tone="emerald" />
            <MetricCard label="Billing status" value={billingEnabled ? "Enabled" : "Disabled"} hint="Unit billing for WhatsApp sends" icon={FiTrendingUp} tone={billingEnabled ? "blue" : "slate"} />
          </div>
        </SectionPanel>
      </div>

      <SectionPanel title="Collections" description="Issued value, confirmed collections, and outstanding balances.">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Invoice value" value={formatMoney(stats.totalRevenue)} hint="Total issued value" icon={FiTrendingUp} tone="blue" />
          <MetricCard label="Collected" value={formatMoney(stats.collectedRevenue ?? stats.paidRevenue)} hint={`${formatMoney(stats.partialRevenue)} from partial payments`} icon={FiCreditCard} tone="emerald" />
          <MetricCard label="Outstanding" value={formatMoney(stats.outstandingRevenue)} hint="Remaining balance due" icon={FiAlertTriangle} tone="orange" />
        </div>
      </SectionPanel>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionPanel title="Unit Billing" description="Wallet credits and WhatsApp consumption.">
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <MetricCard label="Units sold" value={formatNumber(stats.units?.totalUnitsSold)} hint="Total credited units" icon={FiTrendingUp} tone="blue" />
            <MetricCard label="Units consumed" value={formatNumber(stats.units?.totalUnitsConsumed)} hint="WhatsApp delivery usage" icon={FiMessageCircle} tone="orange" />
            <MetricCard label="Low units" value={formatNumber(lowUnits)} hint={`${formatNumber(zeroUnits)} businesses at zero`} icon={FiAlertTriangle} tone={lowUnits || zeroUnits ? "red" : "emerald"} />
          </div>
        </SectionPanel>

        <SectionPanel title="Top Unit Consumers" description="Businesses with the highest WhatsApp unit usage.">
          <div className="divide-y divide-slate-100">
            {(stats.units?.topBusinessesByUnitConsumption || []).map((business, index) => (
              <div key={business.ownerId} className="flex items-center justify-between gap-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <p className="truncate font-medium text-slate-900">
                    {business.businessName || business.ownerId}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-orange-600">
                  {formatNumber(business.units)} units
                </p>
              </div>
            ))}
            {!(stats.units?.topBusinessesByUnitConsumption || []).length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No unit consumption yet</p>
                <p className="mt-1 text-xs text-slate-500">WhatsApp usage will appear here after successful sends.</p>
              </div>
            ) : null}
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}
