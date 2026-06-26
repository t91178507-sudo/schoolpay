"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../../../lib/authFetch";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await authFetch("/api/invoices");
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
      await authFetch(`/api/invoices/${id}`, { method: "PUT" });
    } catch {
      loadData();
    }
  };

  const deleteInvoice = async (id) => {
    if (!confirm("Delete this invoice?")) return;

    try {
      const res = await authFetch(`/api/invoices/${id}`, {
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

  // ✅ Converts a local Nigerian number (e.g. 08012345678) into the
  // international format WhatsApp's wa.me links require (2348012345678),
  // WITHOUT changing how the number is stored or displayed anywhere else.
  // Same helper used on the Customers page, kept consistent here.
  const toWhatsAppNumber = (rawPhone) => {
    if (!rawPhone) return "";

    let digits = rawPhone.replace(/\D/g, "");

    if (digits.startsWith("234")) {
      return digits;
    }

    if (digits.startsWith("0")) {
      return "234" + digits.slice(1);
    }

    return "234" + digits;
  };

  const shareWhatsApp = (inv) => {
    if (!inv.phone) return alert("No phone number");

    const whatsappPhone = toWhatsAppNumber(inv.phone);

    const invoiceDate = inv.date ? new Date(inv.date) : new Date();
    const formattedDate =
      invoiceDate.toLocaleDateString() +
      " " +
      invoiceDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // ✅ Same message format used when an invoice is first generated
    // from the Customers page, kept identical here for consistency.
    const message = `Hello ${inv.student || inv.customer},

Please make payment for ${inv.class || inv.category || "your invoice"}

Amount: ₦${Number(inv.amount).toLocaleString()}
Date: ${formattedDate}

Payment Link:
${window.location.origin}/pay/${inv.token}`;

    window.open(
      `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
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
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
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
                      {inv.date
                        ? new Date(inv.date).toLocaleDateString() +
                          " " +
                          new Date(inv.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>

                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status !== "Paid" && (
                          <button
                            onClick={() => markPaid(inv._id)}
                            title="Mark as Paid"
                            className="bg-green-600 hover:bg-green-700 text-white w-9 h-9 rounded-xl text-sm font-medium transition flex items-center justify-center"
                          >
                            ✓
                          </button>
                        )}

                        <button
                          onClick={() => shareWhatsApp(inv)}
                          title="Share on WhatsApp"
                          className="bg-[#25D366] hover:bg-[#20BA5C] text-white w-9 h-9 rounded-xl text-sm font-medium transition flex items-center justify-center"
                        >
                          📱
                        </button>

                        <button
                          onClick={() => deleteInvoice(inv._id)}
                          title="Delete"
                          className="bg-red-600 hover:bg-red-700 text-white w-9 h-9 rounded-xl text-sm font-medium transition flex items-center justify-center"
                        >
                          🗑
                        </button>
                      </div>
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
    </div>
  );
}