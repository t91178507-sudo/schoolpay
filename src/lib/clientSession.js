"use client";

import { useSyncExternalStore } from "react";

const EMPTY_BUSINESS_SESSION = Object.freeze({
  isLoggedIn: false,
  userName: "",
  userEmail: "",
  userPhone: "",
  username: "",
  businessName: "",
  businessType: "",
  businessLogo: "",
  role: "",
  roleKey: "",
  accountType: "owner",
  ownerId: "",
  assignedBusinesses: [],
  assignedAllBusinesses: false,
  permissions: {},
});

const EMPTY_ADMIN_SESSION = Object.freeze({
  isAdminLoggedIn: false,
});

let businessSnapshotCache = EMPTY_BUSINESS_SESSION;
let adminSnapshotCache = EMPTY_ADMIN_SESSION;

function readJsonValue(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function subscribe(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => callback();

  window.addEventListener("storage", handleChange);
  window.addEventListener("session-change", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("session-change", handleChange);
  };
}

function getBusinessSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_BUSINESS_SESSION;
  }

  const nextSnapshot = {
    isLoggedIn: localStorage.getItem("isLoggedIn") === "true",
    userName: localStorage.getItem("userName") || "",
    userEmail: localStorage.getItem("userEmail") || "",
    userPhone: localStorage.getItem("userPhone") || "",
    username: localStorage.getItem("username") || "",
    businessName: localStorage.getItem("businessName") || "",
    businessType: localStorage.getItem("businessType") || "",
    businessLogo: localStorage.getItem("businessLogo") || "",
    role: localStorage.getItem("role") || "",
    roleKey: localStorage.getItem("roleKey") || "",
    accountType: localStorage.getItem("accountType") || "owner",
    ownerId: localStorage.getItem("ownerId") || "",
    assignedBusinesses: readJsonValue("assignedBusinesses", []),
    assignedAllBusinesses: localStorage.getItem("assignedAllBusinesses") === "true",
    permissions: readJsonValue("permissions", {}),
  };

  if (
    businessSnapshotCache.isLoggedIn === nextSnapshot.isLoggedIn &&
    businessSnapshotCache.userName === nextSnapshot.userName &&
    businessSnapshotCache.userEmail === nextSnapshot.userEmail &&
    businessSnapshotCache.userPhone === nextSnapshot.userPhone &&
    businessSnapshotCache.username === nextSnapshot.username &&
    businessSnapshotCache.businessName === nextSnapshot.businessName &&
    businessSnapshotCache.businessType === nextSnapshot.businessType &&
    businessSnapshotCache.businessLogo === nextSnapshot.businessLogo &&
    businessSnapshotCache.role === nextSnapshot.role &&
    businessSnapshotCache.roleKey === nextSnapshot.roleKey &&
    businessSnapshotCache.accountType === nextSnapshot.accountType &&
    businessSnapshotCache.ownerId === nextSnapshot.ownerId &&
    JSON.stringify(businessSnapshotCache.assignedBusinesses) === JSON.stringify(nextSnapshot.assignedBusinesses) &&
    businessSnapshotCache.assignedAllBusinesses === nextSnapshot.assignedAllBusinesses &&
    JSON.stringify(businessSnapshotCache.permissions) === JSON.stringify(nextSnapshot.permissions)
  ) {
    return businessSnapshotCache;
  }

  businessSnapshotCache = nextSnapshot;
  return businessSnapshotCache;
}

function getAdminSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_ADMIN_SESSION;
  }

  const nextSnapshot = {
    isAdminLoggedIn: localStorage.getItem("isAdminLoggedIn") === "true",
  };

  if (adminSnapshotCache.isAdminLoggedIn === nextSnapshot.isAdminLoggedIn) {
    return adminSnapshotCache;
  }

  adminSnapshotCache = nextSnapshot;
  return adminSnapshotCache;
}

function getThemeSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem("darkMode") === "true";
}

function applyDarkModePreference(enabled) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", enabled);
}

export function emitSessionChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session-change"));
  }
}

export function setDarkModePreference(enabled) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("darkMode", String(enabled));
  applyDarkModePreference(enabled);
  emitSessionChange();
}

export function useBusinessSession() {
  return useSyncExternalStore(subscribe, getBusinessSnapshot, getBusinessSnapshot);
}

export function useAdminSession() {
  return useSyncExternalStore(subscribe, getAdminSnapshot, getAdminSnapshot);
}

export function useDarkModePreference() {
  return useSyncExternalStore(subscribe, getThemeSnapshot, getThemeSnapshot);
}

function subscribeToHydration() {
  return () => {};
}

function getHydratedSnapshot() {
  return true;
}

function getHydratedServerSnapshot() {
  return false;
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getHydratedServerSnapshot
  );
}
