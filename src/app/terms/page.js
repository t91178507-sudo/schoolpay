import Link from "next/link";

const sections = [
  {
    title: "Software platform role",
    body:
      "InvoiceHub provides software for invoice creation, billing workflows, payment-link presentation, and payment-status monitoring. InvoiceHub does not accept deposits, custody funds, or resettle customer payments to merchants.",
  },
  {
    title: "Merchant-controlled payment processing",
    body:
      "Where payment gateways are used, the merchant is responsible for connecting and maintaining its own payment provider credentials, settlement account, and commercial relationship with that provider.",
  },
  {
    title: "Customer-facing records",
    body:
      "Businesses using InvoiceHub are responsible for ensuring invoice details, customer information, pricing, and payment instructions are accurate before those records are shared with customers.",
  },
  {
    title: "Messaging and receipts",
    body:
      "InvoiceHub may help prepare payment reminders or confirmation messages, including WhatsApp-ready content. The business using the platform remains responsible for lawful customer contact and message content.",
  },
  {
    title: "Compliance and disputes",
    body:
      "Each merchant remains responsible for taxes, refunds, chargebacks, service disputes, customer support, and compliance with local laws or sector rules that apply to the merchant's business.",
  },
  {
    title: "Availability and security",
    body:
      "InvoiceHub aims to provide reliable service and reasonable safeguards for sensitive settings, but use of the platform is still subject to infrastructure limits, third-party gateway availability, and internet service conditions.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Terms
          </p>
          <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            InvoiceHub platform terms
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            These platform terms are intended to make InvoiceHub&apos;s role clear as a software
            provider. They do not replace merchant-specific contracts or legal review.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              <p className="text-sm leading-7 text-slate-600 sm:text-base">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
          If you operate live billing for customers, add your own merchant-facing refund,
          support, tax, and delivery terms as part of your business setup and customer journey.
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="font-medium text-slate-700 hover:text-slate-900">
            Back to home
          </Link>
          <Link href="/privacy" className="font-medium text-emerald-700 hover:text-emerald-800">
            Read privacy notice
          </Link>
        </div>
      </div>
    </main>
  );
}
