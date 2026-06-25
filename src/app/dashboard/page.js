"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
  });

  const [businessName, setBusinessName] = useState("");
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ NEW: DATE + TIME STATE
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const name = localStorage.getItem("businessName");
    if (name) setBusinessName(name);

    const fetchDashboardData = async () => {
      try {
        const [customersRes, invoicesRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/invoices"),
        ]);

        const customers = customersRes.ok ? await customersRes.json() : [];
        const invoices = invoicesRes.ok ? await invoicesRes.json() : [];

        const totalRevenue = invoices.reduce(
          (sum, inv) => sum + Number(inv.amount || 0),
          0
        );

        const paid = invoices.filter(inv => inv.status === "Paid").length;
        const unpaid = invoices.length - paid;

        setStats({
          totalCustomers: customers.length,
          totalRevenue,
          paidInvoices: paid,
          unpaidInvoices: unpaid,
        });

        const sortedInvoices = [...invoices].sort(
          (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
        );

        setRecentInvoices(sortedInvoices.slice(0, 5));

      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // ✅ NEW: LIVE CLOCK
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // updates every second

    return () => clearInterval(interval);
  }, []);

  // ✅ FORMAT DATE & TIME
  const formattedDate = currentTime.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-blue-600 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
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
    <div className="space-y-8">

      {/* ✅ HEADER */}
      <div>
        <h1 className="text-4xl font-semibold text-gray-900">
          Welcome, {businessName || "Your Business"}
        </h1>

        {/* ✅ NEW DATE + TIME DISPLAY */}
        <p className="text-gray-600 mt-2">
          {formattedDate} • {formattedTime}
        </p>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* TOTAL CUSTOMERS */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-gray-500 text-sm">Total Customers</p>
              <p className="text-4xl font-semibold text-gray-900 mt-3">
                {stats.totalCustomers}
              </p>
            </div>

            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl">
                👥
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/students"
            className="text-blue-600 text-sm font-medium mt-6 inline-block hover:underline"
          >
            View all customers →
          </Link>
        </div>

        {/* TOTAL REVENUE */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <p className="text-4xl font-semibold text-gray-900 mt-3 truncate">
                ₦{stats.totalRevenue.toLocaleString()}
              </p>
            </div>

            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl">
                💰
              </div>
            </div>
          </div>
        </div>

        {/* PAID */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm">Paid Invoices</p>
              <p className="text-4xl font-semibold text-green-600 mt-3">
                {stats.paidInvoices}
              </p>
            </div>
            <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center text-3xl">
              ✅
            </div>
          </div>
        </div>

        {/* UNPAID */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm">Pending Payments</p>
              <p className="text-4xl font-semibold text-orange-600 mt-3">
                {stats.unpaidInvoices}
              </p>
            </div>
            <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-3xl">
              ⏳
            </div>
          </div>

          <Link
            href="/dashboard/invoices"
            className="text-orange-600 text-sm font-medium mt-6 inline-block hover:underline"
          >
            Manage invoices →
          </Link>
        </div>

      </div>
    </div>
  );
}