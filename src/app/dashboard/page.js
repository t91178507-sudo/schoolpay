"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/authFetch";
import { useBusinessSession } from "../../lib/clientSession";

export default function Dashboard() {
  const session = useBusinessSession();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [customersRes, invoicesRes] = await Promise.all([
          authFetch("/api/customers"),
          authFetch("/api/invoices"),
        ]);

        const customers = customersRes.ok ? await customersRes.json() : [];
        const invoices = invoicesRes.ok ? await invoicesRes.json() : [];

        const totalRevenue = invoices.reduce(
          (sum, inv) => sum + Number(inv.amount || 0),
          0
        );

        const paid = invoices.filter((inv) => inv.status === "Paid").length;
        const unpaid = invoices.length - paid;

        setStats({
          totalCustomers: customers.length,
          totalRevenue,
          paidInvoices: paid,
          unpaidInvoices: unpaid,
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate = currentTime?.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }) || "";

  const formattedTime = currentTime?.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }) || "";

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
      <div>
        <h1 className="text-4xl font-semibold text-gray-900">
          Welcome, {session.businessName || "Your Business"}
        </h1>
        <p className="text-gray-600 mt-2 min-h-[1.75rem]">
          {currentTime ? `${formattedDate} • ${formattedTime}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            href="/dashboard/categories"
            className="text-blue-600 text-sm font-medium mt-6 inline-block hover:underline"
          >
            View all customers →
          </Link>
        </div>

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

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm">Paid Invoices</p>
              <p className="text-4xl font-semibold text-green-600 mt-3">
                {stats.paidInvoices}
              </p>
            </div>
            <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center text-3xl">
              ✓
            </div>
          </div>
        </div>

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
