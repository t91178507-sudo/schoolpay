"use client";

export function AdminHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function AdminTable({ children, minWidth = "980px" }) {
  return (
    <AdminCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </AdminCard>
  );
}

export function AdminTh({ children, className = "" }) {
  return (
    <th
      className={`bg-slate-50 px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${className}`.trim()}
    >
      {children}
    </th>
  );
}

export function AdminTd({ children, className = "" }) {
  return (
    <td className={`px-5 py-4 align-middle text-slate-700 ${className}`.trim()}>
      {children}
    </td>
  );
}

export function AdminBadge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

export function AdminMetric({ label, value, hint, tone = "slate" }) {
  const tones = {
    slate: "text-slate-950",
    blue: "text-blue-600",
    green: "text-emerald-600",
    orange: "text-orange-600",
    red: "text-red-600",
  };

  return (
    <AdminCard className="p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${tones[tone] || tones.slate}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </AdminCard>
  );
}

export function AdminLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
    </div>
  );
}
