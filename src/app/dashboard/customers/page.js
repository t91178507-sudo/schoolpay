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
  Toolbar,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";
import { getCustomerLabels } from "../../../lib/businessLabels";
import { useBusinessSession } from "../../../lib/clientSession";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getInvoicePaidAmount(invoice) {
  return Number(invoice.paidAmount || invoice.amountPaid || 0);
}

function getInvoiceBalance(invoice) {
  const amount = Number(invoice.amount || 0);
  const balanceDue = Number(invoice.balanceDue || 0);
  if (balanceDue > 0) return balanceDue;
  return Math.max(amount - getInvoicePaidAmount(invoice), 0);
}

export default function CustomersOverview() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [filterForm, setFilterForm] = useState({
    search: "",
    category: "all",
    balanceStatus: "all",
  });
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    balanceStatus: "all",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersRes, invoicesRes] = await Promise.all([
          authFetch("/api/customers"),
          authFetch("/api/invoices"),
        ]);

        const customersData = customersRes.ok ? await customersRes.json() : [];
        const invoicesData = invoicesRes.ok ? await invoicesRes.json() : [];

        setCustomers(Array.isArray(customersData) ? customersData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      } catch (err) {
        console.error(err);
        setError(`Failed to load ${customerLabels.plural}`);
      } finally {
        setLoading(false);
      }
    };

    const initialLoad = setTimeout(loadData, 0);
    return () => clearTimeout(initialLoad);
  }, [customerLabels.plural]);

  const customerRows = useMemo(() => {
    return customers
      .map((customer) => {
        const customerInvoices = invoices.filter(
          (inv) =>
            (customer.token && inv.customerToken === customer.token) ||
            (!customer.token &&
              (inv.customer || inv.customerName || inv.student) === customer.name)
        );

        const totalAmount = customerInvoices.reduce(
          (sum, inv) => sum + Number(inv.amount || 0),
          0
        );

        const amountPaid = customerInvoices.reduce(
          (sum, inv) => sum + getInvoicePaidAmount(inv),
          0
        );
        const amountPending = customerInvoices.reduce(
          (sum, inv) => sum + getInvoiceBalance(inv),
          0
        );

        return {
          ...customer,
          invoiceCount: customerInvoices.length,
          totalAmount,
          amountPaid,
          amountPending,
          invoices: customerInvoices.sort(
            (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
          ),
        };
      })
      .sort((a, b) => {
        if (b.amountPending !== a.amountPending) {
          return b.amountPending - a.amountPending;
        }

        return a.name.localeCompare(b.name);
      });
  }, [customers, invoices]);

  const totalReceivables = customerRows.reduce(
    (sum, customer) => sum + Number(customer.totalAmount || 0),
    0
  );
  const totalPending = customerRows.reduce(
    (sum, customer) => sum + Number(customer.amountPending || 0),
    0
  );
  const customerCategoryOptions = Array.from(
    new Set(customerRows.map((customer) => customer.category || "Uncategorized"))
  ).sort((a, b) => a.localeCompare(b));
  const filteredCustomerRows = customerRows.filter((customer) => {
    const normalizedQuery = filters.search.trim().toLowerCase();
    const customerCategory = customer.category || "Uncategorized";
    const balanceStatus =
      customer.amountPending > 0
        ? customer.amountPaid > 0
          ? "partial"
          : "pending"
        : "settled";

    const matchesCategory =
      filters.category === "all" || customerCategory === filters.category;
    const matchesBalanceStatus =
      filters.balanceStatus === "all" || balanceStatus === filters.balanceStatus;

    if (!normalizedQuery) {
      return matchesCategory && matchesBalanceStatus;
    }

    const matchesSearch = [
      customer.name,
      customer.phone,
      customer.email,
      customer.category,
      customer.token,
      customer.invoiceCount,
      customer.totalAmount,
      customer.amountPaid,
      customer.amountPending,
    ]
      .filter((value) => value !== undefined && value !== null)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));

    return matchesCategory && matchesBalanceStatus && matchesSearch;
  });

  const customersMatchingFilters = customerRows.filter((customer) => {
    const customerCategory = customer.category || "Uncategorized";
    const balanceStatus =
      customer.amountPending > 0
        ? customer.amountPaid > 0
          ? "partial"
          : "pending"
        : "settled";

    return (
      (filters.category === "all" || customerCategory === filters.category) &&
      (filters.balanceStatus === "all" || balanceStatus === filters.balanceStatus)
    );
  });

  const applyFilters = () => setFilters(filterForm);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-blue-600"></div>
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
    <PageShell>
      <PageHeader
        title={`${customerLabels.singularTitle} overview`}
        description={`See each ${customerLabels.singular}'s invoice count, paid totals, and what is still outstanding.`}
      />

      <Toolbar>
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            value={filterForm.category}
            onChange={(event) =>
              setFilterForm((current) => ({ ...current, category: event.target.value }))
            }
          >
            <option value="all">All categories</option>
            {customerCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>
          <SelectField
            value={filterForm.balanceStatus}
            onChange={(event) =>
              setFilterForm((current) => ({ ...current, balanceStatus: event.target.value }))
            }
          >
            <option value="all">All balances</option>
            <option value="pending">Pending only</option>
            <option value="partial">Partially paid</option>
            <option value="settled">Fully paid</option>
          </SelectField>
          <InputField
            type="search"
            value={filterForm.search}
            onChange={(event) =>
              setFilterForm((current) => ({ ...current, search: event.target.value }))
            }
            placeholder={`Search ${customerLabels.plural}`}
          />
        </div>
        <div className="w-full lg:w-[12rem]">
          <button
            type="button"
            onClick={applyFilters}
            className="w-full rounded-xl bg-[#4B93C8] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3D82B7]"
          >
            Filter
          </button>
        </div>
      </Toolbar>

      <StatGrid className="xl:!grid-cols-3">
        <StatCard label={customerLabels.pluralTitle} value={customersMatchingFilters.length} tone="blue" />
        <StatCard
          label="Total invoiced"
          value={formatCurrency(totalReceivables)}
          tone="slate"
        />
        <StatCard
          label="Still pending"
          value={formatCurrency(totalPending)}
          tone="orange"
        />
      </StatGrid>

      <SurfaceCard className="overflow-hidden">
        {filteredCustomerRows.length === 0 ? (
          <EmptyState
            title={
              customerRows.length === 0
                ? `No ${customerLabels.plural} found`
                : `No matching ${customerLabels.plural}`
            }
            description={
              customerRows.length === 0
                ? `Add a ${customerLabels.singular} first, then invoice activity will appear here.`
                : "Try another name, phone number, category, or balance."
            }
          />
        ) : (
          <>
            <div className="divide-y divide-slate-200 lg:hidden">
              {filteredCustomerRows.map((customer) => (
                <div key={customer._id} className="space-y-3 p-4">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {customer.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {customer.phone || "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone="slate">{customer.category || "Uncategorized"}</StatusBadge>
                    <StatusBadge tone="blue">
                      {customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? "s" : ""}
                    </StatusBadge>
                    <StatusBadge tone="green">Paid {formatCurrency(customer.amountPaid)}</StatusBadge>
                    <StatusBadge tone="orange">Pending {formatCurrency(customer.amountPending)}</StatusBadge>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Total:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(customer.totalAmount)}
                    </span>
                  </p>
                  <button
                    onClick={() => setHistoryCustomer(customer)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    View payment history
                  </button>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1100px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {customerLabels.singularTitle}
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Phone
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Invoices
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Paid
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Pending
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Total
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomerRows.map((customer) => (
                    <tr key={customer._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {customer.name}
                          </p>
                          <p className="font-mono text-xs text-slate-400">
                            {customer.token ? `${customer.token.substring(0, 18)}...` : "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                        {customer.phone || "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone="slate">{customer.category || "Uncategorized"}</StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-200">
                        {customer.invoiceCount}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-emerald-600">
                        {formatCurrency(customer.amountPaid)}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-orange-600">
                        {formatCurrency(customer.amountPending)}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-white">
                        {formatCurrency(customer.totalAmount)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setHistoryCustomer(customer)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          View history
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SurfaceCard>

      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-8 py-6 dark:border-slate-800">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{historyCustomer.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {historyCustomer.invoiceCount} invoice
                  {historyCustomer.invoiceCount !== 1 ? "s" : ""} on record
                </p>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-8">
              {historyCustomer.invoices.length === 0 ? (
                <EmptyState
                  title={`No invoices yet for this ${customerLabels.singular}`}
                  description="Their payment history will show here once invoices are generated."
                />
              ) : (
                historyCustomer.invoices.map((invoice) => (
                  <div
                    key={invoice._id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {invoice.description || invoice.category || "Invoice payment"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Amount {formatCurrency(invoice.amount)}
                        </span>
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          Paid {formatCurrency(getInvoicePaidAmount(invoice))}
                        </span>
                        <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                          Balance {formatCurrency(getInvoiceBalance(invoice))}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(invoice.paidAt || invoice.date)}
                      </p>
                    </div>
                    <StatusBadge tone={invoice.status === "Paid" ? "green" : "orange"}>
                      {invoice.status || "Unpaid"}
                    </StatusBadge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
