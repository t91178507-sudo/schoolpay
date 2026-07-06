"use client";

import { useSyncExternalStore } from "react";

const EMPTY_BUSINESS_SESSION = Object.freeze({
  isLoggedIn: false,
  authToken: "",
  userName: "",
  userEmail: "",
  businessName: "",
  businessType: "",
  businessLogo: "",
});

const EMPTY_ADMIN_SESSION = Object.freeze({
  adminToken: "",
});

let businessSnapshotCache = EMPTY_BUSINESS_SESSION;
let adminSnapshotCache = EMPTY_ADMIN_SESSION;

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
    authToken: localStorage.getItem("authToken") || "",
    userName: localStorage.getItem("userName") || "",
    userEmail: localStorage.getItem("userEmail") || "",
    businessName: localStorage.getItem("businessName") || "",
    businessType: localStorage.getItem("businessType") || "",
    businessLogo: localStorage.getItem("businessLogo") || "",
  };

  if (
    businessSnapshotCache.isLoggedIn === nextSnapshot.isLoggedIn &&
    businessSnapshotCache.authToken === nextSnapshot.authToken &&
    businessSnapshotCache.userName === nextSnapshot.userName &&
    businessSnapshotCache.userEmail === nextSnapshot.userEmail &&
    businessSnapshotCache.businessName === nextSnapshot.businessName &&
    businessSnapshotCache.businessType === nextSnapshot.businessType &&
    businessSnapshotCache.businessLogo === nextSnapshot.businessLogo
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
    adminToken: localStorage.getItem("adminToken") || "",
  };

  if (adminSnapshotCache.adminToken === nextSnapshot.adminToken) {
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
