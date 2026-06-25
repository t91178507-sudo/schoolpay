"use client";

import { useEffect, useState } from "react";
import AddCustomerModal from "../../../components/AddCustomerModal";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch customers", error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const grouped = customers.reduce((acc, customer) => {
    const cat = customer.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(customer);
    return acc;
  }, {});

  const totalCustomers = customers.length;
  const categoryList = Object.keys(grouped).sort();

  const selectedCustomers = selectedCategory ? grouped[selectedCategory] || [] : [];

  const handleCustomerAdded = () => {
    fetchCustomers();
  };

  const deleteCustomer = async (id) => {
    if (!confirm("Delete this customer?")) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) fetchCustomers();
    } catch (error) {
      alert("Failed to delete customer");
    }
  };

  // ✅ Converts a local Nigerian number (e.g. 08012345678) into the
  // international format WhatsApp's wa.me links require (2348012345678),
  // WITHOUT changing how the number is stored or displayed anywhere else.
  const toWhatsAppNumber = (rawPhone) => {
    if (!rawPhone) return "";

    // Strip everything except digits (handles spaces, dashes, +, etc.)
    let digits = rawPhone.replace(/\D/g, "");

    if (digits.startsWith("234")) {
      // Already has the country code
      return digits;
    }

    if (digits.startsWith("0")) {
      // Local format e.g. 08012345678 -> 2348012345678
      return "234" + digits.slice(1);
    }

    // Fallback: assume it's a 10-digit local number missing the leading 0
    return "234" + digits;
  };

  const generateInvoice = async (customer) => {
    try {
      const phone =
        customer.phone ||
        customer.customerPhone ||
        customer.parentPhone ||
        "";

      if (!phone) {
        alert("No phone number");
        return;
      }

      const whatsappPhone = toWhatsAppNumber(phone);

      const amount = Number(customer.amount || 0);

      const token =
        customer.token ||
        "inv_" + Math.random().toString(36).substring(2, 10);

      // ✅ SAVE INVOICE
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student: customer.name,
          class: customer.category,
          amount,
          status: "Unpaid",
          token,
          phone,
          date: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Invoice failed");

      const paymentLink = `${window.location.origin}/pay/${token}`;

      const now = new Date();
      const formattedDate =
        now.toLocaleDateString() +
        " " +
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const message = `Hello ${customer.name},

Please make payment for ${customer.category}

Amount: ₦${amount.toLocaleString()}
Date: ${formattedDate}

Payment Link:
${paymentLink}`;

      window.open(
        `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
        "_blank"
      );

    } catch (error) {
      console.error(error);
      alert("Failed to generate invoice");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">Manage all customers and payments</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-4xl font-semibold text-gray-900">{totalCustomers}</p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-medium flex items-center gap-2 transition"
            >
              + Add New Customer
            </button>
          </div>
        </div>

        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to All Categories
          </button>
        )}

        {!selectedCategory ? (
          /* CATEGORY GRID */
          <div>
            <h2 className="text-xl font-medium text-gray-700 mb-6">
              All Categories ({categoryList.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {categoryList.map((cat) => {
                const count = grouped[cat].length;
                return (
                  <div
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="bg-white border border-gray-100 rounded-3xl p-8 hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-md group-hover:scale-110 transition-transform">
                        👤
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold text-gray-900">{cat}</h3>
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm text-gray-500">Customers</p>
                        <p className="text-5xl font-bold text-gray-900 mt-1">{count}</p>
                      </div>
                      <div className="text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                        View Customers →
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* SELECTED CATEGORY WITH AMOUNT COLUMN */
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-10 py-8 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl">
                  👥
                </div>
                <div>
                  <h2 className="text-4xl font-semibold">{selectedCategory}</h2>
                  <p className="text-blue-100 mt-1 text-lg">
                    {selectedCustomers.length} Customers
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Customer Name</th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Phone Number</th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Email</th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Amount</th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Token</th>
                    <th className="px-10 py-5 text-right text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-10 py-6 font-medium text-gray-900">{customer.name}</td>
                      <td className="px-10 py-6 text-gray-600">{customer.phone || "—"}</td>
                      <td className="px-10 py-6 text-gray-600">{customer.email || "—"}</td>
                      <td className="px-10 py-6 font-semibold text-gray-900">
                        ₦{(customer.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-10 py-6">
                        <span className="font-mono text-xs bg-gray-100 px-3 py-1 rounded-full">
                          {customer.token ? customer.token.substring(0, 15) + "..." : "—"}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right space-x-4">
                        <button
                          onClick={() => generateInvoice(customer)}
                          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                          Generate Invoice
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer._id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AddCustomerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCustomerAdded={handleCustomerAdded}
        defaultCategory={selectedCategory || ""}
      />
    </div>
  );
}