"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InputField,
  PageHeader,
  PageShell,
  SelectField,
  StatCard,
  StatGrid,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";
import { getCustomerLabels } from "../../../lib/businessLabels";
import { useBusinessSession } from "../../../lib/clientSession";

function getSourceLabel(entry) {
  if (entry.type === "quick-pay-session") return "QR Session";
  return entry.source === "qr" ? "QR Invoice" : "Invoice";
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "green";
  if (normalized === "pending") return "orange";
  if (normalized === "failed") return "red";
  return "slate";
}

function getNotificationTone(status) {
  const normalized = normalizeNotificationStatus(status);
  if (normalized === "sent") return "green";
  if (normalized === "pending") return "orange";
  if (normalized === "failed") return "red";
  return "slate";
}

function normalizeNotificationStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (["sent", "prepared", "delivered", "success"].includes(normalized)) {
    return "sent";
  }

  if (["failed", "error", "unavailable"].includes(normalized)) {
    return "failed";
  }

  return "pending";
}

function formatNotificationStatus(status) {
  const normalized = normalizeNotificationStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export default function Payments() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const invoiceRes = await authFetch("/api/invoices");

        const invoiceData = invoiceRes.ok ? await invoiceRes.json() : [];

        setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      } catch (error) {
        console.error("Failed to load payments", error);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    const initialLoad = setTimeout(loadPayments, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const historyRows = useMemo(() => {
    const invoiceRows = invoices
      .filter((invoice) => String(invoice.status || "").toLowerCase() === "paid")
      .map((invoice) => {
      const source = invoice.quickPayProfileId ? "qr" : "invoice";
      const customerName =
        invoice.customer || invoice.customerName || invoice.student || customerLabels.singularTitle;

      return {
        id: `invoice-${invoice._id}`,
        type: "invoice",
        source,
        customerName,
        description:
          invoice.description || invoice.category || invoice.class || "Invoice payment",
        amount: Number(invoice.paidAmount || invoice.amount || 0),
        status: "Paid",
        notificationStatus: normalizeNotificationStatus(invoice.customerNotificationStatus),
        provider:
          invoice.paymentProvider ||
          invoice.pendingPaymentProvider ||
          (source === "qr" ? "Monnify" : "Manual"),
        reference:
          invoice.paymentReference || invoice.pendingPaymentReference || invoice.invoiceNumber || "-",
        phone: invoice.phone || "",
        invoiceNumber: invoice.invoiceNumber || "-",
        token: invoice.token || "",
        happenedAt:
          invoice.paidAt ||
          invoice.paymentConfirmedAt ||
          invoice.pendingPaymentCreatedAt ||
          invoice.date ||
          invoice.createdAt,
      };
    });

    return [...invoiceRows].sort(
      (a, b) => new Date(b.happenedAt || 0) - new Date(a.happenedAt || 0)
    );
  }, [customerLabels.singularTitle, invoices]);

  const filteredRows = historyRows.filter((row) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [
        row.customerName,
        row.description,
        row.reference,
        row.invoiceNumber,
        row.phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesSource = sourceFilter === "all" || row.source === sourceFilter;
    const matchesStatus =
      statusFilter === "all" || String(row.status || "").toLowerCase() === statusFilter;
    const matchesNotification =
      notificationFilter === "all" ||
      String(row.notificationStatus || "").toLowerCase() === notificationFilter;
    const rowDate = row.happenedAt ? new Date(row.happenedAt) : null;
    const matchesStart =
      !startDate ||
      (rowDate && rowDate >= new Date(`${startDate}T00:00:00`));
    const matchesEnd =
      !endDate ||
      (rowDate && rowDate <= new Date(`${endDate}T23:59:59.999`));

    return (
      matchesSearch &&
      matchesSource &&
      matchesStatus &&
      matchesNotification &&
      matchesStart &&
      matchesEnd
    );
  });

  const totalCollected = filteredRows
    .filter((row) => String(row.status || "").toLowerCase() === "paid")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingCount = filteredRows.filter(
    (row) => String(row.status || "").toLowerCase() === "pending"
  ).length;
  const sentNotifications = filteredRows.filter(
    (row) => normalizeNotificationStatus(row.notificationStatus) === "sent"
  ).length;
  const latestPaymentDate = filteredRows[0]?.happenedAt
    ? formatDateInput(filteredRows[0].happenedAt)
    : "";

  const exportPayments = () => {
    const headers = [
      customerLabels.singularTitle,
      "Phone",
      "Description",
      "Amount",
      "Status",
      "Provider",
      "Notification",
      "Reference",
      "Invoice Number",
      "Source",
      "Date",
    ];
    const rows = filteredRows.map((row) => [
      row.customerName,
      row.phone,
      row.description,
      row.amount,
      row.status,
      row.provider,
      formatNotificationStatus(row.notificationStatus),
      row.reference,
      row.invoiceNumber,
      getSourceLabel(row),
      formatDateTime(row.happenedAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const rangeLabel = [startDate || "start", endDate || "end"].join("-to-");
    link.href = url;
    link.download = `payment-history-${rangeLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      <PageHeader
        title="Payment history"
        description="Track invoice payments, QR sessions, confirmation status, and notification readiness from one view."
        actions={
          <button
            type="button"
            onClick={exportPayments}
            disabled={filteredRows.length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700"
          >
            Export CSV
          </button>
        }
      />

      <StatGrid>
        <StatCard
          label="Collected"
          value={`N${totalCollected.toLocaleString()}`}
          tone="emerald"
        />
        <StatCard label="History rows" value={filteredRows.length} tone="slate" />
        <StatCard label="Pending items" value={pendingCount} tone="orange" />
        <StatCard
          label="WhatsApp sent"
          value={sentNotifications}
          tone="blue"
        />
      </StatGrid>

      <SurfaceCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Filter payments
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Narrow history by customer, status, notification, source, and date range.
            </p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {latestPaymentDate ? `Latest payment: ${latestPaymentDate}` : "No payment date yet"}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <InputField
            type="text"
            placeholder={`Search ${customerLabels.singular}, phone, reference...`}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="xl:col-span-2"
          />
          <InputField
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-label="Start date"
          />
          <InputField
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-label="End date"
          />
          <SelectField
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="all">All sources</option>
            <option value="invoice">Invoice</option>
            <option value="qr">QR</option>
          </SelectField>
          <SelectField
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="unpaid">Unpaid</option>
            <option value="failed">Failed</option>
          </SelectField>
          <SelectField
            value={notificationFilter}
            onChange={(event) => setNotificationFilter(event.target.value)}
            className="md:col-span-2 xl:col-span-2"
          >
            <option value="all">All notifications</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </SelectField>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setSourceFilter("all");
              setStatusFilter("all");
              setNotificationFilter("all");
              setStartDate("");
              setEndDate("");
            }}
            className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear filters
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Payment records
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {filteredRows.length} filtered record{filteredRows.length === 1 ? "" : "s"}.
            </p>
          </div>
          <button
            type="button"
            onClick={exportPayments}
            disabled={filteredRows.length === 0}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Export
          </button>
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Loading payment history...</div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No payment history matches these filters"
            description="Try clearing one or two filters to widen the view."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 lg:hidden">
              {filteredRows.map((row) => (
                <div key={row.id} className="space-y-4 p-4 sm:p-5">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{row.customerName}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="slate">{getSourceLabel(row)}</StatusBadge>
                      {row.phone ? <span className="text-xs text-slate-500 dark:text-slate-400">{row.phone}</span> : null}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Description
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-300">{row.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Invoice: {row.invoiceNumber || "-"}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        N{Number(row.amount || 0).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={getStatusTone(row.status)}>
                          {row.status || "Unknown"}
                        </StatusBadge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{row.provider || "-"}</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(row.happenedAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={getNotificationTone(row.notificationStatus)}>
                      {formatNotificationStatus(row.notificationStatus)}
                    </StatusBadge>
                    <p className="break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                      {row.reference || "-"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    {customerLabels.singularTitle}
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Description
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Payment
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    WhatsApp Notification
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{row.customerName}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone="slate">{getSourceLabel(row)}</StatusBadge>
                          {row.phone ? <span className="text-xs text-slate-500 dark:text-slate-400">{row.phone}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-800 dark:text-slate-300">{row.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Invoice: {row.invoiceNumber || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          N{Number(row.amount || 0).toLocaleString()}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={getStatusTone(row.status)}>
                            {row.status || "Unknown"}
                          </StatusBadge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{row.provider || "-"}</span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(row.happenedAt)}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusBadge tone={getNotificationTone(row.notificationStatus)}>
                        {formatNotificationStatus(row.notificationStatus)}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="max-w-[14rem] break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                        {row.reference || "-"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </SurfaceCard>
    </PageShell>
  );
}

