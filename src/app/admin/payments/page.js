"use client";

import { useEffect, useMemo, useState } from "react";
import { FiEye, FiX } from "react-icons/fi";
import {
  EmptyState,
  InputField,
  SelectField,
  StatCard,
  StatGrid,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { adminFetch } from "../../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDateInput(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "partially paid" || value === "partial") return "partial";
  return value || "paid";
}

function formatStatus(status) {
  const value = normalizeStatus(status);
  if (value === "partial") return "Partially Paid";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getStatusTone(status) {
  const value = normalizeStatus(status);
  if (value === "paid") return "green";
  if (value === "partial") return "blue";
  if (value === "pending") return "orange";
  if (value === "failed") return "red";
  return "slate";
}

function normalizeNotification(status) {
  const value = String(status || "").toLowerCase();
  if (["sent", "prepared", "delivered", "success"].includes(value)) return "sent";
  if (["failed", "error", "unavailable"].includes(value)) return "failed";
  return "pending";
}

function getNotificationTone(status) {
  const value = normalizeNotification(status);
  return value === "sent" ? "green" : value === "failed" ? "red" : "orange";
}

function buildTransactionId(payment, index) {
  const date = formatDateInput(payment.happenedAt).replaceAll("-", "") || "00000000";
  const reference = String(payment.paymentReference || payment.invoiceNumber || payment._id || "AUTO")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase();
  return `TXN-${date}-${String(index + 1).padStart(2, "0")}${reference || "AUTO"}`;
}

export default function AdminPayments() {
  const [data, setData] = useState({ payments: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/payments");
        setData(res.ok ? await res.json() : { payments: [] });
      } catch (error) {
        console.error(error);
        setData({ payments: [] });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const rows = useMemo(
    () =>
      (data.payments || []).map((payment, index) => ({
        ...payment,
        id: String(payment._id),
        transactionId: buildTransactionId(payment, index),
        business: payment.ownerBusinessName || "Business not set",
        businessEmail: payment.ownerEmail || "",
        customer: payment.customerDisplayName || "Customer",
        description: payment.description || "Invoice payment",
        provider: payment.paymentProvider || "Manual",
        amount: Number(payment.paidAmount || 0),
        status: payment.status || "Paid",
        notificationStatus: payment.customerNotificationStatus || "pending",
        reference: payment.paymentReference || "-",
        invoiceNumber: payment.invoiceNumber || "-",
        phone: payment.phone || "",
        balanceDue: Number(payment.balanceDue || 0),
        happenedAt: payment.happenedAt,
      })),
    [data.payments]
  );

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        [
          row.transactionId,
          row.business,
          row.businessEmail,
          row.customer,
          row.phone,
          row.description,
          row.reference,
          row.invoiceNumber,
          row.provider,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      const matchesStatus = statusFilter === "all" || normalizeStatus(row.status) === statusFilter;
      const matchesNotification =
        notificationFilter === "all" ||
        normalizeNotification(row.notificationStatus) === notificationFilter;
      const happenedAt = row.happenedAt ? new Date(row.happenedAt) : null;
      const matchesStart = !startDate || (happenedAt && happenedAt >= new Date(`${startDate}T00:00:00`));
      const matchesEnd = !endDate || (happenedAt && happenedAt <= new Date(`${endDate}T23:59:59.999`));

      return matchesSearch && matchesStatus && matchesNotification && matchesStart && matchesEnd;
    });
  }, [endDate, notificationFilter, rows, searchTerm, startDate, statusFilter]);

  const totalCollected = filteredRows.reduce((total, row) => total + row.amount, 0);
  const businesses = new Set(filteredRows.map((row) => row.business).filter(Boolean)).size;
  const sentNotifications = filteredRows.filter(
    (row) => normalizeNotification(row.notificationStatus) === "sent"
  ).length;
  const pendingNotifications = filteredRows.filter(
    (row) => normalizeNotification(row.notificationStatus) === "pending"
  ).length;
  const latestPaymentDate = filteredRows[0]?.happenedAt
    ? formatDateInput(filteredRows[0].happenedAt)
    : "";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setNotificationFilter("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Platform ledger</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Payment transactions</h1>
        <p className="mt-1 text-sm text-slate-500">Review collection activity, payment providers, and customer delivery across all businesses.</p>
      </div>

      <StatGrid>
        <StatCard label="Collected" value={formatMoney(totalCollected)} tone="emerald" />
        <StatCard label="Transactions" value={filteredRows.length} tone="slate" />
        <StatCard label="Businesses" value={businesses} tone="blue" />
        <StatCard label="WhatsApp sent" value={sentNotifications} tone="emerald" />
      </StatGrid>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Collection filters</h2>
              <p className="mt-1 text-sm text-slate-500">Find a transaction by business, customer, reference, invoice, provider, or date.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{latestPaymentDate ? `Latest: ${latestPaymentDate}` : "No activity date"}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Pending messages: {pendingNotifications}</span>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <InputField className="xl:col-span-2" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search business, customer, reference or invoice..." />
            <InputField type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Start date" />
            <InputField type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="End date" />
            <SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All payment statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partially paid</option>
            </SelectField>
            <SelectField value={notificationFilter} onChange={(event) => setNotificationFilter(event.target.value)}>
              <option value="all">All message statuses</option>
              <option value="sent">Message sent</option>
              <option value="pending">Message pending</option>
              <option value="failed">Message failed</option>
            </SelectField>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={clearFilters} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Clear filters</button>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 xl:flex-row xl:items-center xl:justify-between sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Collection ledger</p>
            <h2 className="mt-1.5 text-xl font-semibold text-slate-950">Payment transactions</h2>
            <p className="mt-1 text-sm text-slate-500">A complete record of cleared and partially settled customer payments.</p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <div className="px-4 py-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Collected</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(totalCollected)}</dd></div>
            <div className="px-4 py-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sent</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{sentNotifications}</dd></div>
            <div className="px-4 py-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pending</dt><dd className="mt-1 text-lg font-semibold text-slate-950">{pendingNotifications}</dd></div>
          </dl>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading collection records...</div>
        ) : filteredRows.length === 0 ? (
          <EmptyState title="No collection records match these filters" description="Clear one or more filters to widen the payment history." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] table-fixed border-separate border-spacing-0 text-sm xl:min-w-full">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500"><tr>
                  <th className="w-[15%] px-5 py-3.5">Transaction</th><th className="w-[16%] px-5 py-3.5">Business</th><th className="w-[14%] px-5 py-3.5">Customer</th><th className="w-[19%] px-5 py-3.5">Payment details</th><th className="w-[13%] px-5 py-3.5">Source</th><th className="w-[9%] px-5 py-3.5 text-right">Amount</th><th className="w-[9%] px-5 py-3.5">Received</th><th className="w-[5%] px-5 py-3.5 text-center">Details</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4 align-middle"><p className="truncate font-mono text-xs font-semibold text-slate-900" title={row.transactionId}>{row.transactionId}</p><div className="mt-2"><StatusBadge tone={getStatusTone(row.status)}>{formatStatus(row.status)}</StatusBadge></div></td>
                      <td className="px-5 py-4 align-middle"><p className="truncate font-semibold text-slate-900" title={row.business}>{row.business}</p><p className="mt-1 truncate text-xs text-slate-500">{row.businessEmail || "No business email"}</p></td>
                      <td className="px-5 py-4 align-middle"><p className="truncate font-semibold text-slate-900" title={row.customer}>{row.customer}</p><p className="mt-1 truncate text-xs text-slate-500">{row.phone || "No phone number"}</p></td>
                      <td className="px-5 py-4 align-middle"><p className="truncate font-medium text-slate-800" title={row.description}>{row.description}</p><p className="mt-1 truncate text-xs text-slate-500">Invoice {row.invoiceNumber}</p></td>
                      <td className="px-5 py-4 align-middle"><p className="truncate font-semibold text-slate-900">{row.provider}</p><div className="mt-2"><StatusBadge tone={getNotificationTone(row.notificationStatus)}>Message {normalizeNotification(row.notificationStatus)}</StatusBadge></div></td>
                      <td className="px-5 py-4 text-right align-middle"><p className="whitespace-nowrap text-base font-semibold text-slate-950">{formatMoney(row.amount)}</p></td>
                      <td className="px-5 py-4 align-middle"><p className="whitespace-nowrap font-medium text-slate-800">{row.happenedAt ? new Date(row.happenedAt).toLocaleDateString() : "-"}</p><p className="mt-1 whitespace-nowrap text-xs text-slate-500">{row.happenedAt ? new Date(row.happenedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</p></td>
                      <td className="px-5 py-4 text-center align-middle"><button type="button" onClick={() => setSelectedPayment(row)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950" aria-label={`View transaction ${row.transactionId}`} title="View transaction"><FiEye aria-hidden="true" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5 text-sm text-slate-500 sm:px-6">Showing <span className="font-semibold text-slate-900">{filteredRows.length}</span> transaction{filteredRows.length === 1 ? "" : "s"}</div>
          </>
        )}
      </SurfaceCard>

      {selectedPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Payment details">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transaction record</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">Payment details</h2><p className="mt-1 text-sm text-slate-500">{formatDateTime(selectedPayment.happenedAt)}</p></div><button type="button" onClick={() => setSelectedPayment(null)} aria-label="Close payment details" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100"><FiX className="text-lg" /></button></div>
            <div className="grid border-b border-slate-200 bg-slate-50 sm:grid-cols-3"><div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r sm:px-6"><p className="text-xs font-medium uppercase text-slate-500">Amount paid</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{formatMoney(selectedPayment.amount)}</p></div><div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r sm:px-6"><p className="text-xs font-medium uppercase text-slate-500">Payment status</p><div className="mt-2"><StatusBadge tone={getStatusTone(selectedPayment.status)}>{formatStatus(selectedPayment.status)}</StatusBadge></div></div><div className="px-5 py-4 sm:px-6"><p className="text-xs font-medium uppercase text-slate-500">Balance due</p><p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{formatMoney(selectedPayment.balanceDue)}</p></div></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6 sm:py-3"><div className="grid gap-x-10 sm:grid-cols-2"><section><h3 className="py-3 text-sm font-semibold text-slate-950">Transaction</h3><dl className="divide-y divide-slate-200 border-y border-slate-200">{[["Transaction ID", selectedPayment.transactionId], ["Reference", selectedPayment.reference], ["Invoice number", selectedPayment.invoiceNumber], ["Provider", selectedPayment.provider]].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right font-medium text-slate-900">{value}</dd></div>)}</dl></section><section><h3 className="py-3 text-sm font-semibold text-slate-950">Business and customer</h3><dl className="divide-y divide-slate-200 border-y border-slate-200">{[["Business", selectedPayment.business], ["Customer", selectedPayment.customer], ["Phone", selectedPayment.phone || "-"], ["Notification", normalizeNotification(selectedPayment.notificationStatus)]].map(([label, value]) => <div key={label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="break-words text-right font-medium capitalize text-slate-900">{value}</dd></div>)}</dl></section></div></div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-3 sm:px-6"><button type="button" onClick={() => setSelectedPayment(null)} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">Close</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
