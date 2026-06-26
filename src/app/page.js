import Image from "next/image";
import Link from "next/link";

const proofPoints = [
  { label: "Invoices sent faster", value: "3x" },
  { label: "Payment follow-up time", value: "-62%" },
  { label: "Shared customer records", value: "1 hub" },
];

const workflow = [
  {
    title: "Create polished invoices",
    text: "Prepare customer-ready invoices with clear line items, due dates, and secure payment links.",
  },
  {
    title: "Stay on top of every customer",
    text: "Keep customer categories, billing history, and payment status in one organized workspace.",
  },
  {
    title: "Collect with less chasing",
    text: "Share invoices instantly and track which payments are pending, confirmed, or overdue.",
  },
];

const features = [
  "Customer categories for cleaner billing operations",
  "Invoice links you can share in seconds",
  "Payment tracking across every outstanding account",
  "Admin oversight for users, invoices, and collections",
];

export default function Home() {
  return (
    <div className="bg-white text-slate-950">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold">
              N
            </div>
            <div>
              <p className="text-xl font-semibold">InvoiceHub</p>
              <p className="text-xs text-white/70">Invoicing and collections</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/80 md:flex">
            <a href="#workflow" className="hover:text-white">
              Workflow
            </a>
            <a href="#platform" className="hover:text-white">
              Platform
            </a>
            <a href="#results" className="hover:text-white">
              Results
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/10"
            >
              Log in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
        <Image
          src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=80"
          alt="Desk with laptop and financial documents"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.94)_0%,rgba(15,23,42,0.78)_45%,rgba(16,185,129,0.18)_100%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-6 pb-14 pt-32 lg:px-10 lg:pb-20">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
              InvoiceHub
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-tight sm:text-6xl lg:text-7xl">
              The invoicing system that keeps revenue moving.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              Run customer billing, send payment links, track collections, and
              keep every invoice status visible from one focused workspace.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/auth/register"
                className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Create your workspace
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {proofPoints.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/8 px-5 py-5 backdrop-blur"
              >
                <p className="text-3xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-sm text-slate-300">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-white py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Workflow
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold text-slate-950">
              Built for teams that invoice often and need cleaner follow-through.
            </h2>
            <div className="mt-10 space-y-8">
              {workflow.map((item, index) => (
                <div key={item.title} className="flex gap-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-base leading-7 text-slate-600">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-xl">
              <div className="border-b border-white/10 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Collections snapshot</p>
                    <p className="mt-1 text-xl font-semibold">June billing cycle</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    84% paid
                  </span>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Outstanding</p>
                    <p className="mt-2 text-3xl font-semibold">N 1.28M</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Invoices sent</p>
                    <p className="mt-2 text-3xl font-semibold">246</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Northfield Supply</span>
                    <span className="text-emerald-300">Paid</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[92%] rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Oakline Studio</span>
                    <span className="text-amber-300">Pending</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[58%] rounded-full bg-amber-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Prime Retail Group</span>
                    <span className="text-sky-300">Sent today</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[36%] rounded-full bg-sky-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-slate-50 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Platform
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-slate-950">
              A cleaner front door for customer billing.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              InvoiceHub keeps the essentials close: customer lists, invoice
              generation, payment visibility, and admin oversight without the
              clutter that usually slows teams down.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-6"
              >
                <p className="text-base font-medium text-slate-900">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="bg-slate-950 py-20 text-white lg:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Results
            </p>
            <h2 className="mt-4 text-4xl font-semibold">
              Give your invoicing process the kind of clarity customers actually respond to.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              When invoices are easy to send, easy to understand, and easy to
              pay, teams spend less time chasing and more time closing.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/auth/register"
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Start with InvoiceHub
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Open existing workspace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
