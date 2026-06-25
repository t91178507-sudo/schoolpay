"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ✅ Business Types
const businessTypes = [
  "School",
  "Estate",
  "Hospital",
  "Distributor",
  "Fuel Supplier",
  "Professional Service"
];

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    businessType: "",
    role: "Admin",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  // ✅ Handle input change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // ✅ Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!formData.businessType) {
      setError("Please select a business type");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          businessName: formData.businessName,
          businessType: formData.businessType,
          role: formData.role,
        }),
      });

      let data;

      try {
        data = await res.json();
      } catch (err) {
        setError("Server returned invalid response");
        setLoading(false);
        return;
      }

      if (res.ok && data.success) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userName", formData.fullName);
        localStorage.setItem("businessName", formData.businessName);
        localStorage.setItem("businessType", formData.businessType);

        router.push("/dashboard");
      } else {
        setError(data.error || "Registration failed. Please try again.");
      }

    } catch (err) {
      setError("Connection error. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* ✅ Logo */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-4xl">
              💰
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">InvoiceHub</h1>
              <p className="text-gray-500 -mt-1">Multi-Business Platform</p>
            </div>
          </div>
        </div>

        {/* ✅ Card */}
        <div className="bg-white rounded-3xl shadow-xl border p-10">
          <h2 className="text-3xl font-semibold text-center mb-2">
            Create Account
          </h2>
          <p className="text-gray-600 text-center mb-8">
            Set up your business platform
          </p>

          {/* ✅ Error */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm mb-6">
              {error}
            </div>
          )}

          {/* ✅ Form */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Full Name */}
            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Business Name */}
            <input
              type="text"
              name="businessName"
              placeholder="Business Name (e.g. ABC School)"
              value={formData.businessName}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Business Type */}
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Business Type</option>
              {businessTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Email */}
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Password */}
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Confirm Password */}
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 rounded-2xl transition"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {/* ✅ Login Link */}
          <p className="text-center text-sm text-gray-500 mt-8">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          © 2026 InvoiceHub. All rights reserved.
        </p>

      </div>
    </div>
  );
}