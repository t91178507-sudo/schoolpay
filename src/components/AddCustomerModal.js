"use client";

import { useState, useEffect } from "react";
import { authFetch } from "../lib/authFetch";

export default function AddCustomerModal({ 
  isOpen, 
  onClose, 
  onCustomerAdded,
  defaultCategory = "" 
}) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    category: defaultCategory,
    location: "",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ ...prev, category: defaultCategory }));
    }
  }, [isOpen, defaultCategory]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.category) {
      alert("Please fill all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const token = "inv_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

      const businessName =
        typeof window !== "undefined"
          ? localStorage.getItem("businessName") || ""
          : "";

      const customerData = {
        ...formData,
        businessName,
        token,
        paymentLink: `/pay/${token}`,
        createdAt: new Date().toISOString(),
      };

      const res = await authFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerData),
      });

      if (!res.ok) throw new Error("Failed to create customer");

      const newCustomer = await res.json();

      onCustomerAdded?.(newCustomer);
      onClose();

      alert(`✅ Customer added under ${formData.category}!`);

      setFormData({
        name: "",
        phone: "",
        email: "",
        category: defaultCategory,
        location: "",
      });
    } catch (error) {
      console.error(error);
      alert("Failed to add customer");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-8 py-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-900">Add New Customer</h2>
          <p className="text-gray-500 mt-1">
            {defaultCategory ? `Adding to category: ${defaultCategory}` : "Enter the customer's details"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="08012345678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="customer@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. School, Hospital, Estate, or your own category"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location / Address (Optional)</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Lagos, Nigeria" />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 text-gray-700 font-medium border border-gray-300 rounded-2xl hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-2xl transition">
              {submitting ? "Creating..." : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}