"use client";

import { useEffect, useState } from "react";
import CreateInvoiceModal from "../../../components/CreateInvoiceModal";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch("/api/invoices");
      const data = res.ok ? await res.json() : [];
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const markPaid = async (id) => {
    setInvoices(prev =>
      prev.map(inv =>
        inv._id === id ? { ...inv, status: "Paid" } : inv
      )
    );

    try {
      await fetch(`/api/invoices/${id}`, { method: "PUT" });
    } catch {
      loadData();
    }
  };

  const deleteInvoice = async (id) => {
    if (!confirm("Delete this invoice?")) return;

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Delete failed");
        return;
      }

      loadData();
    } catch {
      alert("Error deleting invoice");
    }
  };

  const shareWhatsApp = (inv) => {
    const phone = inv.phone?.startsWith("0")
      ? inv.phone.slice(1)
      : inv.phone;

    if (!phone) return alert("No phone number");

    const message = `Hello ${inv.student || inv.customer},

Please make payment.

Amount: ₦${Number(inv.amount).toLocaleString()}

Pay here:
${window.location.origin}/pay/${inv.token}`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const totalAmount = invoices.reduce(
    (sum, inv) => sum + Number(inv.amount || 0),
    0
  );

  const unpaidCount = invoices.filter(
    inv => inv.status !== "Paid"
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6 space-y-8">

        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-semibold text-gray-900">
            Invoices
          </h1>
          <p className="text-gray-600 mt-2">
            Manage all customer invoices and payments
          </p>
        </div>

        {/* CREATE BUTTON */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-medium text-lg shadow-sm transition-all"
          >
            + Create Invoice
          </button>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Total Invoices</p>
            <p className="text-5xl font-semibold text-gray-900 mt-3">
              {invoices.length}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Total Amount</p>
            <p className="text-5xl font-semibold text-gray-900 mt-3">
              ₦{totalAmount.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Unpaid</p>
            <p className="text-5xl font-semibold text-orange-600 mt-3">
              {unpaidCount}
            </p>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-3xl shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Customer</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Amount</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Phone</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Token</th>
                  <th className="px-8 py-5 text-left text-sm font-medium text-gray-500">Date</th>
                  <th className="px-8 py-5 text-right text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-gray-50 transition-colors">

                    <td className="px-8 py-6 font-medium text-gray-900">
                      {inv.student || inv.customer}
                    </td>

                    <td className="px-8 py-6 font-semibold text-gray-900">
                      ₦{Number(inv.amount).toLocaleString()}
                    </td>

                    <td className="px-8 py-6">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                        inv.status === "Paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {inv.status || "Unpaid"}
                      </span>
                    </td>

                    <td className="px-8 py-6 text-gray-600">
                      {inv.phone || "—"}
                    </td>

                    <td className="px-8 py-6 text-xs font-mono text-gray-500">
                      {inv.token ? inv.token.substring(0, 12) + "..." : "—"}
                    </td>

                    <td className="px-8 py-6 text-sm text-gray-500">
                      {inv.date ? new Date(inv.date).toLocaleDateString() : "—"}
                    </td>

                    <td className="px-8 py-6 text-right space-x-3">
                      {inv.status !== "Paid" && (
                        <button
                          onClick={() => markPaid(inv._id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-2xl text-sm font-medium transition"
                        >
                          Mark as Paid
                        </button>
                      )}

                      <button
                        onClick={() => shareWhatsApp(inv)}
                        className="bg-[#25D366] hover:bg-[#20BA5C] text-white px-5 py-2.5 rounded-2xl text-sm font-medium transition"
                      >
                        📱 WhatsApp
                      </button>

                      <button
                        onClick={() => deleteInvoice(inv._id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl text-sm font-medium transition"
                      >
                        Delete
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

            {invoices.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                No invoices found
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onInvoiceAdded={loadData}
      />
    </div>
  );
}