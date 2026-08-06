"use client";

import { useEffect, useState } from "react";
import {
  AdminBadge,
  AdminHeader,
  AdminLoading,
  AdminMetric,
  AdminTable,
  AdminTd,
  AdminTh,
} from "../../../components/AdminUI";
import { adminFetch } from "../../../lib/adminFetch";

function formatTimestamp(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
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
    const initialLoad = setTimeout(loadUsers, 0);
    const interval = setInterval(loadUsers, 30000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, []);

  if (loading) return <AdminLoading />;

  const onlineCount = users.filter((user) => user.isOnline).length;

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Access monitoring"
        title="Users"
        description={`${users.length} registered user${users.length === 1 ? "" : "s"}. ${onlineCount} currently online.`}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetric label="Registered users" value={users.length} hint="Owner accounts" tone="blue" />
        <AdminMetric label="Online now" value={onlineCount} hint="Active in the current session window" tone="green" />
        <AdminMetric label="Offline" value={users.length - onlineCount} hint="No recent activity" />
      </div>

      <AdminTable minWidth="940px">
        <thead>
          <tr className="border-b border-slate-200">
            <AdminTh className="w-[12%]">Status</AdminTh>
            <AdminTh className="w-[20%]">Name</AdminTh>
            <AdminTh className="w-[25%]">Email</AdminTh>
            <AdminTh className="w-[19%]">Business</AdminTh>
            <AdminTh className="w-[12%]">Last Login</AdminTh>
            <AdminTh className="w-[12%]">Last Active</AdminTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <tr key={user._id} className="hover:bg-slate-50">
              <AdminTd>
                <AdminBadge tone={user.isOnline ? "green" : "slate"}>
                  <span
                    className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                      user.isOnline ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {user.isOnline ? "Online" : "Offline"}
                </AdminBadge>
              </AdminTd>
              <AdminTd className="font-medium text-slate-900">{user.fullName || "-"}</AdminTd>
              <AdminTd>{user.email || "-"}</AdminTd>
              <AdminTd>{user.businessName || "-"}</AdminTd>
              <AdminTd className="text-xs text-slate-500">{formatTimestamp(user.lastLogin)}</AdminTd>
              <AdminTd className="text-xs text-slate-500">{formatTimestamp(user.lastActive)}</AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          No users registered yet.
        </div>
      ) : null}
    </div>
  );
}
