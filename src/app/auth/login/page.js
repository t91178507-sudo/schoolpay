"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  setLoading(true);
  setError("");

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      
body: JSON.stringify({
  name: formData.name,
  class: formData.class,
  parent: formData.parent,
  phone: formData.parentPhone, // ✅ MAP IT HERE
  parentEmail: formData.parentEmail,
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

    if (res.ok) {
      localStorage.setItem("isLoggedIn", "true");

      setTimeout(() => {
        router.replace("/dashboard");
      }, 200);

    } else {
      setError(data.message || "Invalid credentials");
    }

  } catch (err) {
    setError("Connection error. Check your API.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">

      <div className="max-w-md w-full">

        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-4xl mb-4">
            💰
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            InvoiceHub
          </h1>

          <p className="text-gray-600 mt-2">
            Sign in to manage your Payments
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-10">

          <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@school.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center bg-red-50 py-2 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-2xl transition text-lg"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

          </form>

          <div className="text-center mt-8">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <Link
                href="/auth/register"
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                Register here
              </Link>
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}