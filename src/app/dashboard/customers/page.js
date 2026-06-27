"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatCard,
  StatGrid,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";

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

export default function CustomersOverview() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);

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
        setError("Failed to load customers");
      } finally {
        setLoading(false);
      }
    };

    const initialLoad = setTimeout(loadData, 0);
    return () => clearTimeout(initialLoad);
  }, []);

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

        const amountPaid = customerInvoices
          .filter((inv) => inv.status === "Paid")
          .reduce((sum, inv) => sum + Number(inv.paidAmount || inv.amount || 0), 0);

        return {
          ...customer,
          invoiceCount: customerInvoices.length,
          totalAmount,
          amountPaid,
          amountPending: totalAmount - amountPaid,
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
            className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-white"
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
        title="Customer overview"
        description="See each customer's invoice count, paid totals, and what is still outstanding."
      />

      <StatGrid className="xl:grid-cols-3">
        <StatCard label="Customers" value={customerRows.length} tone="blue" />
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

      <SurfaceCard className="p-6">
        {customerRows.length === 0 ? (
          <EmptyState
            title="No customers found"
            description="Add a customer first, then invoice activity will appear here."
          />
        ) : (
          <div className="space-y-4">
            {customerRows.map((customer) => (
              <div
                key={customer._id}
                className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:bg-slate-50/40"
              >
                <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr_1.25fr_auto] xl:items-start">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <p className="text-xl font-semibold text-slate-900">{customer.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{customer.phone || "-"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone="slate">{customer.category || "Uncategorized"}</StatusBadge>
                      <StatusBadge tone="blue">
                        {customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? "s" : ""}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Summary
                    </p>
                    <p className="text-sm text-slate-700">
                      {customer.invoiceCount === 0
                        ? "No invoice history yet"
                        : customer.invoiceCount === 1
                          ? "1 invoice on record"
                          : `${customer.invoiceCount} invoices on record`}
                    </p>
                    <p className="font-mono text-xs text-slate-400 break-all">
                      {customer.token ? `${customer.token.substring(0, 18)}...` : "-"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Balances
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone="green">
                        Paid {formatCurrency(customer.amountPaid)}
                      </StatusBadge>
                      <StatusBadge tone="orange">
                        Pending {formatCurrency(customer.amountPending)}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-slate-500">
                      Total: <span className="font-medium text-slate-700">{formatCurrency(customer.totalAmount)}</span>
                    </p>
                  </div>

                  <div className="xl:justify-self-end">
                    <button
                      onClick={() => setHistoryCustomer(customer)}
                      className="w-full whitespace-nowrap rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white xl:w-auto"
                    >
                      View payment history
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-8 py-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{historyCustomer.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {historyCustomer.invoiceCount} invoice
                  {historyCustomer.invoiceCount !== 1 ? "s" : ""} on record
                </p>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-8">
              {historyCustomer.invoices.length === 0 ? (
                <EmptyState
                  title="No invoices yet for this customer"
                  description="Their payment history will show here once invoices are generated."
                />
              ) : (
                historyCustomer.invoices.map((invoice) => (
                  <div
                    key={invoice._id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">
                        {invoice.description || invoice.category || "Invoice payment"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatCurrency(invoice.amount)} | {formatDateTime(invoice.date)}
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
