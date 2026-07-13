"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiRefreshCw,
  FiSearch,
  FiUploadCloud,
} from "react-icons/fi";
import {
  EmptyState,
  InputField,
  PageShell,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";
import { getCustomerLabels } from "../../../lib/businessLabels";
import { useBusinessSession } from "../../../lib/clientSession";

const views = [
  { key: "dashboard", label: "Dashboard" },
  { key: "upload", label: "Import" },
  { key: "matched", label: "Matched" },
  { key: "suggested", label: "Suggested" },
  { key: "unmatched", label: "Unmatched" },
  { key: "review", label: "Review" },
  { key: "history", label: "History" },
];

const NIGERIAN_BANK_ALIASES = [
  { name: "Access Bank", aliases: ["access", "access bank", "access bank plc", "accessbank"] },
  { name: "Citibank Nigeria", aliases: ["citi", "citibank", "citibank nigeria"] },
  { name: "Ecobank", aliases: ["eco", "ecobank", "ecobank nigeria", "eco bank"] },
  { name: "Fidelity Bank", aliases: ["fidelity", "fidelity bank", "fidelity bank plc"] },
  {
    name: "First Bank",
    aliases: ["first bank", "firstbank", "first bank of nigeria", "fbn", "fbn ltd", "firstbank nigeria"],
  },
  {
    name: "FCMB",
    aliases: ["fcmb", "first city monument bank", "first city monument", "first city monument bank plc"],
  },
  { name: "Globus Bank", aliases: ["globus", "globus bank"] },
  {
    name: "GTBank",
    aliases: ["gtb", "gtbank", "gt bank", "guaranty trust", "guaranty trust bank", "guaranty trust bank plc", "gtco"],
  },
  { name: "Jaiz Bank", aliases: ["jaiz", "jaiz bank"] },
  { name: "Keystone Bank", aliases: ["keystone", "keystone bank"] },
  { name: "Lotus Bank", aliases: ["lotus", "lotus bank"] },
  { name: "Optimus Bank", aliases: ["optimus", "optimus bank"] },
  { name: "Parallex Bank", aliases: ["parallex", "parallex bank"] },
  { name: "Polaris Bank", aliases: ["polaris", "polaris bank", "skye bank"] },
  { name: "Premium Trust Bank", aliases: ["premium trust", "premium trust bank", "ptb"] },
  { name: "Providus Bank", aliases: ["providus", "providus bank"] },
  { name: "Signature Bank", aliases: ["signature", "signature bank"] },
  { name: "Stanbic IBTC Bank", aliases: ["stanbic", "stanbic ibtc", "stanbic ibtc bank", "ibtc"] },
  {
    name: "Standard Chartered Bank",
    aliases: ["standard chartered", "standard chartered bank", "standard chartered nigeria", "sc bank", "scb"],
  },
  { name: "Sterling Bank", aliases: ["sterling", "sterling bank"] },
  { name: "SunTrust Bank", aliases: ["suntrust", "suntrust bank"] },
  { name: "TAJ Bank", aliases: ["taj", "taj bank"] },
  { name: "Titan Trust Bank", aliases: ["titan", "titan trust", "titan trust bank"] },
  {
    name: "UBA",
    aliases: ["uba", "united bank for africa", "united bank africa", "united bank for africa plc"],
  },
  { name: "Union Bank", aliases: ["union", "union bank", "union bank of nigeria"] },
  { name: "Unity Bank", aliases: ["unity", "unity bank"] },
  { name: "Wema Bank", aliases: ["wema", "wema bank", "alat", "alat by wema"] },
  { name: "Zenith Bank", aliases: ["zenith", "zenith bank", "zenith bank plc"] },
  { name: "Moniepoint", aliases: ["moniepoint", "monie point", "teamapt"] },
  { name: "OPay", aliases: ["opay", "o pay", "paycom", "paycom nigeria"] },
  { name: "PalmPay", aliases: ["palmpay", "palm pay"] },
  { name: "Kuda Bank", aliases: ["kuda", "kuda bank", "kuda microfinance bank"] },
  { name: "FairMoney", aliases: ["fairmoney", "fair money", "fairmoney mfb"] },
  { name: "VFD Microfinance Bank", aliases: ["vfd", "vfd bank", "vfd microfinance bank"] },
  { name: "Sparkle", aliases: ["sparkle", "sparkle bank", "sparkle microfinance bank"] },
];

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString();
}

