"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiFilter,
  FiMessageCircle,
  FiPlus,
  FiRefreshCw,
  FiRepeat,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
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
import { useConfirm } from "../../../components/AppFeedback";
import CreateInvoiceModal from "../../../components/CreateInvoiceModal";

function formatCurrency(value) {
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

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function getOriginalInvoiceAmount(invoice = {}) {
  const amount = Number(
    invoice.originalAmount ?? invoice.amount ?? invoice.total ?? 0
  );

  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
}

function getOutstandingAmount(invoice = {}) {
  const amount = getOriginalInvoiceAmount(invoice);
  const paidAmount = Number(invoice.paidAmount || invoice.amountPaid || 0);
  const balanceDue = Number(invoice.balanceDue);
  const status = String(invoice.status || invoice.paymentStatus || "").toLowerCase();

  if (status === "paid") return 0;

  if (Number.isFinite(balanceDue) && balanceDue > 0) {
    return Math.min(balanceDue, amount || balanceDue);
  }

  if (paidAmount > 0) {
    return Math.max(amount - paidAmount, 0);
  }

  return amount;
}

function getManualPaymentLimit(invoice) {
  const invoiceAmount = getOriginalInvoiceAmount(invoice);
  const outstandingAmount = Number(getOutstandingAmount(invoice) || 0);

  if (outstandingAmount > 0 && outstandingAmount < invoiceAmount) {
    return {
      limit: outstandingAmount,
      label: "outstanding balance",
    };
  }

  return {
    limit: invoiceAmount,
    label: "invoice amount",
  };
}

function normalizeNotificationStatus(status) {
  return status === "pending-whatsapp" ? "prepared" : status || "draft";
}

function getNotificationTone(status) {
  const normalized = normalizeNotificationStatus(status);

  if (normalized === "sent") return "green";
  if (normalized === "prepared") return "blue";
  if (normalized === "failed") return "red";

  return "slate";
}

function getInvoiceCustomerName(invoice = {}, fallback = "Customer") {
  return (
    invoice.customer ||
    invoice.customerName ||
    invoice.student ||
    invoice.studentName ||
    invoice.name ||
    fallback
  );
}

function getInvoiceCategory(invoice = {}) {
  return invoice.category || invoice.class || "Uncategorized";
}

function getInvoiceProvider(invoice = {}) {
  return invoice.paymentProvider || invoice.pendingPaymentProvider || "Not started";
}

function getInvoiceStatus(invoice = {}) {
  return String(invoice.status || invoice.paymentStatus || "Unpaid");
}

function isInvoicePaid(invoice = {}) {
  return getOutstandingAmount(invoice) <= 0;
}

function getDueStatus(invoice = {}) {
  const outstanding = getOutstandingAmount(invoice);

  if (outstanding <= 0) {
    return {
      label: "Settled",
      tone: "green",
    };
  }

  const dueDate = invoice.dueDate || invoice.date || invoice.createdAt;

  if (!dueDate) {
    return {
      label: "Open",
      tone: "orange",
    };
  }

  const due = new Date(dueDate);
  const now = new Date();

  if (Number.isNaN(due.getTime())) {
    return {
      label: "Open",
      tone: "orange",
    };
  }

  if (due < now) {
    return {
      label: "Overdue",
      tone: "red",
    };
  }

  return {
    label: "Due",
    tone: "orange",
  };
}

function getCollectionRate(totalAmount, balancePending) {
  if (!totalAmount) return 0;

  const collected = Math.max(totalAmount - balancePending, 0);

  return Math.round((collected / totalAmount) * 100);
}

function getBrowserWhatsAppUrlFromResponse(data = {}) {
  return (
    data?.delivery?.fallbackUrl ||
    data?.notification?.fallbackUrl ||
    data?.whatsapp?.fallbackUrl ||
    data?.fallbackUrl ||
    ""
  );
}

function getWhatsAppProviderFromResponse(data = {}) {
  return (
    data?.delivery?.provider ||
    data?.notification?.provider ||
    data?.whatsapp?.provider ||
    data?.provider ||
    ""
  );
}

function openWhatsAppSameTab(url, notify) {
  if (!url) return false;

  try {
    window.location.href = url;
    return true;
  } catch {
    notify?.(
      "error",
      "Unable to open WhatsApp. Please copy the payment link and send it manually."
    );
    return false;
  }
}

function openExternalTab(url, notify) {
  if (!url) return false;

  const opened = window.open(url, "_blank", "noopener,noreferrer");

  if (!opened) {
    notify?.(
      "error",
      "Your browser blocked the WhatsApp tab. Please allow pop-ups for InvoiceHub and try again."
    );
    return false;
  }

  return true;
}

function searchMatches(values, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  if (!normalizedQuery) return true;

  return values
    .filter((value) => value !== undefined && value !== null)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function NoticeBanner({ notice }) {
  if (!notice?.text) return null;

  const classes = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    info:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    error:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        classes[notice.tone] || classes.info
      }`}
    >
      {notice.text}
    </div>
  );
}

function CompactInvoiceSummary({
  totalInvoiceAmount,
  balancePendingAmount,
  collectionRate,
  actionableCount,
  overdueCount,
  preparedNotificationCount,
  unpaidCount,
}) {
  const metrics = [
    {
      label: "Open",
      value: actionableCount,
      tone: "text-slate-950 dark:text-white",
    },
    {
      label: "Total",
      value: formatCurrency(totalInvoiceAmount),
      tone: "text-blue-600",
    },
    {
      label: "Pending",
      value: formatCurrency(balancePendingAmount),
      tone: "text-orange-600",
    },
    {
      label: "Collected",
      value: `${collectionRate}%`,
      tone: collectionRate >= 80 ? "text-emerald-600" : "text-orange-600",
    },
  ];

  const insights = [
    {
      icon: FiClock,
      label: "Overdue",
      value: overdueCount,
      tone: overdueCount ? "text-red-600" : "text-slate-500",
    },
    {
      icon: FiMessageCircle,
      label: "Ready",
      value: preparedNotificationCount,
      tone: "text-blue-600",
    },
    {
      icon: FiCreditCard,
      label: "Unpaid",
      value: unpaidCount,
      tone: "text-orange-600",
    },
  ];

  return (
    <SurfaceCard className="px-4 py-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {metric.label}
              </p>
              <p className={`mt-1 truncate text-lg font-semibold ${metric.tone}`}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 xl:min-w-[360px]">
          {insights.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <item.icon className={`h-4 w-4 shrink-0 ${item.tone}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${item.tone}`}>
                  {item.value}
                </p>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

export default function Invoices() {
  const confirm = useConfirm();
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);

  const [invoices, setInvoices] = useState([]);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [activePage, setActivePage] = useState("invoices");

  const [invoiceFilterForm, setInvoiceFilterForm] = useState({
    search: "",
    category: "all",
    provider: "all",
    status: "all",
    notification: "all",
    dateFrom: "",
    dateTo: "",
  });

  const [invoiceFilters, setInvoiceFilters] = useState({
    search: "",
    category: "all",
    provider: "all",
    status: "all",
    notification: "all",
    dateFrom: "",
    dateTo: "",
  });

  const [recurringSearch, setRecurringSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ tone: "", text: "" });
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringLoaded, setRecurringLoaded] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  const [manualPaymentModal, setManualPaymentModal] = useState({
    open: false,
    invoice: null,
    amount: "",
  });

  const [savingManualPayment, setSavingManualPayment] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [savingRecurring, setSavingRecurring] = useState(false);
  const [runningRecurring, setRunningRecurring] = useState(false);

  const [recurringForm, setRecurringForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    description: "",
    amount: "",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });

  const showNotice = useCallback((tone, text) => {
    setNotice({ tone, text });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const search =
      params.get("search") ||
      params.get("customer") ||
      params.get("student") ||
      "";
    const category = params.get("category") || "";

    if (!search && !category) return;

    const nextFilters = {
      search,
      category: category || "all",
      provider: "all",
      status: "all",
      notification: "all",
      dateFrom: "",
      dateTo: "",
    };

    const applyUrlFilters = window.setTimeout(() => {
      setInvoiceFilterForm(nextFilters);
      setInvoiceFilters(nextFilters);
    }, 0);

    return () => window.clearTimeout(applyUrlFilters);
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);

    try {
      const cacheBust = Date.now();

      const invoiceRes = await authFetch(`/api/invoices?t=${cacheBust}`, {
        cache: "no-store",
      });

      const data = invoiceRes.ok ? await invoiceRes.json() : [];

      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecurringInvoices = useCallback(async () => {
    setRecurringLoading(true);

    try {
      const cacheBust = Date.now();

      const recurringRes = await authFetch(
        `/api/recurring-invoices?t=${cacheBust}`,
        {
          cache: "no-store",
        }
      );

      const recurringData = recurringRes.ok ? await recurringRes.json() : [];

      setRecurringInvoices(Array.isArray(recurringData) ? recurringData : []);
      setRecurringLoaded(true);
    } catch {
      setRecurringInvoices([]);
    } finally {
      setRecurringLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadInvoices();
    }, 0);

    return () => clearTimeout(initialLoad);
  }, [loadInvoices]);

  useEffect(() => {
    if (activePage !== "recurring" || recurringLoaded || recurringLoading) {
      return undefined;
    }

    const recurringLoad = setTimeout(() => {
      loadRecurringInvoices();
    }, 0);

    return () => clearTimeout(recurringLoad);
  }, [activePage, recurringLoaded, recurringLoading, loadRecurringInvoices]);

  const actionableInvoices = useMemo(
    () => invoices.filter((invoice) => getOutstandingAmount(invoice) > 0),
    [invoices]
  );

  const invoiceCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          invoices.map((invoice) => getInvoiceCategory(invoice))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [invoices]
  );

  const invoiceProviderOptions = useMemo(
    () =>
      Array.from(
        new Set(invoices.map((invoice) => getInvoiceProvider(invoice)))
      ).sort((a, b) => a.localeCompare(b)),
    [invoices]
  );

  const invoiceStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(invoices.map((invoice) => getInvoiceStatus(invoice)))
      ).sort((a, b) => a.localeCompare(b)),
    [invoices]
  );

  const notificationStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          invoices.map((invoice) =>
            normalizeNotificationStatus(invoice.customerNotificationStatus)
          )
        )
      ).sort((a, b) => a.localeCompare(b)),
    [invoices]
  );

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceCategory = getInvoiceCategory(invoice);
      const paymentProvider = getInvoiceProvider(invoice);
      const invoiceStatus = getInvoiceStatus(invoice);
      const notificationStatus = normalizeNotificationStatus(
        invoice.customerNotificationStatus
      );

      const rawInvoiceDate = invoice.date || invoice.dueDate || invoice.createdAt;
      const invoiceDate = rawInvoiceDate ? new Date(rawInvoiceDate) : null;
      const dateFrom = invoiceFilters.dateFrom
        ? new Date(`${invoiceFilters.dateFrom}T00:00:00`)
        : null;
      const dateTo = invoiceFilters.dateTo
        ? new Date(`${invoiceFilters.dateTo}T23:59:59`)
        : null;

      const matchesCategory =
        invoiceFilters.category === "all" ||
        invoiceCategory === invoiceFilters.category;

      const matchesProvider =
        invoiceFilters.provider === "all" ||
        paymentProvider === invoiceFilters.provider;

      const matchesStatus =
        invoiceFilters.status === "all" ||
        invoiceStatus === invoiceFilters.status;

      const matchesNotification =
        invoiceFilters.notification === "all" ||
        notificationStatus === invoiceFilters.notification;

      const matchesDateFrom = !dateFrom || !invoiceDate || invoiceDate >= dateFrom;
      const matchesDateTo = !dateTo || !invoiceDate || invoiceDate <= dateTo;

      const matchesSearch = searchMatches(
        [
          invoice.customer,
          invoice.customerName,
          invoice.student,
          invoice.studentName,
          invoice.invoiceNumber,
          invoice.description,
          invoice.category,
          invoice.class,
          invoice.phone,
          invoice.email,
          invoice.status,
          invoice.paymentProvider,
          invoice.pendingPaymentProvider,
          normalizeNotificationStatus(invoice.customerNotificationStatus),
          getOutstandingAmount(invoice),
        ],
        invoiceFilters.search
      );

      return (
        matchesCategory &&
        matchesProvider &&
        matchesStatus &&
        matchesNotification &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesSearch
      );
    });
  }, [invoices, invoiceFilters]);

  const filteredRecurringInvoices = useMemo(() => {
    return recurringInvoices.filter((schedule) =>
      searchMatches(
        [
          schedule.customerName,
          schedule.customer,
          schedule.description,
          schedule.phone,
          schedule.email,
          schedule.frequency,
          schedule.active === false ? "paused" : "active",
          schedule.amount,
          schedule.generatedCount,
          normalizeNotificationStatus(schedule.lastNotification?.status),
        ],
        recurringSearch
      )
    );
  }, [recurringInvoices, recurringSearch]);

  const totalInvoiceAmount = useMemo(
    () =>
      invoices.reduce(
        (sum, invoice) => sum + getOriginalInvoiceAmount(invoice),
        0
      ),
    [invoices]
  );

  const balancePendingAmount = useMemo(
    () =>
      actionableInvoices.reduce(
        (sum, invoice) => sum + getOutstandingAmount(invoice),
        0
      ),
    [actionableInvoices]
  );

  const unpaidCount = actionableInvoices.length;

  const collectionRate = getCollectionRate(
    totalInvoiceAmount,
    balancePendingAmount
  );

  const overdueCount = actionableInvoices.filter(
    (invoice) => getDueStatus(invoice).label === "Overdue"
  ).length;

  const preparedNotificationCount = actionableInvoices.filter(
    (invoice) =>
      normalizeNotificationStatus(invoice.customerNotificationStatus) ===
      "prepared"
  ).length;

  const activeRecurringCount = recurringInvoices.filter(
    (schedule) => schedule.active !== false
  ).length;

  const recurringTotalAmount = recurringInvoices.reduce(
    (sum, schedule) => sum + Number(schedule.amount || 0),
    0
  );

  const dueRecurringCount = recurringInvoices.filter((schedule) => {
    if (schedule.active === false || !schedule.nextRunAt) return false;

    return new Date(schedule.nextRunAt) <= new Date();
  }).length;

  const updateInvoiceFilterForm = (field, value) => {
    setInvoiceFilterForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const applyInvoiceFilters = () => {
    setInvoiceFilters(invoiceFilterForm);
  };

  const resetInvoiceFilters = () => {
    const reset = {
      search: "",
      category: "all",
      provider: "all",
      status: "all",
      notification: "all",
      dateFrom: "",
      dateTo: "",
    };

    setInvoiceFilterForm(reset);
    setInvoiceFilters(reset);
  };

  const openManualPaymentModal = (invoice) => {
    const { limit } = getManualPaymentLimit(invoice);

    setManualPaymentModal({
      open: true,
      invoice,
      amount: limit > 0 ? String(limit) : "",
    });
  };

  const closeManualPaymentModal = () => {
    if (savingManualPayment) return;

    setManualPaymentModal({
      open: false,
      invoice: null,
      amount: "",
    });
  };

  const markPaid = async (invoice, paidAmount) => {
    const id = invoice?._id;
    const { limit, label } = getManualPaymentLimit(invoice);
    const normalizedPaidAmount = Number(paidAmount || 0);

    if (!id || !Number.isFinite(normalizedPaidAmount) || normalizedPaidAmount <= 0) {
      showNotice("error", "Enter a valid paid amount.");
      return;
    }

    if (normalizedPaidAmount > limit) {
      showNotice(
        "error",
        `Paid amount cannot be more than the ${label} of ${formatCurrency(limit)}.`
      );
      return;
    }

    setSavingManualPayment(true);

    try {
      const res = await authFetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount: normalizedPaidAmount }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Update failed");
      }

      setManualPaymentModal({
        open: false,
        invoice: null,
        amount: "",
      });

      showNotice(
        "success",
        data.message ||
          (normalizedPaidAmount >= limit
            ? "Invoice marked as paid."
            : "Manual payment recorded.")
      );

      await loadInvoices();
    } catch (error) {
      showNotice("error", error.message || "Unable to record payment.");
      await loadInvoices();
    } finally {
      setSavingManualPayment(false);
    }
  };

  const deleteInvoice = async (id) => {
    const confirmed = await confirm({
      title: "Delete invoice",
      message: "Delete this invoice? This action cannot be undone.",
      confirmLabel: "Delete",
    });

    if (!confirmed) return;

    try {
      const res = await authFetch(`/api/invoices/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        showNotice("error", "Delete failed");
        return;
      }

      setInvoices((previous) =>
        previous.filter((invoice) => String(invoice._id) !== String(id))
      );

      showNotice("success", "Invoice deleted.");
    } catch {
      showNotice("error", "Error deleting invoice");
    }
  };

  const shareWhatsApp = async (invoice) => {
  if (!invoice.phone) {
    showNotice("error", "No phone number is available for this invoice.");
    return;
  }

  if (
    !invoice.token &&
    !invoice.paymentUrl &&
    !invoice.paymentLink &&
    !invoice.checkoutUrl
  ) {
    showNotice("error", "This invoice does not have a payment link yet.");
    return;
  }

  try {
    const res = await authFetch("/api/notifications/whatsapp/invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: String(invoice._id),
        origin: window.location.origin,
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showNotice("error", data.error || "Unable to prepare WhatsApp message.");
      return;
    }

    const provider = getWhatsAppProviderFromResponse(data);
    const fallbackUrl = getBrowserWhatsAppUrlFromResponse(data);

    /*
      Browser WhatsApp/manual share:
      Use same-tab redirect instead of opening a new window.
    */
    if ((provider === "browser" || fallbackUrl) && fallbackUrl) {
      showNotice("success", "Opening WhatsApp with the prepared invoice message.");

      window.setTimeout(() => {
        openWhatsAppSameTab(fallbackUrl, showNotice);
      }, 250);

      await loadInvoices();
      return;
    }

    /*
      WhatsApp Web bridge selected and message sent server-side.
    */
    if (
      data?.delivery?.sent === true &&
      data?.delivery?.provider === "whatsappWeb"
    ) {
      showNotice("success", "Invoice sent through the connected WhatsApp session.");
      await loadInvoices();
      return;
    }

    /*
      Twilio selected and message queued/sent server-side.
    */
    if (
      data?.delivery?.provider === "twilio" &&
      ["queued", "sent", "accepted"].includes(
        String(data?.delivery?.status || "")
      )
    ) {
      showNotice("success", "Invoice message queued through Twilio WhatsApp.");
      await loadInvoices();
      return;
    }

    if (data?.delivery?.queued) {
      showNotice("info", "Invoice message queued for WhatsApp delivery.");
      await loadInvoices();
      return;
    }

    showNotice(
      "error",
      "WhatsApp message could not be sent or opened. Check your WhatsApp settings and try again."
    );
  } catch (error) {
    showNotice(
      "error",
      error.message || "Unable to reach the WhatsApp service. Please try again."
    );
  }
};

  const sendBulkReminders = async () => {
    if (actionableInvoices.length === 0) {
      showNotice("info", "There are no unpaid invoices to remind.");
      return;
    }

    setSendingReminders(true);

    try {
      const res = await authFetch("/api/notifications/whatsapp/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: window.location.origin,
          force: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to send reminders");
      }

      if (Array.isArray(data.fallbackDeliveries)) {
        data.fallbackDeliveries.forEach((delivery) => {
          if (delivery.fallbackUrl) {
            openExternalTab(delivery.fallbackUrl, showNotice);
          }
        });
      }

      showNotice(
        "success",
        `Reminders processed: ${data.processedCount || 0}. Sent: ${
          data.sentCount || 0
        }. Opened manually: ${data.fallbackCount || 0}. Skipped: ${
          data.skippedCount || 0
        }.`
      );

      await loadInvoices();
    } catch (error) {
      showNotice("error", error.message || "Unable to send reminders");
    } finally {
      setSendingReminders(false);
    }
  };

  const updateRecurringForm = (field, value) => {
    setRecurringForm((current) => ({
      ...current,
      value,
    }));
  };

  const createRecurringInvoice = async (event) => {
    event.preventDefault();
    setSavingRecurring(true);

    try {
      if (
        recurringForm.endDate &&
        recurringForm.startDate &&
        recurringForm.endDate < recurringForm.startDate
      ) {
        throw new Error("End date cannot be earlier than the start date");
      }

      const res = await authFetch("/api/recurring-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recurringForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to create recurring invoice");
      }

      setRecurringForm({
        customerName: "",
        phone: "",
        email: "",
        description: "",
        amount: "",
        frequency: "monthly",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
      });

      setShowRecurringForm(false);
      showNotice("success", "Recurring invoice schedule created.");

      await Promise.all([loadInvoices(), loadRecurringInvoices()]);
    } catch (error) {
      showNotice("error", error.message || "Unable to create recurring invoice");
    } finally {
      setSavingRecurring(false);
    }
  };

  const runDueRecurringInvoices = async () => {
    setRunningRecurring(true);

    try {
      const res = await authFetch("/api/recurring-invoices/run", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to run recurring invoices");
      }

      showNotice(
        "success",
        `Recurring invoices processed: ${data.processedCount || 0}. Generated: ${
          data.generatedCount || 0
        }. Skipped: ${data.skippedCount || 0}.`
      );

      await Promise.all([loadInvoices(), loadRecurringInvoices()]);
    } catch (error) {
      showNotice("error", error.message || "Unable to run recurring invoices");
    } finally {
      setRunningRecurring(false);
    }
  };

  const toggleRecurringInvoice = async (schedule) => {
    try {
      const res = await authFetch("/api/recurring-invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: schedule._id,
          active: schedule.active === false,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to update recurring invoice");
      }

      await loadRecurringInvoices();
    } catch (error) {
      showNotice("error", error.message || "Unable to update recurring invoice");
    }
  };

  const deleteRecurringInvoice = async (schedule) => {
    const confirmed = await confirm({
      title: "Delete recurring schedule",
      message: "Delete this recurring invoice schedule? This action cannot be undone.",
      confirmLabel: "Delete",
    });

    if (!confirmed) return;

    try {
      const res = await authFetch(`/api/recurring-invoices/${schedule._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to delete recurring invoice");
      }

      showNotice("success", "Recurring schedule deleted.");
      await loadRecurringInvoices();
    } catch (error) {
      showNotice("error", error.message || "Unable to delete recurring invoice");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Invoices"
        description={`Create invoices, monitor balances, and manage ${customerLabels.singular} follow-up in one workspace.`}
        actions={
          activePage === "invoices" ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateInvoice(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <FiPlus className="h-4 w-4" />
                Create invoice
              </button>

              <button
                type="button"
                onClick={sendBulkReminders}
                disabled={sendingReminders || actionableInvoices.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20BA5C] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <FiMessageCircle className="h-4 w-4" />
                {sendingReminders ? "Sending..." : "Remind unpaid"}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRecurringForm(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <FiPlus className="h-4 w-4" />
                New schedule
              </button>

              <button
                type="button"
                onClick={runDueRecurringInvoices}
                disabled={runningRecurring}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiRefreshCw className={`h-4 w-4 ${runningRecurring ? "animate-spin" : ""}`} />
                {runningRecurring ? "Running..." : "Run due"}
              </button>
            </div>
          )
        }
      />

      <NoticeBanner notice={notice} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActivePage("invoices")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activePage === "invoices"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <FiCreditCard className="h-4 w-4" />
          Invoices
        </button>

        <button
          type="button"
          onClick={() => setActivePage("recurring")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activePage === "recurring"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <FiRepeat className="h-4 w-4" />
          Recurring invoices
        </button>
      </div>

      {activePage === "invoices" ? (
        <CompactInvoiceSummary
          actionableCount={actionableInvoices.length}
          totalInvoiceAmount={totalInvoiceAmount}
          balancePendingAmount={balancePendingAmount}
          collectionRate={collectionRate}
          overdueCount={overdueCount}
          preparedNotificationCount={preparedNotificationCount}
          unpaidCount={unpaidCount}
        />
      ) : (
        <StatGrid>
          <>
            <StatCard label="Total schedules" value={recurringInvoices.length} tone="slate" />
            <StatCard label="Scheduled amount" value={formatCurrency(recurringTotalAmount)} tone="blue" />
            <StatCard label="Active" value={activeRecurringCount} tone="emerald" />
            <StatCard label="Due now" value={dueRecurringCount} tone="orange" />
          </>
        </StatGrid>
      )}

      {activePage === "invoices" ? (
        <>
          <InvoiceFilterPanel
            invoiceFilterForm={invoiceFilterForm}
            updateInvoiceFilterForm={updateInvoiceFilterForm}
            applyInvoiceFilters={applyInvoiceFilters}
            resetInvoiceFilters={resetInvoiceFilters}
            invoiceCategoryOptions={invoiceCategoryOptions}
            invoiceProviderOptions={invoiceProviderOptions}
            invoiceStatusOptions={invoiceStatusOptions}
            notificationStatusOptions={notificationStatusOptions}
            customerLabels={customerLabels}
          />

          <InvoiceList
            invoices={filteredInvoices}
            allInvoicesCount={invoices.length}
            customerLabels={customerLabels}
            onRecordPayment={openManualPaymentModal}
            onShareWhatsApp={shareWhatsApp}
            onDeleteInvoice={deleteInvoice}
          />
        </>
      ) : (
        <>
          <RecurringHeader
            recurringSearch={recurringSearch}
            setRecurringSearch={setRecurringSearch}
            setShowRecurringForm={setShowRecurringForm}
            runDueRecurringInvoices={runDueRecurringInvoices}
            runningRecurring={runningRecurring}
          />

          <RecurringList
            recurringLoading={recurringLoading}
            recurringInvoices={recurringInvoices}
            filteredRecurringInvoices={filteredRecurringInvoices}
            customerLabels={customerLabels}
            toggleRecurringInvoice={toggleRecurringInvoice}
            deleteRecurringInvoice={deleteRecurringInvoice}
          />
        </>
      )}

      {showRecurringForm ? (
        <RecurringInvoiceModal
          recurringForm={recurringForm}
          customerLabels={customerLabels}
          savingRecurring={savingRecurring}
          updateRecurringForm={updateRecurringForm}
          onClose={() => setShowRecurringForm(false)}
          onSubmit={createRecurringInvoice}
        />
      ) : null}

      <CreateInvoiceModal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        onInvoiceAdded={loadInvoices}
      />

      {manualPaymentModal.open && manualPaymentModal.invoice ? (
        <ManualPaymentModal
          invoice={manualPaymentModal.invoice}
          amount={manualPaymentModal.amount}
          saving={savingManualPayment}
          onAmountChange={(value) =>
            setManualPaymentModal((current) => ({
              ...current,
              amount: value,
            }))
          }
          onClose={closeManualPaymentModal}
          onConfirm={() =>
            markPaid(manualPaymentModal.invoice, manualPaymentModal.amount)
          }
        />
      ) : null}
    </PageShell>
  );
}

function InvoiceFilterPanel({
  invoiceFilterForm,
  updateInvoiceFilterForm,
  applyInvoiceFilters,
  resetInvoiceFilters,
  invoiceCategoryOptions,
  invoiceProviderOptions,
  invoiceStatusOptions,
  notificationStatusOptions,
  customerLabels,
}) {
  return (
    <SurfaceCard className="overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Invoice history
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Filter, review, share, and record payments across every invoice.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyInvoiceFilters}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <FiFilter className="h-4 w-4" />
              Apply filters
            </button>

            <button
              type="button"
              onClick={resetInvoiceFilters}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiX className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-7">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <InputField
            type="search"
            value={invoiceFilterForm.search}
            onChange={(event) =>
              updateInvoiceFilterForm("search", event.target.value)
            }
            placeholder={`Search invoice, ${customerLabels.singular}, phone`}
            className="h-10 w-full px-3 pl-9"
          />
        </div>

        <SelectField
          value={invoiceFilterForm.category}
          onChange={(event) =>
            updateInvoiceFilterForm("category", event.target.value)
          }
          className="h-10 px-3"
        >
          <option value="all">All categories</option>
          {invoiceCategoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={invoiceFilterForm.provider}
          onChange={(event) =>
            updateInvoiceFilterForm("provider", event.target.value)
          }
          className="h-10 px-3"
        >
          <option value="all">All gateways</option>
          {invoiceProviderOptions.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={invoiceFilterForm.status}
          onChange={(event) =>
            updateInvoiceFilterForm("status", event.target.value)
          }
          className="h-10 px-3"
        >
          <option value="all">All statuses</option>
          {invoiceStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={invoiceFilterForm.notification}
          onChange={(event) =>
            updateInvoiceFilterForm("notification", event.target.value)
          }
          className="h-10 px-3"
        >
          <option value="all">All notifications</option>
          {notificationStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectField>

        <InputField
          type="date"
          value={invoiceFilterForm.dateFrom}
          onChange={(event) =>
            updateInvoiceFilterForm("dateFrom", event.target.value)
          }
          className="h-10 px-3"
        />

        <InputField
          type="date"
          value={invoiceFilterForm.dateTo}
          onChange={(event) =>
            updateInvoiceFilterForm("dateTo", event.target.value)
          }
          className="h-10 px-3"
        />
      </div>
    </SurfaceCard>
  );
}

function InvoiceList({
  invoices,
  allInvoicesCount,
  customerLabels,
  onRecordPayment,
  onShareWhatsApp,
  onDeleteInvoice,
}) {
  if (!invoices.length) {
    return (
      <SurfaceCard className="p-6">
        <EmptyState
          title={allInvoicesCount === 0 ? "No invoices found" : "No matching invoices"}
          description={
            allInvoicesCount === 0
              ? "Create an invoice to start building your invoice history."
              : "Try another name, phone number, invoice number, description, or status."
          }
        />
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="divide-y divide-slate-200 lg:hidden dark:divide-slate-800">
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice._id}
            invoice={invoice}
            customerLabels={customerLabels}
            onRecordPayment={onRecordPayment}
            onShareWhatsApp={onShareWhatsApp}
            onDeleteInvoice={onDeleteInvoice}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
              <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice
              </th>
              <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {customerLabels.singularTitle}
              </th>
              <th className="w-[24%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Details
              </th>
              <th className="w-[15%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
              <th className="w-[13%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="w-[12%] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {invoices.map((invoice) => {
              const customerName = getInvoiceCustomerName(
                invoice,
                customerLabels.singularTitle
              );
              const invoiceCategory = getInvoiceCategory(invoice);
              const notificationStatus = normalizeNotificationStatus(
                invoice.customerNotificationStatus
              );
              const notificationTone = getNotificationTone(
                invoice.customerNotificationStatus
              );
              const dueStatus = getDueStatus(invoice);
              const invoicePaid = isInvoicePaid(invoice);

              return (
                <tr
                  key={invoice._id}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-950/50"
                >
                  <td className="px-4 py-4 align-top">
                    <p
                      className="truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-200"
                      title={invoice.invoiceNumber || "-"}
                    >
                      {invoice.invoiceNumber || "-"}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(invoice.date)}
                    </p>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p
                      className="truncate text-sm font-semibold text-slate-950 dark:text-white"
                      title={customerName}
                    >
                      {customerName}
                    </p>
                    <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {invoice.phone || "No phone number"}
                    </p>
                    {invoice.email ? (
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {invoice.email}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p
                      className="truncate text-sm font-medium text-slate-800 dark:text-slate-200"
                      title={invoice.description || invoice.category || invoice.class || "-"}
                    >
                      {invoice.description || invoice.category || invoice.class || "-"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge tone="slate">{invoiceCategory}</StatusBadge>
                      <StatusBadge tone={dueStatus.tone}>{dueStatus.label}</StatusBadge>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {formatCurrency(getOriginalInvoiceAmount(invoice))}
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Balance {formatCurrency(getOutstandingAmount(invoice))}
                    </p>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge tone={invoicePaid ? "green" : "orange"}>
                        {invoice.status || "Unpaid"}
                      </StatusBadge>
                      <StatusBadge tone={notificationTone}>
                        Message {notificationStatus}
                      </StatusBadge>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex justify-end gap-1.5">
                      {!invoicePaid ? (
                        <button
                          type="button"
                          onClick={() => onRecordPayment(invoice)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700"
                          title="Record payment"
                          aria-label="Record payment"
                        >
                          <FiCheckCircle className="h-4 w-4" />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onShareWhatsApp(invoice)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366] text-white transition hover:bg-[#20BA5C]"
                        title="Share on WhatsApp"
                        aria-label="Share on WhatsApp"
                      >
                        <FiMessageCircle className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(invoice._id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700"
                        title="Delete invoice"
                        aria-label="Delete invoice"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

function InvoiceCard({
  invoice,
  customerLabels,
  onRecordPayment,
  onShareWhatsApp,
  onDeleteInvoice,
}) {
  const customerName = getInvoiceCustomerName(
    invoice,
    customerLabels.singularTitle
  );
  const invoiceCategory = getInvoiceCategory(invoice);
  const notificationStatus = normalizeNotificationStatus(
    invoice.customerNotificationStatus
  );
  const dueStatus = getDueStatus(invoice);
  const invoicePaid = isInvoicePaid(invoice);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {customerName}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            {invoice.invoiceNumber || "-"}
          </p>
        </div>

        <StatusBadge tone={dueStatus.tone}>{dueStatus.label}</StatusBadge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Invoice details
          </p>
          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            {invoice.description || invoice.category || invoice.class || "-"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Phone: {invoice.phone || "-"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge tone="slate">{invoiceCategory}</StatusBadge>
            <StatusBadge tone={invoicePaid ? "green" : "orange"}>
              {invoice.status || "Unpaid"}
            </StatusBadge>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Amounts
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(getOriginalInvoiceAmount(invoice))}
          </p>
          <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
            Balance {formatCurrency(getOutstandingAmount(invoice))}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Message {notificationStatus}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!invoicePaid ? (
          <button
            type="button"
            onClick={() => onRecordPayment(invoice)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <FiCheckCircle className="h-4 w-4" />
            Record payment
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onShareWhatsApp(invoice)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20BA5C]"
        >
          <FiMessageCircle className="h-4 w-4" />
          Share on WhatsApp
        </button>

        <button
          type="button"
          onClick={() => onDeleteInvoice(invoice._id)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <FiTrash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

function RecurringHeader({
  recurringSearch,
  setRecurringSearch,
  setShowRecurringForm,
  runDueRecurringInvoices,
  runningRecurring,
}) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Recurring invoices
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create schedules that automatically generate invoices on due dates.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowRecurringForm(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <FiPlus className="h-4 w-4" />
            Create schedule
          </button>

          <button
            type="button"
            onClick={runDueRecurringInvoices}
            disabled={runningRecurring}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FiRefreshCw className={`h-4 w-4 ${runningRecurring ? "animate-spin" : ""}`} />
            {runningRecurring ? "Running..." : "Run due now"}
          </button>
        </div>
      </div>

      <div className="relative mt-4">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={recurringSearch}
          onChange={(event) => setRecurringSearch(event.target.value)}
          placeholder="Search recurring schedules"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 pl-10 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
        />
      </div>
    </SurfaceCard>
  );
}

function RecurringList({
  recurringLoading,
  recurringInvoices,
  filteredRecurringInvoices,
  customerLabels,
  toggleRecurringInvoice,
  deleteRecurringInvoice,
}) {
  if (recurringLoading) {
    return (
      <SurfaceCard className="flex min-h-[14rem] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
      </SurfaceCard>
    );
  }

  if (!filteredRecurringInvoices.length) {
    return (
      <SurfaceCard className="p-6">
        <EmptyState
          title={
            recurringInvoices.length === 0
              ? "No recurring invoices found"
              : "No matching recurring invoices"
          }
          description={
            recurringInvoices.length === 0
              ? "Create a recurring schedule to generate invoices automatically."
              : "Try another name, phone number, description, or status."
          }
        />
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="divide-y divide-slate-200 lg:hidden dark:divide-slate-800">
        {filteredRecurringInvoices.map((schedule) => (
          <div key={schedule._id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {schedule.customerName ||
                    schedule.customer ||
                    customerLabels.singularTitle}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Next: {formatDateTime(schedule.nextRunAt)}
                </p>
              </div>

              <StatusBadge tone={schedule.active === false ? "slate" : "green"}>
                {schedule.active === false ? "Paused" : "Active"}
              </StatusBadge>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {schedule.description || "-"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Phone: {schedule.phone || "-"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Frequency: {schedule.frequency || "monthly"}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(schedule.amount)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleRecurringInvoice(schedule)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {schedule.active === false ? "Resume" : "Pause"}
              </button>

              <button
                type="button"
                onClick={() => deleteRecurringInvoice(schedule)}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
              <th className="w-[24%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Schedule
              </th>
              <th className="w-[30%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Details
              </th>
              <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="w-[16%] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRecurringInvoices.map((schedule) => (
              <tr key={schedule._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                <td className="px-4 py-4 align-top">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {schedule.customerName ||
                      schedule.customer ||
                      customerLabels.singularTitle}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {schedule.frequency || "monthly"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Next: {formatDateTime(schedule.nextRunAt)}
                  </p>
                </td>

                <td className="px-4 py-4 align-top">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {schedule.description || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Phone: {schedule.phone || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Generated: {schedule.generatedCount || 0}
                  </p>
                </td>

                <td className="px-4 py-4 align-top">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(schedule.amount)}
                  </p>
                </td>

                <td className="px-4 py-4 align-top">
                  <StatusBadge tone={schedule.active === false ? "slate" : "green"}>
                    {schedule.active === false ? "Paused" : "Active"}
                  </StatusBadge>
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRecurringInvoice(schedule)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {schedule.active === false ? "Resume" : "Pause"}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteRecurringInvoice(schedule)}
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

function RecurringInvoiceModal({
  recurringForm,
  customerLabels,
  savingRecurring,
  updateRecurringForm,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Recurring invoices
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Create recurring invoice
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Define the {customerLabels.singular}, billing amount, and date window.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 p-6">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {customerLabels.singularTitle} and invoice details
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {customerLabels.singularTitle} name
                  </span>
                  <input
                    type="text"
                    value={recurringForm.customerName}
                    onChange={(event) =>
                      updateRecurringForm("customerName", event.target.value)
                    }
                    placeholder={`Enter ${customerLabels.singularTitle.toLowerCase()} name`}
                    required
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Phone number
                  </span>
                  <input
                    type="tel"
                    value={recurringForm.phone}
                    onChange={(event) =>
                      updateRecurringForm("phone", event.target.value)
                    }
                    placeholder="Enter phone number"
                    required
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Email
                  </span>
                  <input
                    type="email"
                    value={recurringForm.email}
                    onChange={(event) =>
                      updateRecurringForm("email", event.target.value)
                    }
                    placeholder="Email address"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Description
                  </span>
                  <input
                    type="text"
                    value={recurringForm.description}
                    onChange={(event) =>
                      updateRecurringForm("description", event.target.value)
                    }
                    placeholder="What will this recurring invoice cover?"
                    required
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Schedule preview
              </p>
              <p className="mt-4 text-4xl font-semibold">
                {formatCurrency(recurringForm.amount)}
              </p>

              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-4">
                  <span>Frequency</span>
                  <span className="font-medium capitalize text-white">
                    {recurringForm.frequency}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Starts</span>
                  <span className="font-medium text-white">
                    {formatDate(recurringForm.startDate)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Ends</span>
                  <span className="font-medium text-white">
                    {recurringForm.endDate
                      ? formatDate(recurringForm.endDate)
                      : "No end date"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Billing schedule
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Amount
                </span>
                <input
                  type="number"
                  min="1"
                  value={recurringForm.amount}
                  onChange={(event) =>
                    updateRecurringForm("amount", event.target.value)
                  }
                  placeholder="0.00"
                  required
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Frequency
                </span>
                <select
                  value={recurringForm.frequency}
                  onChange={(event) =>
                    updateRecurringForm("frequency", event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Start date
                </span>
                <input
                  type="date"
                  value={recurringForm.startDate}
                  onChange={(event) =>
                    updateRecurringForm("startDate", event.target.value)
                  }
                  required
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  End date
                </span>
                <input
                  type="date"
                  min={recurringForm.startDate || undefined}
                  value={recurringForm.endDate}
                  onChange={(event) =>
                    updateRecurringForm("endDate", event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              The first invoice will be generated on the start date. Leave the end date empty to keep the schedule running.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={savingRecurring}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingRecurring ? "Creating..." : "Create schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManualPaymentModal({
  invoice,
  amount,
  saving,
  onAmountChange,
  onClose,
  onConfirm,
}) {
  const { limit, label } = getManualPaymentLimit(invoice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Manual payment
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
              Record paid amount
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {label === "invoice amount" ? "Invoice amount" : "Outstanding balance"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(limit)}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {invoice.invoiceNumber || "Invoice"}
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Paid amount
            </span>
            <input
              type="number"
              min="1"
              max={limit}
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <span className="mt-2 block text-xs text-slate-400">
              Enter any amount up to {formatCurrency(limit)}.
            </span>
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {saving ? "Saving..." : "Save payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
