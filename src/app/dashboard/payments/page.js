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
  if (normalized === "partially paid" || normalized === "partial") return "blue";
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

function getNotificationTone(status) {
  const normalized = normalizeNotificationStatus(status);

  if (normalized === "sent") return "green";
  if (normalized === "pending") return "orange";
  if (normalized === "failed") return "red";

  return "slate";
}

function formatNotificationStatus(status) {
  const normalized = normalizeNotificationStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function buildGeneratedTransactionId(seed = "", happenedAt = "", index = 0) {
  const normalizedDate = happenedAt
    ? formatDateInput(happenedAt).replaceAll("-", "")
    : "00000000";
  const normalizedSeed = String(seed || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  return `TXN-${normalizedDate}-${String(index + 1).padStart(2, "0")}${
    normalizedSeed || "AUTO"
  }`;
}

function buildCompactDetails(row) {
  const segments = [row.description];

  if (row.invoiceNumber && row.invoiceNumber !== "-") {
    segments.push(`Invoice ${row.invoiceNumber}`);
  }

  if (Number(row.balanceDue || 0) > 0) {
    segments.push(`Balance ${formatCurrency(row.balanceDue)}`);
  }

  return segments.filter(Boolean).join(" • ");
}

function buildCompactCustomer(row) {
  return [row.customerName, row.phone].filter(Boolean).join(" • ");
}

function buildCompactProvider(row) {
  return [row.provider || "-", formatNotificationStatus(row.notificationStatus)]
    .filter(Boolean)
    .join(" • ");
}

function buildInlineDetails(row) {
  const segments = [row.description];

  if (row.invoiceNumber && row.invoiceNumber !== "-") {
    segments.push(`Invoice ${row.invoiceNumber}`);
  }

  if (Number(row.balanceDue || 0) > 0) {
    segments.push(`Balance ${formatCurrency(row.balanceDue)}`);
  }

  return segments.filter(Boolean).join(" | ");
}

function buildInlineCustomer(row) {
  return [row.customerName, row.phone].filter(Boolean).join(" | ");
}

function buildInlineProvider(row) {
  return [row.provider || "-", formatNotificationStatus(row.notificationStatus)]
    .filter(Boolean)
    .join(" | ");
}

function normalizePaymentStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "paid") return "paid";
  if (normalized === "partially paid" || normalized === "partial") return "partial";

  return normalized;
}

function formatPaymentStatus(status) {
  const normalized = normalizePaymentStatus(status);

  if (normalized === "partial") return "Partially Paid";
  if (normalized === "paid") return "Paid";
  if (normalized === "pending") return "Pending";
  if (normalized === "failed") return "Failed";

  return String(status || "Unknown");
}

