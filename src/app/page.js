import Link from "next/link";

export default function Home() {
  return (
    <div>

      {/* ✅ NAVBAR */}
      <header className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center">
        
        <h1 className="text-xl font-bold">InvoiceHub</h1>

        <nav className="space-x-6 text-sm">
          Home
          Features
          Contact
          <Link href="/auth/login" className="bg-white text-blue-700 px-4 py-1 rounded-lg ml-4">
            Login
          </Link>
        </nav>
      </header>

      {/* ✅ HERO SECTION */}
      <section
        className="h-[80vh] flex items-center justify-center text-center text-white"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1588072432836-e10032774350')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="bg-black/60 p-8 rounded-xl">

          <h1 className="text-4xl font-bold mb-4">
            School Management & Payment System
          </h1>

          <p className="text-lg mb-6">
            A complete solution to manage school fees, students and payments
          </p>

          <div className="space-x-4">

            <Link
              href="/auth/register"
              className="bg-green-500 px-6 py-3 rounded-lg text-white"
            >
              Get Started
            </Link>

            <a
              href="#features"
              className="border border-white px-6 py-3 rounded-lg"
            >
              Learn More
            </a>

          </div>
        </div>
      </section>

      {/* ✅ FEATURES */}
      <section id="features" className="p-10 bg-gray-100">

        <h2 className="text-2xl font-bold text-center mb-8">
          Core Features
        </h2>

        <div className="grid grid-cols-3 gap-6">

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="font-semibold mb-2">Student Management</h3>
            <p className="text-sm text-gray-500">
              Easily add and manage students
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="font-semibold mb-2">Automatic Invoices</h3>
            <p className="text-sm text-gray-500">
              Generate invoices instantly
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="font-semibold mb-2">Online Payments</h3>
            <p className="text-sm text-gray-500">
              Accept payments with TouchPay
            </p>
          </div>

        </div>

      </section>

      {/* ✅ ABOUT SECTION */}
      <section className="p-10 flex gap-10 items-center">

        <div className="w-1/2">
          <img
            src="https://images.unsplash.com/photo-1607237138185-eedd9c632b0b"
            alt="school"
            className="rounded-xl"
          />
        </div>

        <div className="w-1/2">
          <h2 className="text-2xl font-bold mb-4">
            Best School ERP System
          </h2>

          <p className="text-gray-500 mb-6">
            SchoolPay helps schools manage payments, automate billing,
            and track financial records all in one place.
          </p>

          <Link
            href="/auth/register"
            className="bg-green-500 text-white px-6 py-3 rounded-lg"
          >
            Get Started
          </Link>
        </div>

      </section>

      {/* ✅ FOOTER */}
      <footer className="bg-blue-700 text-white text-center p-4">
        © 2026 InvoiceHub — All rights reserved
      </footer>

    </div>
  );
}