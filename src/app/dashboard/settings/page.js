"use client";

import { useState } from "react";

export default function Settings() {
  const [business, setBusiness] = useState({});
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState("");
  const [twoFA, setTwoFA] = useState(false);

  const handleChange = (e) => {
    setBusiness({ ...business, [e.target.name]: e.target.value });
  };

  const addUser = () => {
    if (!newUser) return;
    setUsers([...users, newUser]);
    setNewUser("");
  };

  const removeUser = (email) => {
    setUsers(users.filter((u) => u !== email));
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your business and preferences
        </p>
      </div>

      {/* ✅ BUSINESS PROFILE */}
      <div className="bg-white rounded-3xl shadow-sm p-8 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Business Profile</h2>

        <div className="grid md:grid-cols-2 gap-5">
          <input name="name" placeholder="Business Name"
            onChange={handleChange}
            className="input" />

          <input name="industry" placeholder="Industry"
            onChange={handleChange}
            className="input" />

          <input name="email" placeholder="Email"
            onChange={handleChange}
            className="input" />

          <input name="phone" placeholder="Phone Number"
            onChange={handleChange}
            className="input" />

          <input name="address" placeholder="Address"
            onChange={handleChange}
            className="input" />

          <input name="website" placeholder="Website"
            onChange={handleChange}
            className="input" />

          <input name="taxId" placeholder="Tax ID (optional)"
            onChange={handleChange}
            className="input" />

          <input type="file" className="input" />
        </div>

        <button className="btn-primary">
          Save Profile
        </button>
      </div>

      {/* ✅ USER ROLES */}
      <div className="bg-white rounded-3xl shadow-sm p-8 space-y-6">
        <h2 className="text-xl font-semibold">User Roles</h2>

        <div className="flex gap-3">
          <input
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            placeholder="User email"
            className="input flex-1"
          />

          <button onClick={addUser} className="btn-primary">
            Add User
          </button>
        </div>

        <div className="space-y-2">
          {users.map((u, i) => (
            <div key={i} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-sm">{u}</span>
              <button onClick={() => removeUser(u)} className="text-red-500 text-sm">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ SECURITY */}
      <div className="bg-white rounded-3xl shadow-sm p-8 space-y-6">
        <h2 className="text-xl font-semibold">Security</h2>

        {/* PASSWORD */}
        <div className="space-y-3">
          <input type="password" placeholder="Current Password" className="input" />
          <input type="password" placeholder="New Password" className="input" />

          <button className="btn-primary">
            Change Password
          </button>
        </div>

        {/* 2FA */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4">
          <span className="text-sm font-medium">
            Two-Factor Authentication
          </span>
          <button
            onClick={() => setTwoFA(!twoFA)}
            className={`px-4 py-2 rounded-xl text-sm ${
              twoFA
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {twoFA ? "Enabled" : "Disabled"}
          </button>
        </div>

        {/* SESSIONS */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-600">
            Active Session: This device
          </p>

          <button className="text-red-500 text-sm mt-2">
            Log out all devices
          </button>
        </div>
      </div>

    </div>
  );
}