function getTime(value) {
  if (!value) return 0;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortByDateDescending(rows, fields = []) {
  return [...rows].sort((a, b) => {
    const leftDate = fields.map((field) => getTime(a[field])).find(Boolean) || 0;
    const rightDate = fields.map((field) => getTime(b[field])).find(Boolean) || 0;

    return rightDate - leftDate;
  });
}

function normalizeBankName(value) {
  const raw = String(value || "").trim();

  if (!raw) return "Unknown Bank";

  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bplc\b/g, "")
    .replace(/\bltd\b/g, "")
    .replace(/\blimited\b/g, "")
    .replace(/\bnigeria\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const compact = normalized.replace(/\s+/g, "");

  const matchedBank = NIGERIAN_BANK_ALIASES.find((bank) =>
    bank.aliases.some((alias) => {
      const normalizedAlias = alias
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\bplc\b/g, "")
        .replace(/\bltd\b/g, "")
        .replace(/\blimited\b/g, "")
        .replace(/\bnigeria\b/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const compactAlias = normalizedAlias.replace(/\s+/g, "");

      return (
        normalized === normalizedAlias ||
        compact === compactAlias ||
        normalized.includes(normalizedAlias) ||
        compact.includes(compactAlias)
      );
    })
  );

  if (matchedBank) return matchedBank.name;

  return raw
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();

      if (["UBA", "FCMB", "GTB", "GTCO", "IBTC"].includes(upper)) return upper;
      if (upper === "OPAY") return "OPay";
      if (upper === "PALMPAY") return "PalmPay";

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function isGenericBankName(value) {
  const normalized = String(value || "").trim().toLowerCase();

  return (
    !normalized ||
    normalized === "other" ||
    normalized === "uploaded bank" ||
    normalized === "unknown" ||
    normalized === "unknown bank" ||
    normalized === "bank not selected"
  );
}

function getInvoiceStatus(invoice) {
  return String(invoice.status || invoice.paymentStatus || "unpaid").toLowerCase();
}

function getInvoiceAmount(invoice) {
  return Number(invoice.balanceDue || invoice.amount || invoice.subtotal || 0);
}

function getPaidAmount(invoice) {
  return Number(invoice.paidAmount || invoice.amountPaid || 0);
}

function getInvoiceCustomerName(invoice, fallback = "-") {
  return (
    invoice?.customer ||
    invoice?.customerName ||
    invoice?.student ||
    invoice?.studentName ||
    invoice?.name ||
    fallback
  );
}

function getInvoiceToken(invoice, fallback = "-") {
  return invoice?.customerToken || invoice?.token || invoice?.paymentToken || fallback;
}

function getInvoiceDescription(invoice) {
  return invoice?.description || invoice?.category || invoice?.class || "Invoice payment";
}

function Metric({ label, value, hint, tone = "slate", icon: Icon, onClick }) {
  const toneClass = {
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    rose:
      "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
    sky:
      "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
    slate:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  }[tone];

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        onClick
          ? "transition hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {hint}
            </p>
          ) : null}
        </div>

        {Icon ? (
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </Component>
  );
}

function QueueRow({ label, value, tone = "slate", description }) {
  const valueClass = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    sky: "text-sky-600",
    slate: "text-slate-900 dark:text-white",
  }[tone];

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800">
      <div className="min-w-0">
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <span className={`shrink-0 text-2xl font-semibold ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

export default function ReconciliationPage() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);

  return (
    <PageShell>
      <SurfaceCard className="max-w-3xl p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Archived page
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
          Reconciliation is hidden for now
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          The reconciliation workspace has been removed from the active dashboard,
          but its code is still kept in the project and can be restored later.
        </p>
        <div className="mt-6">
          <a
            href="/dashboard"
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Back to dashboard
          </a>
        </div>
      </SurfaceCard>
    </PageShell>
  );

  const [activeView, setActiveView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [statements, setStatements] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [rematching, setRematching] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    bank: "",
    startDate: "",
    endDate: "",
    password: "",
    fileName: "",
    file: null,
  });

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const cacheBust = Date.now();

      const [invoiceResponse, transactionResponse, statementResponse] =
        await Promise.all([
          authFetch(`/api/invoices?t=${cacheBust}`, {
            cache: "no-store",
          }),
          authFetch(`/api/reconciliation/transactions?t=${cacheBust}`, {
            cache: "no-store",
          }),
          authFetch(`/api/reconciliation/statements?t=${cacheBust}`, {
            cache: "no-store",
          }),
        ]);

      const invoiceData = invoiceResponse.ok ? await invoiceResponse.json() : [];
      const transactionData = transactionResponse.ok
        ? await transactionResponse.json()
        : [];
      const statementData = statementResponse.ok
        ? await statementResponse.json()
        : [];

      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setTransactions(Array.isArray(transactionData) ? transactionData : []);
      setStatements(Array.isArray(statementData) ? statementData : []);
    } catch (error) {
      console.error("Failed to load reconciliation data", error);
      setInvoices([]);
      setTransactions([]);
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(loadData, 0);

    return () => clearTimeout(initialLoad);
  }, [loadData]);

  const runReconciliationAgain = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setMessage("");
        setError("");
        setRematching(true);
      }

      try {
        const response = await authFetch("/api/reconciliation/rematch", {
          method: "POST",
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to rerun reconciliation");
        }

        if (!silent) {
          const summary = data.summary || {};
          const queues = summary.visibleQueues || {};
          const visibleQueueTotal =
            (queues.matched || 0) +
            (queues.suggested || 0) +
            (queues.unmatched || 0) +
            (queues.review || 0);

          setMessage(
            `Rerun complete. Visible queues: matched ${
              queues.matched || 0
            }, suggested ${queues.suggested || 0}, unmatched ${
              queues.unmatched || 0
            }, review ${queues.review || 0}. Checked ${
              summary.scannedTransactions || 0
            } stored record${
              summary.scannedTransactions === 1 ? "" : "s"
            }; showing ${visibleQueueTotal} visible queue record${
              visibleQueueTotal === 1 ? "" : "s"
            }. Refreshed ${summary.refreshed || 0}, including ${
              summary.duplicatesCorrected || 0
            } duplicate correction${
              summary.duplicatesCorrected === 1 ? "" : "s"
            }${
              summary.matchedFlaggedForReview
                ? `, moved ${summary.matchedFlaggedForReview} old matched record${
                    summary.matchedFlaggedForReview === 1 ? "" : "s"
                  } to review`
                : ""
            }.`
          );
        }

        if (data.summary?.suggested) {
          setActiveView("suggested");
        }

        await loadData();
      } catch (error) {
        if (!silent) {
          setError(error.message || "Unable to rerun reconciliation");
        }
      } finally {
        if (!silent) setRematching(false);
      }
    },
    [loadData]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      runReconciliationAgain({ silent: true });
    }, 120000);

    return () => clearInterval(timer);
  }, [runReconciliationAgain]);

  const paidInvoices = useMemo(
    () => invoices.filter((invoice) => getInvoiceStatus(invoice) === "paid"),
    [invoices]
  );

  const unpaidInvoices = useMemo(
    () => invoices.filter((invoice) => getInvoiceStatus(invoice) !== "paid"),
    [invoices]
  );

  const statementBankById = useMemo(() => {
    return statements.reduce((map, statement) => {
      if (statement?._id) {
        map[String(statement._id)] = statement.bankName || statement.bank || "";
      }

      return map;
    }, {});
  }, [statements]);

  function getReadableTransactionBank(transaction) {
    const transactionBank = transaction.bankName || transaction.bank;

    const statementBank =
      transaction.statementId && statementBankById[String(transaction.statementId)]
        ? statementBankById[String(transaction.statementId)]
        : "";

    if (!isGenericBankName(transactionBank)) {
      return normalizeBankName(transactionBank);
    }

    if (!isGenericBankName(statementBank)) {
      return normalizeBankName(statementBank);
    }

    return "Bank not selected";
  }

  const getInvoiceById = useCallback(
    (invoiceId) => {
      if (!invoiceId) return null;

      return invoices.find((invoice) => String(invoice._id) === String(invoiceId)) || null;
    },
    [invoices]
  );

  const getSuggestedInvoiceDetails = useCallback(
    (transaction) => {
      const invoice = getInvoiceById(transaction.suggestedInvoiceId);

      return {
        invoice,
        token:
          getInvoiceToken(invoice, "") ||
          transaction.suggestedInvoiceToken ||
          transaction.suggestedInvoiceNumber ||
          "-",
        customer: transaction.suggestedCustomer || getInvoiceCustomerName(invoice, "-"),
        description: getInvoiceDescription(invoice),
        amount: invoice?.balanceDue || invoice?.amount || invoice?.subtotal || 0,
      };
    },
    [getInvoiceById]
  );

  const getMatchedInvoiceDetails = useCallback(
    (transaction) => {
      const invoice = getInvoiceById(transaction.matchedInvoiceId);

      return {
        invoice,
        token:
          getInvoiceToken(invoice, "") ||
          transaction.matchedInvoiceToken ||
          transaction.matchedInvoiceNumber ||
          transaction.suggestedInvoiceToken ||
          transaction.suggestedInvoiceNumber ||
          "-",
        customer:
          transaction.matchedCustomer ||
          transaction.suggestedCustomer ||
          getInvoiceCustomerName(invoice, "-"),
        description: getInvoiceDescription(invoice),
        amount:
          invoice?.balanceDue ||
          invoice?.amount ||
          invoice?.subtotal ||
          transaction.amount ||
          0,
      };
    },
    [getInvoiceById]
  );

  const filteredPaidInvoices = sortByDateDescending(
    paidInvoices.filter((invoice) => {
      const search = searchTerm.trim().toLowerCase();

      if (!search) return true;

      return [
        invoice.customer,
        invoice.customerName,
        invoice.student,
        invoice.studentName,
        invoice.phone,
        invoice.invoiceNumber,
        invoice.token,
        invoice.customerToken,
        invoice.paymentToken,
        invoice.paymentProvider,
        invoice.pendingPaymentProvider,
        invoice.bankName,
        invoice.bank,
        invoice.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    }),
    ["paidAt", "paymentConfirmedAt", "updatedAt", "createdAt"]
  );

  const totalReconciled = paidInvoices.reduce(
    (sum, invoice) => sum + Number(getPaidAmount(invoice) || invoice.amount || 0),
    0
  );

  const outstandingAmount = unpaidInvoices.reduce(
    (sum, invoice) => sum + getInvoiceAmount(invoice),
    0
  );

  const matchRate = invoices.length
    ? Math.round((paidInvoices.length / invoices.length) * 100)
    : 0;

  const matchedTransactions = sortByDateDescending(
    transactions.filter((transaction) => transaction.status === "matched"),
    ["transactionDate", "paidAt", "updatedAt", "createdAt"]
  );

  const suggestedTransactions = sortByDateDescending(
    transactions.filter((transaction) => transaction.status === "suggested_match"),
    ["transactionDate", "rematchedAt", "updatedAt", "createdAt"]
  );

  const unmatchedTransactions = sortByDateDescending(
    transactions.filter((transaction) => transaction.status === "unmatched"),
    ["transactionDate", "updatedAt", "createdAt"]
  );

  const manualReviewTransactions = sortByDateDescending(
    transactions.filter((transaction) =>
      ["overpayment", "pending_review", "duplicate", "rejected"].includes(
        transaction.status
      )
    ),
    ["transactionDate", "updatedAt", "createdAt"]
  );

  const sortedStatements = sortByDateDescending(statements, [
    "createdAt",
    "updatedAt",
  ]);

  const manualReviewCount = manualReviewTransactions.length;

  const viewCounts = {
    dashboard: invoices.length,
    upload: null,
    matched: matchedTransactions.length || paidInvoices.length,
    suggested: suggestedTransactions.length,
    unmatched: unmatchedTransactions.length,
    review: manualReviewCount,
    history: statements.length,
  };

  const resetUploadForm = () => {
    setUploadForm({
      bank: "",
      startDate: "",
      endDate: "",
      password: "",
      fileName: "",
      file: null,
    });
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!uploadForm.bank || isGenericBankName(uploadForm.bank)) {
      setError("Select the bank before uploading the statement.");
      return;
    }

    if (!uploadForm.file) {
      setError("Choose a bank statement file before starting reconciliation.");
      return;
    }

    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", uploadForm.file);
      body.append("bankName", normalizeBankName(uploadForm.bank));
      body.append("startDate", uploadForm.startDate);
      body.append("endDate", uploadForm.endDate);
      body.append("password", uploadForm.password);

      const response = await authFetch("/api/reconciliation/statements", {
        method: "POST",
        body,
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to reconcile statement");
      }

      const summary = data.summary || {};

      setMessage(
        `Processed ${summary.imported || 0} credit transaction${
          summary.imported === 1 ? "" : "s"
        }. Matched ${summary.matched || 0}, suggested ${
          summary.suggested || 0
        }, manual review ${summary.manualReview || 0}, unmatched ${
          summary.unmatched || 0
        }, duplicates ${summary.duplicates || 0}, ignored ${
          summary.ignored || 0
        }.`
      );

      setActiveView(
        (summary.suggested || 0) > 0
          ? "suggested"
          : (summary.manualReview || 0) > 0 || (summary.duplicates || 0) > 0
            ? "review"
            : (summary.unmatched || 0) > 0
              ? "unmatched"
              : "matched"
      );

      resetUploadForm();
      await loadData();
    } catch (error) {
      setError(error.message || "Unable to reconcile statement");
    } finally {
      setUploading(false);
    }
  };

  const handleTransactionAction = async (transactionId, action) => {
    setActionBusy(`${transactionId}-${action}`);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/reconciliation/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, action }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to update transaction");
      }

      setMessage(
        action === "approve"
          ? "Suggested match approved and invoice updated."
          : action === "validate_review" || action === "validate_unmatched"
            ? data.message || "Transaction validated."
            : action === "reject"
              ? "Transaction rejected."
              : action === "ignore"
                ? "Transaction ignored."
                : "Transaction updated."
      );

      await loadData();
    } catch (error) {
      setError(error.message || "Unable to update transaction");
    } finally {
      setActionBusy("");
    }
  };

  const renderInvoiceRows = (rows) => {
    if (loading) {
      return (
        <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading reconciliation data...
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          title="No records found"
          description="Upload a bank statement or clear the search field to widen the view."
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] table-fixed">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70">
              <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Token
              </th>
              <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {customerLabels.singularTitle}
              </th>
              <th className="w-[22%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Details
              </th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Amount
              </th>
              <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Status
              </th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Date
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((invoice) => {
              const status = getInvoiceStatus(invoice);

              return (
                <tr
                  key={invoice._id || invoice.invoiceNumber || invoice.token}
                  className="hover:bg-slate-50 dark:hover:bg-slate-950/50"
                >
                  <td className="break-words px-4 py-3 align-top font-mono text-xs text-slate-700 dark:text-slate-300">
                    {getInvoiceToken(invoice, "-")}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-950 dark:text-white">
                      {getInvoiceCustomerName(invoice, customerLabels.singularTitle)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {invoice.phone || invoice.email || "-"}
                    </p>
                  </td>

                  <td className="px-4 py-3 align-top text-sm text-slate-700 dark:text-slate-300">
                    {getInvoiceDescription(invoice)}
                  </td>

                  <td className="px-4 py-3 align-top font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(getPaidAmount(invoice) || invoice.amount)}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <StatusBadge tone={status === "paid" ? "green" : "orange"}>
                      {status === "paid" ? "Matched" : "Review"}
                    </StatusBadge>
                  </td>

                  <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(
                      invoice.paidAt ||
                        invoice.paymentConfirmedAt ||
                        invoice.updatedAt ||
                        invoice.createdAt
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTransactionRows = (rows, mode) => {
    if (loading) {
      return (
        <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading reconciliation transactions...
        </div>
      );
    }

    if (!rows.length) {
      return (
        <EmptyState
          title="No transactions in this queue"
          description="Upload a bank statement to populate this section."
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70">
              <th className="w-[10%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Date
              </th>
              <th className="w-[13%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Bank
              </th>
              <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Amount
              </th>
              <th className="w-[25%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Remarks
              </th>
              <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {mode === "matched" ? "Matched token" : "Suggested token"}
              </th>
              <th className="w-[10%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Confidence
              </th>
              <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((transaction) => {
              const hasSuggestedInvoice =
                transaction.status === "suggested_match" &&
                transaction.suggestedInvoiceId;

              const hasMatchedInvoice =
                transaction.status === "matched" &&
                (transaction.matchedInvoiceId ||
                  transaction.matchedInvoiceToken ||
                  transaction.matchedInvoiceNumber ||
                  transaction.matchedCustomer);

              const suggestedInvoice = getSuggestedInvoiceDetails(transaction);
              const matchedInvoice = getMatchedInvoiceDetails(transaction);
              const displayInvoice =
                mode === "matched" ? matchedInvoice : suggestedInvoice;

              return (
                <tr
                  key={transaction._id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-950/50"
                >
                  <td className="px-4 py-3 align-top text-sm text-slate-700 dark:text-slate-300">
                    {formatDate(
                      transaction.transactionDate ||
                        transaction.updatedAt ||
                        transaction.createdAt
                    )}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {getReadableTransactionBank(transaction)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Statement source
                    </p>
                  </td>

                  <td className="px-4 py-3 align-top font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(transaction.amount)}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">
                      {transaction.remarks || transaction.narration || "-"}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-500">
                      Ref: {transaction.reference || "-"}
                    </p>
                  </td>

                  <td className="px-4 py-3 align-top text-sm text-slate-700 dark:text-slate-300">
                    {mode === "matched" && hasMatchedInvoice ? (
                      <>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {displayInvoice.customer}
                        </p>
                        <p className="mt-1 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Token: {displayInvoice.token}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {displayInvoice.description}
                        </p>
                        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                          Matched token
                        </p>
                      </>
                    ) : hasSuggestedInvoice ? (
                      <>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {displayInvoice.customer}
                        </p>
                        <p className="mt-1 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Token: {displayInvoice.token}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {displayInvoice.description}
                        </p>
                        <p className="mt-1 text-xs text-sky-600 dark:text-sky-300">
                          Suggested token
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-900 dark:text-white">
                          -
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {mode === "matched"
                            ? "Matched token not recorded"
                            : "No token suggested"}
                        </p>
                      </>
                    )}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <StatusBadge
                      tone={
                        Number(transaction.confidence || 0) >= 95
                          ? "green"
                          : Number(transaction.confidence || 0) >= 55
                            ? "orange"
                            : "red"
                      }
                    >
                      {Number(transaction.confidence || 0)}%
                    </StatusBadge>

                    {transaction.matchReasons?.length ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {transaction.matchReasons.join(", ")}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3 align-top">
                    {mode === "suggested" && hasSuggestedInvoice ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAction(transaction._id, "approve")
                          }
                          disabled={actionBusy === `${transaction._id}-approve`}
                          className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Validate
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAction(transaction._id, "reject")
                          }
                          disabled={actionBusy === `${transaction._id}-reject`}
                          className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Reject
                        </button>
                      </div>
                    ) : mode === "unmatched" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAction(
                              transaction._id,
                              "validate_unmatched"
                            )
                          }
                          disabled={
                            actionBusy === `${transaction._id}-validate_unmatched`
                          }
                          className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Validate
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAction(transaction._id, "reject")
                          }
                          disabled={actionBusy === `${transaction._id}-reject`}
                          className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Reject
                        </button>
                      </div>
                    ) : mode === "review" &&
                      transaction.status === "pending_review" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAction(
                              transaction._id,
                              "validate_review"
                            )
                          }
                          disabled={
                            actionBusy === `${transaction._id}-validate_review`
                          }
                          className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Validate
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAction(transaction._id, "reject")
                          }
                          disabled={actionBusy === `${transaction._id}-reject`}
                          className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <StatusBadge
                        tone={transaction.status === "matched" ? "green" : "slate"}
                      >
                        {String(transaction.status || "pending").replaceAll(
                          "_",
                          " "
                        )}
                      </StatusBadge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStatementRows = () => {
    if (!sortedStatements.length) {
      return (
        <EmptyState
          title="No reconciliation history yet"
          description="Uploaded statements will appear here after import."
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70">
              <th className="w-[28%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                File
              </th>
              <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Bank
              </th>
              <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Imported
              </th>
              <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Matched
              </th>
              <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Uploaded
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sortedStatements.map((statement) => (
              <tr
                key={statement._id}
                className="hover:bg-slate-50 dark:hover:bg-slate-950/50"
              >
                <td className="break-words px-4 py-3 text-sm font-medium text-slate-950 dark:text-white">
                  {statement.fileName || "Statement"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                  {normalizeBankName(statement.bankName || statement.bank)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                  {statement.summary?.imported || statement.importedCount || 0}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                  {statement.summary?.matched || 0}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                  {formatDate(statement.createdAt || statement.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <PageShell>
      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 px-5 py-5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                Bank statement matching
              </span>

              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
                Reconciliation
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Import bank statements, compare deposits with outstanding invoices,
                and keep only exceptions in front of your team.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setActiveView("upload")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <FiUploadCloud className="h-4 w-4" />
                Import statement
              </button>

              <button
                type="button"
                onClick={() => runReconciliationAgain()}
                disabled={rematching}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FiRefreshCw
                  className={`h-4 w-4 ${rematching ? "animate-spin" : ""}`}
                />
                {rematching ? "Checking..." : "Run again"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Reconciled"
              value={formatCurrency(totalReconciled)}
              hint={`${paidInvoices.length} matched invoice${
                paidInvoices.length === 1 ? "" : "s"
              }`}
              tone="emerald"
              icon={FiCheckCircle}
            />

            <Metric
              label="Outstanding"
              value={formatCurrency(outstandingAmount)}
              hint={`${unpaidInvoices.length} invoice${
                unpaidInvoices.length === 1 ? "" : "s"
              } open`}
              tone="amber"
              icon={FiClock}
            />

            <Metric
              label="Manual review"
              value={manualReviewCount}
              hint="Needs manual decision"
              tone="rose"
              icon={FiAlertCircle}
              onClick={() => setActiveView("review")}
            />

            <Metric
              label="Match accuracy"
              value={`${matchRate}%`}
              hint="Based on recorded invoices"
              tone="sky"
              icon={FiCheckCircle}
            />
          </div>
        </div>

        <div className="bg-white px-3 py-3 dark:bg-slate-900">
          <div className="flex gap-2 overflow-x-auto">
            {views.map((view) => {
              const isActive = activeView === view.key;
              const count = viewCounts[view.key];

              return (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => setActiveView(view.key)}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
                    isActive
                      ? view.key === "upload"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                        : "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {view.label}

                  {typeof count === "number" ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isActive
                          ? "bg-white/15 text-current dark:bg-slate-950/10"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </SurfaceCard>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {activeView === "dashboard" ? (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <SurfaceCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Reconciliation queue
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  A clean view of what is already recorded and what still needs bank evidence.
                </p>
              </div>

              <StatusBadge tone={manualReviewCount ? "orange" : "green"}>
                {manualReviewCount ? "Attention needed" : "Clear"}
              </StatusBadge>
            </div>

            <div className="mt-5">
              <QueueRow
                label="Matched payments"
                value={matchedTransactions.length || paidInvoices.length}
                tone="emerald"
                description="Invoices already marked as paid."
              />
              <QueueRow
                label="Suggested matches"
                value={suggestedTransactions.length}
                tone="sky"
                description="Likely matches found during automatic re-checks."
              />
              <QueueRow
                label="Manual review"
                value={manualReviewCount}
                tone="amber"
                description="Exceptions that need approval, rejection, or investigation."
              />
              <QueueRow
                label="Unmatched deposits"
                value={unmatchedTransactions.length}
                tone="rose"
                description="Credits that could not be linked to an invoice."
              />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Quick actions
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use these actions when reviewing bank payments.
            </p>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => setActiveView("upload")}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Upload bank statement
                <FiUploadCloud className="h-4 w-4 text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView("review")}
                className="flex h-12 items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Review open invoices
                <FiAlertCircle className="h-4 w-4 text-amber-600" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setMessage(
                    "Reports export will be available once bank statement imports are connected."
                  )
                }
                className="flex h-12 items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Export report
                <FiDownload className="h-4 w-4 text-sky-600" />
              </button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {activeView === "upload" ? (
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Upload bank statement
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Import CSV, Excel, or PDF statements. Add a password if the PDF is protected.
            </p>
          </div>

          <form
            onSubmit={handleUploadSubmit}
            className="grid gap-4 p-5 lg:grid-cols-2"
          >
            <select
              value={uploadForm.bank}
              onChange={(event) =>
                setUploadForm((form) => ({
                  ...form,
                  bank: event.target.value,
                }))
              }
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
            >
              <option value="">Select bank</option>
              {NIGERIAN_BANK_ALIASES.map((bank) => (
                <option key={bank.name} value={bank.name}>
                  {bank.name}
                </option>
              ))}
            </select>

            <InputField
              type="password"
              placeholder="PDF password, if any"
              value={uploadForm.password}
              onChange={(event) =>
                setUploadForm((form) => ({
                  ...form,
                  password: event.target.value,
                }))
              }
            />

            <InputField
              type="date"
              value={uploadForm.startDate}
              onChange={(event) =>
                setUploadForm((form) => ({
                  ...form,
                  startDate: event.target.value,
                }))
              }
              aria-label="Statement start date"
            />

            <InputField
              type="date"
              value={uploadForm.endDate}
              onChange={(event) =>
                setUploadForm((form) => ({
                  ...form,
                  endDate: event.target.value,
                }))
              }
              aria-label="Statement end date"
            />

            <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 lg:col-span-2">
              <FiUploadCloud className="mb-2 h-6 w-6 text-emerald-600" />

              <span className="font-semibold">
                {uploadForm.fileName || "Choose statement file"}
              </span>

              <span className="mt-1 text-xs text-slate-500">
                CSV, XLSX, or PDF
              </span>

              <input
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                className="sr-only"
                onChange={(event) =>
                  setUploadForm((form) => ({
                    ...form,
                    fileName: event.target.files?.[0]?.name || "",
                    file: event.target.files?.[0] || null,
                  }))
                }
              />
            </label>

            <button
              type="submit"
              disabled={uploading}
              className="h-12 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-slate-700 lg:col-span-2"
            >
              {uploading ? "Reconciling..." : "Start reconciliation"}
            </button>
          </form>
        </SurfaceCard>
      ) : null}

      {activeView === "matched" ? (
        <SurfaceCard className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Matched transactions
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Paid invoices that are already reconciled in InvoiceHub.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <InputField
                type="text"
                placeholder="Search matched records"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-10"
              />
            </div>
          </div>

          {matchedTransactions.length
            ? renderTransactionRows(matchedTransactions, "matched")
            : renderInvoiceRows(filteredPaidInvoices)}
        </SurfaceCard>
      ) : null}

      {activeView === "review" ? (
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Manual review
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Open invoices that can be checked against new bank statement credits.
            </p>
          </div>

          {manualReviewTransactions.length === 0 ? (
            <EmptyState
              title="No manual review items"
              description="Only transaction exceptions appear here. Name matches are shown under Suggested Matches."
            />
          ) : (
            renderTransactionRows(manualReviewTransactions, "review")
          )}
        </SurfaceCard>
      ) : null}

      {activeView === "suggested" ? (
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Suggested matches
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Review likely matches before updating invoices.
            </p>
          </div>

          {renderTransactionRows(suggestedTransactions, "suggested")}
        </SurfaceCard>
      ) : null}

      {activeView === "unmatched" ? (
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Unmatched transactions
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Credits that could not be linked to an invoice.
            </p>
          </div>

          {renderTransactionRows(unmatchedTransactions, "unmatched")}
        </SurfaceCard>
      ) : null}

      {activeView === "history" ? (
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Reconciliation history
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Recently imported bank statements and their matching results.
            </p>
          </div>

          {renderStatementRows()}
        </SurfaceCard>
      ) : null}
    </PageShell>
  );
}
