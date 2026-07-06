"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";

export default function CommunicationPage() {
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [sendingBulk, setSendingBulk] = useState(false);
  const [message, setMessage] = useState("");
  const [messageContext, setMessageContext] = useState("");
  const [error, setError] = useState("");
  const [bridgeToolsOpen, setBridgeToolsOpen] = useState(false);

  const connected = bridgeStatus?.bridgeReachable === true && bridgeStatus?.status?.status === "ready";
  const qrDataUrl = bridgeStatus?.status?.qrDataUrl || "";
  const connectedNumber = bridgeStatus?.status?.connectedNumber || "";
  const currentStatus = bridgeStatus?.status?.status || "unknown";
  const groupedCategories = customers.reduce((acc, customer) => {
    const category = customer.category || "Uncategorized";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const categories = Object.keys(groupedCategories).sort((a, b) => a.localeCompare(b));
  const selectedCategoryCount = bulkCategory ? groupedCategories[bulkCategory] || 0 : 0;

  const loadBridgeStatus = async () => {
    setError("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bridge/status");
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to load WhatsApp status");
      }

      setBridgeStatus(data);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (statusError) {
      setBridgeStatus({
        bridgeReachable: false,
        status: {
          status: "offline",
          connectedNumber: "",
          lastError: statusError.message || "Unable to load WhatsApp status",
        },
      });
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await authFetch("/api/customers");
      const data = res.ok ? await res.json() : [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadBridgeStatus();
      loadCustomers();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const sendTestMessage = async (event) => {
    event.preventDefault();
    setTesting(true);
    setMessage("");
    setMessageContext("test");
    setError("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to send test message");
      }

      setMessage("Test WhatsApp message sent.");
      setTestPhone("");
      loadBridgeStatus();
    } catch (testError) {
      setError(testError.message || "Unable to send test message");
    } finally {
      setTesting(false);
    }
  };

  const sendBulkMessage = async (event) => {
    event.preventDefault();
    setSendingBulk(true);
    setMessage("");
    setMessageContext("bulk");
    setError("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: bulkCategory,
          message: bulkMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to send bulk message");
      }

      setMessage("Message sent.");
      loadBridgeStatus();
    } catch (bulkError) {
      setError(bulkError.message || "Unable to send bulk message");
    } finally {
      setSendingBulk(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Communication"
        description="Monitor WhatsApp delivery, reconnect the bridge, and send a test message."
        actions={
          <button
            type="button"
            onClick={loadBridgeStatus}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Refresh status
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <SurfaceCard className="overflow-hidden p-0">
          <div className="relative min-h-40 p-6">
            <div
              className={`absolute right-0 top-0 h-28 w-28 rounded-bl-full ${
                connected ? "bg-emerald-500/10" : "bg-orange-500/10"
              }`}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  WhatsApp status
                </p>
                <p
                  className={`mt-4 text-4xl font-semibold ${
                    connected ? "text-emerald-600" : "text-orange-600"
                  }`}
                >
                  {connected ? "Connected" : "Disconnected"}
                </p>
              </div>
              <span
                className={`mt-1 flex h-3 w-3 rounded-full ${
                  connected ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" : "bg-orange-500 shadow-[0_0_0_6px_rgba(249,115,22,0.12)]"
                }`}
              />
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden p-0">
          <div className="min-h-40 p-6">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Connected number
            </p>
            <p className="mt-4 break-all font-mono text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {connectedNumber || "-"}
            </p>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Number currently authorized for outgoing messages.
            </p>
          </div>
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden p-0">
          <div className="min-h-40 p-6">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Recent activity
            </p>
            <p className="mt-4 text-4xl font-semibold text-blue-600">{logs.length}</p>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Bridge events from the latest message activity.
            </p>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setBridgeToolsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
          aria-expanded={bridgeToolsOpen}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              WA
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                WhatsApp bridge tools
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Status: {currentStatus} · {connected ? "Ready to send" : "Reconnect required"}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-3">
            <StatusBadge tone={connected ? "green" : "orange"}>
              {connected ? "Connected" : "Disconnected"}
            </StatusBadge>
            <span
              className={`text-xl text-slate-400 transition ${
                bridgeToolsOpen ? "rotate-180" : ""
              }`}
            >
              ˅
            </span>
          </span>
        </button>

        {bridgeToolsOpen ? (
          <div className="border-t border-slate-200 p-6 dark:border-slate-800">
            <div className="grid gap-4 xl:grid-cols-[1.5fr_0.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        WA
                      </span>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                          WhatsApp bridge
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={connected ? "green" : "orange"}>
                            {connected ? "Connected" : "Disconnected"}
                          </StatusBadge>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            Status: {currentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
                        <p className="text-xs font-medium uppercase text-slate-400">
                          Delivery mode
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Browser bridge
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
                        <p className="text-xs font-medium uppercase text-slate-400">
                          Message readiness
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {connected ? "Ready to send" : "Reconnect required"}
                        </p>
                      </div>
                    </div>

                    {bridgeStatus?.status?.lastError ? (
                      <p className="mt-4 break-all rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        {bridgeStatus.status.lastError}
                      </p>
                    ) : null}
                  </div>

                  <Link
                    href="/dashboard/settings"
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Open settings
                  </Link>
                </div>

                {!connected && qrDataUrl ? (
                  <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
                    <div className="inline-flex overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                      <Image
                        src={qrDataUrl}
                        alt="WhatsApp QR code"
                        width={160}
                        height={160}
                        unoptimized
                        className="h-40 w-40"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      Send test message
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Confirm the bridge can deliver before bulk messaging.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Test
                  </span>
                </div>

                <form onSubmit={sendTestMessage} className="mt-5 space-y-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Recipient phone number
                  </label>
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(event) => setTestPhone(event.target.value)}
                    placeholder="2348012345678"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={testing || !connected}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  >
                    {testing ? "Sending..." : "Send test"}
                  </button>
                </form>
                {message && messageContext === "test" ? (
                  <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p>
                ) : null}
                {error && messageContext === "test" ? (
                  <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Bulk category message
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a category and send one WhatsApp message to every saved phone number in that group.
          </p>
        </div>

        <form onSubmit={sendBulkMessage} className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr_auto] lg:items-start">
          <div>
            <label htmlFor="bulk-category" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Category
            </label>
            <select
              id="bulk-category"
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category} ({groupedCategories[category]})
                </option>
              ))}
            </select>
            {bulkCategory ? (
              <p className="mt-2 text-xs text-slate-500">
                {selectedCategoryCount} recipient{selectedCategoryCount === 1 ? "" : "s"} in this category.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="bulk-message" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Message
            </label>
            <textarea
              id="bulk-message"
              value={bulkMessage}
              onChange={(event) => setBulkMessage(event.target.value)}
              required
              rows={4}
              placeholder="Type the message to send..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={sendingBulk || !connected}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 lg:mt-7"
          >
            {sendingBulk ? "Sending..." : "Send bulk"}
          </button>
        </form>

        {message && messageContext === "bulk" ? (
          <p className="mt-4 text-sm font-medium text-emerald-700">{message}</p>
        ) : null}
        {error && messageContext === "bulk" ? (
          <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState
            title="No recent communication activity"
            description="Sent WhatsApp messages will appear here when the bridge records activity."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log, index) => (
              <div key={`${log.createdAt || index}-${log.to || ""}`} className="p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {log.to || "Unknown recipient"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{log.preview || "-"}</p>
                  </div>
                  <StatusBadge tone={log.status === "sent" ? "green" : "orange"}>
                    {log.status || "pending"}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </PageShell>
  );
}
