"use client";

import { useEffect, useState } from "react";

export default function CustomersOverview() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [historyCustomer, setHistoryCustomer] = useState(null);

  const loadData = async () => {
    try {
      const [customersRes, invoicesRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/invoices"),
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

  useEffect(() => {
    loadData();
  }, []);

  // ✅ Build one summary row per unique customer, aggregating all
  // invoices that match by name (invoice.student === customer.name)
  const customerRows = customers.map((customer) => {
    const customerInvoices = invoices.filter(
      (inv) => (inv.student || inv.customer) === customer.name
    );

    const totalAmount = customerInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    const amountPaid = customerInvoices
      .filter((inv) => inv.status === "Paid")
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const amountPending = totalAmount - amountPaid;

    return {
      ...customer,
      invoiceCount: customerInvoices.length,
      totalAmount,
      amountPaid,
      amountPending,
      invoices: customerInvoices,
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-2xl"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6 space-y-8">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">
            All customers and their payment summary
          </p>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Customer</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Phone</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Token</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Total Amount</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Paid</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Pending</th>
                  <th className="px-8 py-5 text-right text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {customerRows.map((customer) => (
                  <tr key={customer._id} className="hover:bg-gray-50 transition-colors">

                    <td className="px-8 py-6">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-xs text-gray-400">{customer.category || "—"}</p>
                    </td>

                    <td className="px-8 py-6 text-gray-600">
                      {customer.phone || "—"}
                    </td>

                    <td className="px-8 py-6">
                      <span className="font-mono text-xs bg-gray-100 px-3 py-1 rounded-full">
                        {customer.token ? customer.token.substring(0, 12) + "..." : "—"}
                      </span>
                    </td>

                    <td className="px-8 py-6 font-semibold text-gray-900">
                      ₦{customer.totalAmount.toLocaleString()}
                    </td>

                    <td className="px-8 py-6 font-medium text-green-600">
                      ₦{customer.amountPaid.toLocaleString()}
                    </td>

                    <td className="px-8 py-6 font-medium text-orange-600">
                      ₦{customer.amountPending.toLocaleString()}
                    </td>

                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => setHistoryCustomer(customer)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View Payment History
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

            {customerRows.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                No customers found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PAYMENT HISTORY MODAL */}
      {historyCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">

            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {historyCustomer.name}
                </h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Payment history · {historyCustomer.invoiceCount} invoice
                  {historyCustomer.invoiceCount !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-8 space-y-4">
              {historyCustomer.invoices.length === 0 ? (
                <p className="text-center text-gray-500 py-10">
                  No invoices yet for this customer
                </p>
              ) : (
                historyCustomer.invoices
                  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                  .map((inv) => (
                    <div
                      key={inv._id}
                      className="flex items-center justify-between border border-gray-100 rounded-2xl px-6 py-4"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          ₦{Number(inv.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {inv.date
                            ? new Date(inv.date).toLocaleDateString() +
                              " " +
                              new Date(inv.date).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>
                      <span
                        className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                          inv.status === "Paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {inv.status || "Unpaid"}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}