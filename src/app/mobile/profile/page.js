"use client";

import { useEffect, useState } from "react";
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
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Staff Name</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{profile.staffName}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {profile.role} • {profile.username}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm font-medium text-slate-300">Assigned Businesses</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(profile.assignedBusinesses || []).map((business) => (
            <span
              key={business._id}
              className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200"
            >
              {business.name}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm font-medium text-slate-300">Permissions</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {enabledPermissions.map(([permission]) => (
            <span
              key={permission}
              className="rounded-full bg-blue-950/60 px-3 py-1 text-xs font-medium text-blue-200"
            >
              {permission}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
