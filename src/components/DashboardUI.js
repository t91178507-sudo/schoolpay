"use client";

export function PageShell({ children }) {
  return <div className="space-y-8">{children}</div>;
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        {description ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatGrid({ children, className = "" }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "slate" }) {
  const toneMap = {
    slate: "text-slate-900 dark:text-white",
    emerald: "text-emerald-600",
    orange: "text-orange-600",
    blue: "text-blue-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-semibold ${toneMap[tone] || toneMap.slate}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function SurfaceCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function Toolbar({ children }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
      {children}
    </div>
  );
}

export function InputField(props) {
  return (
    <input
      {...props}
      className={`h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-600 ${props.className || ""}`.trim()}
    />
  );
}

export function SelectField(props) {
  return (
    <select
      {...props}
      className={`h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 ${props.className || ""}`.trim()}
    />
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="py-16 text-center">
      <p className="text-base font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ children, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    purple: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${toneMap[tone] || toneMap.slate}`}
    >
      {children}
    </span>
  );
}
