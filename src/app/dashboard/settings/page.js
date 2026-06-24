"use client";

import { useEffect, useState } from "react";

const commonClasses = [
  "Nursery 1", "Nursery 2", "Kindergarten",
  "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
  "JSS 1", "JSS 2", "JSS 3",
  "SSS 1", "SSS 2", "SSS 3"
];

export default function Settings() {
  const [fees, setFees] = useState({});
  const [selectedClass, setSelectedClass] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ LOAD FEES FROM DATABASE
  const loadFees = async () => {
    try {
      const res = await fetch("/api/settings/fees");
      const data = res.ok ? await res.json() : [];

      const map = {};
      data.forEach(f => {
        map[f.className] = f.amount;
      });

      setFees(map);
    } catch (error) {
      console.error("Failed to load fees", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFees();
  }, []);

  // ✅ SAVE FEE TO DATABASE
  const saveFee = async () => {
    if (!selectedClass || !newAmount) {
      alert("Please select a class and enter amount");
      return;
    }

    try {
      setSaving(true);

      await fetch("/api/settings/fees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          className: selectedClass,
          amount: Number(newAmount),
        }),
      });

      await loadFees(); // refresh from DB

      setSelectedClass("");
      setNewAmount("");

    } catch (error) {
      console.error("Failed to save fee", error);
    } finally {
      setSaving(false);
    }
  };

  // ✅ DELETE FEE FROM DATABASE
  const deleteFee = async (className) => {
    if (!confirm(`Delete fee for ${className}?`)) return;

    try {
      const res = await fetch("/api/settings/fees");
      const data = await res.json();

      const fee = data.find(f => f.className === className);

      if (fee) {
        await fetch(`/api/settings/fees/${fee._id}`, {
          method: "DELETE",
        });
      }

      await loadFees();

    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-4xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage school fees by class</p>
      </div>

      {/* ✅ ADD NEW FEE */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10">
        <h2 className="text-2xl font-semibold mb-8">Add New Class Fee</h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          <div className="md:col-span-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class Name
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl"
            >
              <option value="">Select Class</option>
              {commonClasses.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium mb-2">
              Annual Fee (₦)
            </label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="45000"
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl"
            />
          </div>

          <div className="md:col-span-3 flex items-end">
            <button
              onClick={saveFee}
              disabled={saving || !selectedClass || !newAmount}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl"
            >
              {saving ? "Saving..." : "Add Fee"}
            </button>
          </div>

        </div>
      </div>

      {/* ✅ LIST FEES */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100">

        <div className="px-10 py-8 border-b bg-gray-50">
          <h2 className="text-2xl font-semibold">Current Class Fees</h2>
        </div>

        {loading ? (
          <div className="py-20 text-center">Loading...</div>
        ) : Object.keys(fees).length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            No fees configured yet
          </div>
        ) : (
          <div>
            {Object.entries(fees).map(([cls, amount]) => (
              <div key={cls} className="px-10 py-6 flex justify-between">
                <span className="font-medium">{cls}</span>
                <div className="flex gap-6 items-center">
                  <span className="font-bold">₦{amount.toLocaleString()}</span>
                  <button
                    onClick={() => deleteFee(cls)}
                    className="text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
