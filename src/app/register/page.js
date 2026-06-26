"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    schoolName: "",
    role: "Manager",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // ✅ VALIDATION
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
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
          businessName: formData.schoolName,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // ✅ OPTIONAL: auto login after register
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userName", formData.fullName);
        localStorage.setItem("businessName", formData.schoolName);

        window.location.href = "/dashboard";
      } else {
        // ✅ redirect to login if no token returned
        router.push("/auth/login");
      }

    } catch (err) {
      console.error(err);
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-4xl">
              💰
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">SchoolPay</h1>
              <p className="text-gray-500 dark:text-gray-400 -mt-1">School Management</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-10">
          <h2 className="text-3xl font-semibold text-center mb-2 text-gray-900 dark:text-white">
            Create Account
          </h2>

          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            Set up your school management system
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              placeholder="Full Name"
              className="w-full px-5 py-4 border rounded-2xl"
            />

            <input
              type="text"
              name="schoolName"
              value={formData.schoolName}
              onChange={handleChange}
              required
              placeholder="School Name"
              className="w-full px-5 py-4 border rounded-2xl"
            />

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Email"
              className="w-full px-5 py-4 border rounded-2xl"
            />

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Password"
              className="w-full px-5 py-4 border rounded-2xl"
            />

            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm Password"
              className="w-full px-5 py-4 border rounded-2xl"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm mt-6 text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-blue-600">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}