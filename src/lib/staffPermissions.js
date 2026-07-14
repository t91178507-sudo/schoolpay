export const PERMISSION_GROUPS = Object.freeze({
  customers: [
    "customers.view",
    "customers.create",
    "customers.edit",
    "customers.delete",
  ],
  invoices: [
    "invoices.view",
    "invoices.create",
    "invoices.edit",
    "invoices.cancel",
  ],
  payments: [
    "payments.view",
    "payments.record",
    "payments.validateReceipts",
    "payments.viewPending",
    "payments.approve",
    "payments.reject",
  ],
  communication: [
    "communication.sendWhatsApp",
    "communication.sendReminders",
    "communication.sendReceipts",
  ],
  qrPayments: [
    "qr.generate",
    "qr.share",
  ],
  reports: [
    "reports.view",
    "reports.export",
  ],
  settings: [
    "settings.view",
    "settings.edit",
    "settings.managePaymentMethods",
  ],
  users: [
    "users.create",
    "users.edit",
    "users.delete",
  ],
});

export const ALL_PERMISSIONS = Object.freeze(
  Object.values(PERMISSION_GROUPS).flat()
);

export function labelPermission(permission) {
  return String(permission || "")
    .split(".")
    .map((part) => part.replace(/([A-Z])/g, " $1"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
