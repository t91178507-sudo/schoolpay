import Image from "next/image";
import Link from "next/link";
import PublicLegalFooter from "../components/PublicLegalFooter";

const proofPoints = [
  { label: "Invoices, receipts and payments in one place", value: "Organised" },
  { label: "See paid, unpaid and partial payments clearly", value: "Visible" },
  { label: "Send invoice and reminder messages through WhatsApp", value: "Connected" },
];

const workflow = [
  {
    title: "Create invoices",
    text: "Prepare invoices with customer details, line items, due dates and payment links.",
  },
  {
    title: "Track payment status",
    text: "Record and monitor paid, unpaid, partial and overdue invoices from one dashboard.",
  },
  {
    title: "Follow up clearly",
    text: "Send WhatsApp invoice messages, reminders and payment confirmations from your workspace.",
  },
];

const features = [
  "1. Create an invoice with description, line items, due date and customer details.",
  "2. Share the invoice through WhatsApp or a payment link.",
  "3. Track paid, unpaid and partially paid invoices in one place.",
  "Use payment links, receipt upload, WhatsApp reminders, customer records and collection reports.",
];

const audiences = [
  {
    title: "Schools",
    text: "Manage student billing, payment tracking and fee reminders from one dashboard.",
  },
  {
    title: "Businesses",
    text: "Send invoices, record payments and keep customer balances organised.",
  },
  {
    title: "Collection Teams",
    text: "Monitor invoice status, review receipts and follow up outstanding balances with confidence.",
  },
];

