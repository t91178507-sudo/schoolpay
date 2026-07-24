"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";

const FeedbackContext = createContext(null);

const toneStyles = {
  success: {
    icon: FiCheckCircle,
    className: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-100",
    iconClassName: "text-emerald-600 dark:text-emerald-300",
  },
  error: {
    icon: FiAlertTriangle,
    className: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950 dark:text-red-100",
    iconClassName: "text-red-600 dark:text-red-300",
  },
  warning: {
    icon: FiAlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-100",
    iconClassName: "text-amber-600 dark:text-amber-300",
  },
  info: {
    icon: FiInfo,
    className: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-100",
    iconClassName: "text-blue-600 dark:text-blue-300",
  },
};

function normalizeToastArgs(toneOrMessage, maybeMessage, options = {}) {
  if (maybeMessage === undefined) {
    return {
      tone: "info",
      message: String(toneOrMessage || ""),
      options,
    };
  }

  return {
    tone: toneStyles[toneOrMessage] ? toneOrMessage : "info",
    message: String(maybeMessage || ""),
    options,
  };
}

export function AppFeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolverRef = useRef(null);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toneOrMessage, maybeMessage, maybeOptions = {}) => {
    const { tone, message, options } = normalizeToastArgs(
      toneOrMessage,
      maybeMessage,
      maybeOptions
    );

    if (!message) {
      return "";
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = Number(options.durationMs || options.duration || 5000);

    setToasts((current) => [
      ...current,
      {
        id,
        tone,
        message,
        title: options.title || "",
      },
    ].slice(-4));

    if (duration > 0) {
      window.setTimeout(() => dismissToast(id), duration);
    }

    return id;
  }, [dismissToast]);

  const confirm = useCallback((options = {}) => {
    const normalizedOptions =
      typeof options === "string" ? { message: options } : options;

    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        title: normalizedOptions.title || "Confirm action",
        message: normalizedOptions.message || "Are you sure?",
        confirmLabel: normalizedOptions.confirmLabel || "Confirm",
        cancelLabel: normalizedOptions.cancelLabel || "Cancel",
        tone: normalizedOptions.tone || "danger",
      });
    });
  }, []);

  const settleConfirm = useCallback((answer) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmState(null);
    resolver?.(answer);
  }, []);

  const value = useMemo(
    () => ({ showToast, toast: showToast, confirm }),
    [confirm, showToast]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[1000] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => {
          const style = toneStyles[toast.tone] || toneStyles.info;
          const Icon = style.icon;

          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${style.className}`}
              role="status"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClassName}`} />
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
                <p className="whitespace-pre-line text-sm leading-5">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                aria-label="Dismiss notification"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState ? (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300">
                <FiAlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  {confirmState.title}
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {confirmState.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => settleConfirm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => settleConfirm(true)}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useToast() {
  const context = useContext(FeedbackContext);

  if (!context) {
    return () => {};
  }

  return context.showToast;
}

export function useConfirm() {
  const context = useContext(FeedbackContext);

  if (!context) {
    return async () => false;
  }

  return context.confirm;
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    return {
      toast: () => {},
      confirm: async () => false,
    };
  }

  return {
    toast: context.showToast,
    confirm: context.confirm,
  };
}


