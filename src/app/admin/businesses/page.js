"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/businesses");
        const data = res.ok ? await res.json() : [];
        setBusinesses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Businesses</h1>
        <p className="text-slate-500 mt-1">
          {businesses.length} registered business{businesses.length !== 1 ? "es" : ""}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Business</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Owner</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Customers</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Invoices</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Total Value</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {businesses.map((biz) => (
                <tr key={biz._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {biz.businessName || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {biz.fullName}<br />
                    <span className="text-xs text-slate-400">{biz.email}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{biz.businessType || "—"}</td>
                  <td className="px-6 py-4 text-slate-600">{biz.customerCount}</td>
                  <td className="px-6 py-4 text-slate-600">{biz.invoiceCount}</td>
                  <td className="px-6 py-4 text-slate-900 font-medium">
                    ₦{biz.revenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {biz.createdAt
                      ? new Date(biz.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {businesses.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              No businesses registered yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}