function escapeCsvValue(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function getTransactionAmount(transaction) {
  return Number(
    transaction.amount ||
      transaction.paidAmount ||
      transaction.amountPaid ||
      transaction.totalPaid ||
      transaction.value ||
      0
  );
}

function getTransactionReference(transaction, invoice) {
  return (
    transaction.reference ||
    transaction.paymentReference ||
    transaction.transactionReference ||
    transaction.transactionId ||
    transaction.gatewayReference ||
    transaction.providerReference ||
    invoice.paymentReference ||
    invoice.pendingPaymentReference ||
    invoice.invoiceNumber ||
    "-"
  );
}

function getTransactionProvider(transaction, invoice, source) {
  return (
    transaction.provider ||
    transaction.paymentProvider ||
    transaction.gateway ||
    transaction.channel ||
    invoice.paymentProvider ||
    invoice.pendingPaymentProvider ||
    (source === "qr" ? "Monnify" : "Manual")
  );
}

function getTransactionDate(transaction, invoice) {
  return (
    transaction.paidAt ||
    transaction.paymentConfirmedAt ||
    transaction.confirmedAt ||
    transaction.completedAt ||
    transaction.createdAt ||
    transaction.date ||
    invoice.paidAt ||
    invoice.paymentConfirmedAt ||
    invoice.pendingPaymentCreatedAt ||
    invoice.date ||
    invoice.createdAt
  );
}

function getTransactionStatus(transaction, invoice) {
  return (
    transaction.status ||
    transaction.paymentStatus ||
    invoice.status ||
    "Paid"
  );
}

function getInvoiceTransactionList(invoice) {
  return [
    ...(Array.isArray(invoice.paymentTransactions)
      ? invoice.paymentTransactions
      : []),
    ...(Array.isArray(invoice.transactions) ? invoice.transactions : []),
    ...(Array.isArray(invoice.payments) ? invoice.payments : []),
    ...(Array.isArray(invoice.paymentHistory) ? invoice.paymentHistory : []),
  ];
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
    const invoiceRows = invoices.flatMap((invoice) => {
      const invoiceStatus = String(invoice.status || "").toLowerCase();

      const isPaidInvoice = ["paid", "partially paid", "partial"].includes(
        invoiceStatus
      );

      if (!isPaidInvoice) {
        return [];
      }

      const source = invoice.quickPayProfileId ? "qr" : "invoice";

      const customerName =
        invoice.customer ||
        invoice.customerName ||
        invoice.student ||
        customerLabels.singularTitle;

      const baseRow = {
        invoiceId: invoice._id,
        type: "payment-transaction",
        source,
        sourceLabel: getSourceLabel({ type: "invoice", source }),
        customerName,
        description:
          invoice.description ||
          invoice.category ||
          invoice.class ||
          "Invoice payment",
        phone: invoice.phone || "",
        invoiceNumber: invoice.invoiceNumber || "-",
        token: invoice.token || "",
        balanceDue: Number(invoice.balanceDue || 0),
      };

      const transactionList = getInvoiceTransactionList(invoice);

      const validTransactions = transactionList.filter((transaction) => {
        return getTransactionAmount(transaction) > 0;
      });

      if (validTransactions.length > 0) {
        return validTransactions.map((transaction, index) => {
          const amount = getTransactionAmount(transaction);
          const reference = getTransactionReference(transaction, invoice);
          const provider = getTransactionProvider(transaction, invoice, source);
          const happenedAt = getTransactionDate(transaction, invoice);
          const transactionStatus = getTransactionStatus(transaction, invoice);

          return {
            ...baseRow,
            id: `payment-${invoice._id}-${reference}-${index}`,
            amount,
            status:
              normalizePaymentStatus(transactionStatus) === "partial"
                ? "Partially Paid"
                : transactionStatus,
            notificationStatus: normalizeNotificationStatus(
              transaction.notificationStatus ||
                transaction.customerNotificationStatus ||
                invoice.customerNotificationStatus
            ),
            provider,
            reference,
            transactionId:
              transaction.transactionId ||
              buildGeneratedTransactionId(
                transaction.paymentReference ||
                  transaction.reference ||
                  reference ||
                  invoice.paymentReference ||
                  invoice.invoiceNumber ||
                  invoice._id,
                happenedAt,
                index
              ),
            happenedAt,
          };
        });
      }

      return [
        {
          ...baseRow,
          id: `invoice-${invoice._id}`,
          type: "invoice",
          amount: Number(
            invoice.paidAmount ||
              invoice.amountPaid ||
              invoice.amount ||
              0
          ),
          status:
            normalizePaymentStatus(invoice.status) === "partial"
              ? "Partially Paid"
              : invoice.status || "Paid",
          notificationStatus: normalizeNotificationStatus(
            invoice.customerNotificationStatus
          ),
          provider:
            invoice.paymentProvider ||
            invoice.pendingPaymentProvider ||
            (source === "qr" ? "Monnify" : "Manual"),
          reference:
            invoice.paymentReference ||
            invoice.pendingPaymentReference ||
            invoice.invoiceNumber ||
            "-",
          transactionId:
            buildGeneratedTransactionId(
              invoice.paymentReference ||
                invoice.pendingPaymentReference ||
                invoice.invoiceNumber ||
                invoice._id,
              invoice.paidAt ||
                invoice.paymentConfirmedAt ||
                invoice.pendingPaymentCreatedAt ||
                invoice.date ||
                invoice.createdAt,
              0
            ),
          happenedAt:
            invoice.paidAt ||
            invoice.paymentConfirmedAt ||
            invoice.pendingPaymentCreatedAt ||
            invoice.date ||
            invoice.createdAt,
        },
      ];
    });

    return invoiceRows.sort(
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
        row.transactionId,
        row.provider,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesSource = sourceFilter === "all" || row.source === sourceFilter;

    const matchesStatus =
      statusFilter === "all" ||
      normalizePaymentStatus(row.status) === statusFilter;

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
    .filter((row) =>
      ["paid", "partial"].includes(normalizePaymentStatus(row.status))
    )
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

  const providerCount = new Set(
    filteredRows
      .map((row) => String(row.provider || "").trim())
      .filter(Boolean)
  ).size;

  const filterSummary = `${filteredRows.length} record${
    filteredRows.length === 1 ? "" : "s"
  } found`;

  const exportPayments = () => {
    const headers = [
      "Transaction ID",
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
      row.transactionId,
      row.customerName,
      row.phone,
      row.description,
      row.amount,
      formatPaymentStatus(row.status),
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
        title="Collections history"
        description="Review cleared transactions, invoice activity, notification outcomes, and collection records from one place."
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
          value={formatCurrency(totalCollected)}
          tone="emerald"
        />
        <StatCard
          label="Transactions"
          value={filteredRows.length}
          tone="slate"
        />
        <StatCard label="Providers" value={providerCount} tone="blue" />
        <StatCard
          label="WhatsApp sent"
          value={sentNotifications}
          tone="emerald"
        />
      </StatGrid>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Collection filters
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Narrow the ledger by date, source, settlement state, notification state,
                and customer details.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                {filterSummary}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                {latestPaymentDate
                  ? `Latest: ${latestPaymentDate}`
                  : "No activity date yet"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                Pending: {pendingCount}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-8">
            <InputField
              type="text"
              placeholder={`Search ${customerLabels.singular}, phone, reference, transaction ID...`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="2xl:col-span-2"
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
              <option value="partial">Partially paid</option>
              <option value="pending">Pending</option>
              <option value="unpaid">Unpaid</option>
              <option value="failed">Failed</option>
            </SelectField>

            <SelectField
              value={notificationFilter}
              onChange={(event) => setNotificationFilter(event.target.value)}
              className="md:col-span-2 2xl:col-span-2"
            >
              <option value="all">All notifications</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </SelectField>

            <button
              type="button"
              onClick={exportPayments}
              disabled={filteredRows.length === 0}
              className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700"
            >
              Export
            </button>

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
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Collection records
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {filteredRows.length} individual transaction
              {filteredRows.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[28rem]">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Total collected
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(totalCollected)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Notifications sent
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {sentNotifications}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Pending items
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {pendingCount}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading collections history...
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No collection records match these filters"
            description="Try clearing one or two filters to widen the timeline."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 lg:hidden">
              {filteredRows.map((row) => (
                <div key={row.id} className="space-y-3 p-3.5 sm:p-4">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {row.customerName}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="slate">{row.sourceLabel}</StatusBadge>

                      {row.phone ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {row.phone}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Description
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-300">
                        {row.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Invoice: {row.invoiceNumber || "-"}
                      </p>
                      <p className="break-all text-xs text-slate-500 dark:text-slate-400">
                        Transaction ID: {row.transactionId}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.amount)}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={getStatusTone(row.status)}>
                          {formatPaymentStatus(row.status)}
                        </StatusBadge>

                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {row.provider || "-"}
                        </span>
                      </div>

                      {Number(row.balanceDue || 0) > 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Balance: {formatCurrency(row.balanceDue)}
                        </p>
                      ) : null}

                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDateTime(row.happenedAt)}
                      </p>
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
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Transaction ID
                    </th>
                    <th className="w-[13%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Date
                    </th>
                    <th className="w-[15%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      {customerLabels.singularTitle}
                    </th>
                    <th className="w-[20%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Details
                    </th>
                    <th className="w-[9%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Source
                    </th>
                    <th className="w-[10%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Amount
                    </th>
                    <th className="w-[9%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="w-[10%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Provider / Msg
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-950/60"
                    >
                      <td className="px-4 py-3 align-middle">
                        <p
                          className="truncate whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-300"
                          title={row.transactionId}
                        >
                          {row.transactionId}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <p
                          className="truncate whitespace-nowrap text-sm text-slate-800 dark:text-slate-300"
                          title={formatDateTime(row.happenedAt)}
                        >
                          {formatDateTime(row.happenedAt)}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <p
                          className="truncate whitespace-nowrap font-medium text-slate-900 dark:text-slate-100"
                          title={buildInlineCustomer(row)}
                        >
                          {buildInlineCustomer(row)}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <p
                          className="truncate whitespace-nowrap text-sm text-slate-800 dark:text-slate-300"
                          title={buildInlineDetails(row)}
                        >
                          {buildInlineDetails(row)}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <StatusBadge tone="slate">{row.sourceLabel}</StatusBadge>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <p className="truncate whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(row.amount)}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <StatusBadge tone={getStatusTone(row.status)}>
                          {formatPaymentStatus(row.status)}
                        </StatusBadge>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <p
                          className="truncate whitespace-nowrap text-sm text-slate-700 dark:text-slate-300"
                          title={`${buildInlineProvider(row)} | Ref: ${row.reference || "-"}`}
                        >
                          {buildInlineProvider(row)}
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
