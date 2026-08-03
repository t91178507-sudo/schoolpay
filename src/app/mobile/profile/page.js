"use client";

import { useEffect, useState } from "react";
import { FiBriefcase, FiShield, FiUser } from "react-icons/fi";
import { authFetch } from "../../../lib/authFetch";

export default function MobileProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch("/api/mobile/profile");
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Unable to load profile");
        }

        setProfile(data);
      } catch (loadError) {
        setError(loadError.message || "Unable to load profile");
      }
    };

    load();
  }, []);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-slate-400">Loading profile...</p>;
  }

  const enabledPermissions = Object.entries(profile.permissions || {}).filter(
    ([, value]) => value === true
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-blue-200">
            <FiUser className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Staff profile
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-white">
              {profile.staffName}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-400">
              {profile.role} / {profile.username}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FiBriefcase className="h-4 w-4 text-blue-200" />
          Assigned businesses
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(profile.assignedBusinesses || []).length ? (
            profile.assignedBusinesses.map((business) => (
              <span
                key={business._id}
                className="max-w-full truncate rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
              >
                {business.name}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-500">No assigned business.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FiShield className="h-4 w-4 text-blue-200" />
          Permissions
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {enabledPermissions.length ? (
            enabledPermissions.map(([permission]) => (
              <span
                key={permission}
                className="rounded-full bg-blue-950/60 px-3 py-1.5 text-xs font-medium text-blue-200"
              >
                {permission}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-500">No permissions assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}