export default function Home() {
  return (
    <div className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <Image
          src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=80"
          alt="Desk with laptop and financial documents"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-slate-950/78" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.88)_48%,rgba(6,78,59,0.72)_100%)]" />

        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col px-5 pb-5 pt-4 sm:px-6 lg:px-10">
          <header className="rounded-2xl border border-white/10 bg-slate-950/62 px-4 py-3 shadow-xl shadow-black/15 backdrop-blur-xl md:px-5">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="InvoiceHub home">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-5 text-white sm:text-lg">InvoiceHub</p>
                  <p className="hidden truncate text-xs leading-5 text-slate-300 sm:block">
                    Invoices, receipts and WhatsApp follow-ups
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm font-medium text-slate-300 lg:flex">
                {[
                  ["Problem", "#problem"],
                  ["Who it's for", "#audience"],
                  ["How it works", "#how-it-works"],
                ].map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    className="rounded-full px-3.5 py-2 transition hover:bg-white/8 hover:text-white"
                  >
                    {label}
                  </a>
                ))}
                <Link
                  href="/book-demo"
                  className="rounded-full px-3.5 py-2 transition hover:bg-white/8 hover:text-white"
                >
                  Book a demo
                </Link>
              </nav>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/auth/login"
                  className="hidden rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-400 sm:px-5"
                >
                  Start free
                </Link>
              </div>
            </div>

            <nav className="mt-3 flex gap-2 overflow-x-auto border-t border-white/10 pt-3 text-sm font-medium text-slate-300 lg:hidden">
              {[
                ["Problem", "#problem"],
                ["Who it's for", "#audience"],
                ["How it works", "#how-it-works"],
                ["Demo", "/book-demo"],
                ["Log in", "/auth/login"],
              ].map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </header>

          <div className="flex flex-1 flex-col justify-center py-7 lg:py-8">
            <div className="grid gap-7 lg:grid-cols-[1.04fr_0.82fr] lg:items-center">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  InvoiceHub
                </div>
                <h1 className="mt-4 max-w-4xl text-[2.25rem] font-semibold leading-[1.06] tracking-normal sm:text-[3rem] lg:text-[3rem] xl:text-[3.25rem]">
                  Create invoices. Track payments. Follow up{" "}
                  <span className="text-emerald-300">unpaid customers.</span>
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                  Stop managing invoices, receipts and payment follow-ups across
                  chats, screenshots and spreadsheets. InvoiceHub keeps billing,
                  payment status and WhatsApp communication in one workspace.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth/register"
                    className="rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-950/30 transition hover:bg-emerald-400"
                  >
                    Start Free
                  </Link>

                  <Link
                    href="/book-demo"
                    className="rounded-2xl border border-emerald-300/35 px-6 py-3.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/10"
                  >
                    Book a Demo
                  </Link>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/15 text-sm font-bold tracking-wide text-emerald-200 shadow-inner">
                    NGN
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-6 text-white">
                      Keep payment records tied to every invoice
                    </p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-200">
                      Use your configured payment method, record confirmations and keep
                      every invoice status easy to review. InvoiceHub helps organise the
                      workflow; it does not hold business funds.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 text-sm text-slate-100">
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3">
                    <span>Invoice setup</span>
                    <span className="font-semibold text-emerald-300">Line items</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3">
                    <span>Payment tracking</span>
                    <span className="font-semibold text-emerald-300">Status history</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3">
                    <span>Receipt records</span>
                    <span className="font-semibold text-emerald-300">Review-ready</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Payment status
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[78%] rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                    <span>Invoices tracked</span>
                    <span className="font-semibold text-white">Live</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {proofPoints.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/8 px-5 py-3 backdrop-blur-xl"
                >
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="bg-white py-20 dark:bg-slate-950 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              The problem
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold text-slate-950 dark:text-slate-100">
              Businesses lose time when invoice follow-up is scattered.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
              Many businesses still manage invoices using WhatsApp, screenshots and
              spreadsheets. Customers ask for confirmation, teams struggle to see who
              has paid, and follow-ups are easy to miss. InvoiceHub keeps invoice status,
              receipt records and payment conversations in one place.
            </p>
            <div className="mt-10 space-y-8">
              {workflow.map((item, index) => (
                <div key={item.title} className="flex gap-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-400">
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
                     <p className="mt-1 text-xl font-semibold">One dashboard for invoice status</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    Actionable
                  </span>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Invoices to follow up</p>
                    <p className="mt-2 text-3xl font-semibold">24</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Payments confirmed</p>
                    <p className="mt-2 text-3xl font-semibold">186</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Invoice created</span>
                    <span className="text-emerald-300">Shared with customer</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[92%] rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Reminder queued</span>
                    <span className="text-amber-300">Pending payment</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[58%] rounded-full bg-amber-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Receipt prepared</span>
                    <span className="text-sky-300">Ready for review</span>
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

      <section id="audience" className="bg-slate-50 py-20 dark:bg-slate-900 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Who it&apos;s for
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-slate-950 dark:text-slate-100">
              Clearer billing for schools, businesses and collection teams.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
              Keep invoices, payment status and customer follow-up organised.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{audience.title}</p>
                <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400">{audience.text}</p>
              </div>
            ))}
          </div>

          <div id="how-it-works" className="mt-16 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              How it works
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-slate-950 dark:text-slate-100">
              Create it, share it and track the status.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="text-base font-medium text-slate-900 dark:text-slate-100">{feature}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            InvoiceHub helps businesses organise invoice creation, payment status,
            receipt records, WhatsApp reminders and collection history from one workspace.
          </div>
        </div>
      </section>

      <section id="book-demo" className="bg-slate-950 py-20 text-white lg:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Book a Demo
            </p>
            <h2 className="mt-4 text-4xl font-semibold">
              See InvoiceHub in Action
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Book a live demonstration and see how InvoiceHub can simplify invoicing,
              payment tracking, receipt review and WhatsApp follow-up for your business.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/book-demo"
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Book a Demo
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Start Free
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-950 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            InvoiceHub helps businesses organise invoices, payment status, receipt records and WhatsApp follow-up from one simple platform.
          </p>
          <PublicLegalFooter />
        </div>
      </footer>
    </div>
  );
}

