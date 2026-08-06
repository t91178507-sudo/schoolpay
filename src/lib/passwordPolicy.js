export const PASSWORD_REQUIREMENTS = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => String(value || "").length >= 8,
  },
  {
    key: "uppercase",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(String(value || "")),
  },
  {
    key: "lowercase",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(String(value || "")),
  },
  {
    key: "number",
    label: "One number",
    test: (value) => /\d/.test(String(value || "")),
  },
  {
    key: "special",
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(String(value || "")),
  },
];

export function getPasswordChecks(password) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    valid: requirement.test(password),
  }));
}

export function isStrongPassword(password) {
  return getPasswordChecks(password).every((check) => check.valid);
}

export function getPasswordPolicyMessage(password) {
  const missing = getPasswordChecks(password)
    .filter((check) => !check.valid)
    .map((check) => check.label.toLowerCase());

  return missing.length
    ? `Password must include ${missing.join(", ")}.`
    : "";
}
