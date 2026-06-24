"use client";

import { useState, useEffect } from "react";

const defaultClasses = [
  "Nursery 1", "Nursery 2", "Kindergarten",
  "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
  "JSS 1", "JSS 2", "JSS 3",
  "SSS 1", "SSS 2", "SSS 3"
];

export default function AddStudentModal({ isOpen, onClose, onStudentAdded }) {
  const [formData, setFormData] = useState({
    name: "",
    class: "",
    parent: "",
    parentPhone: "",
    parentEmail: "",
    location: "",
  });

  const [fees, setFees] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/settings/fees")
        .then(res => res.ok ? res.json() : {})
        .then(data => setFees(data))
        .catch(() => setFees({}));
    }
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.class || !formData.parent) {
      alert("Please fill all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const token = "sp_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

      const studentData = {
        ...formData,
        token,
        paymentLink: `/pay/${token}`
      };

      const studentRes = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentData),
      });

      if (!studentRes.ok) throw new Error("Failed to create student");

      const newStudent = await studentRes.json();

      // Auto-create invoice
      const feeAmount = fees[formData.class];
      if (feeAmount) {
        await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student: formData.name,
            class: formData.class,
            amount: feeAmount,
            status: "Unpaid",
            token: token,
            date: new Date().toISOString(),
          }),
        });
      }

      onStudentAdded?.(newStudent);
      onClose();

      alert(`✅ Student created!\nPayment Link: ${window.location.origin}/pay/${token}`);

      // Reset form
      setFormData({
        name: "",
        class: "",
        parent: "",
        parentPhone: "",
        parentEmail: "",
        location: "",
      });
    } catch (error) {
      console.error(error);
      alert("Failed to create student");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const availableClasses = Object.keys(fees).length > 0 ? Object.keys(fees) : defaultClasses;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-8 py-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-900">Add New Student</h2>
          <p className="text-gray-500 mt-1">A unique payment link will be generated</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
            <select
              name="class"
              value={formData.class}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select Class</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls} {fees[cls] ? `— ₦${fees[cls].toLocaleString()}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Parent / Guardian</label>
            <input
              type="text"
              name="parent"
              value={formData.parent}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mr. James Doe"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Phone Number</label>
              <input
                type="tel"
                name="parentPhone"
                value={formData.parentPhone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="08012345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Email</label>
              <input
                type="email"
                name="parentEmail"
                value={formData.parentEmail}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="parent@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location / Address</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Lagos, Nigeria"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 text-gray-700 font-medium border border-gray-300 rounded-2xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-2xl transition"
            >
              {submitting ? "Creating Student..." : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}