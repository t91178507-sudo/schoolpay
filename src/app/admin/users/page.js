"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

function formatTimestamp(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await adminFetch("/api/admin/users");
      const data = res.ok ? await res.json() : [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadUsers();
    }, 0);
    // Refresh every 30s so the Online/Offline status stays current
    const interval = setInterval(loadUsers, 30000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-400"></div>
      </div>
    );
  }

  const onlineCount = users.filter((u) => u.isOnline).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <p className="text-slate-500 mt-1">
          {users.length} registered user{users.length !== 1 ? "s" : ""} ·{" "}
          <span className="text-emerald-600 font-medium">{onlineCount} online</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Business</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Last Login</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                        user.isOnline
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.isOnline ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      {user.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {user.fullName || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{user.email}</td>
                  <td className="px-6 py-4 text-slate-600">{user.businessName || "—"}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {formatTimestamp(user.lastLogin)}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {formatTimestamp(user.lastActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              No users registered yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
