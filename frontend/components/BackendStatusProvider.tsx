"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { checkBackendHealth, type BackendHealthResponse } from "@/lib/api";

export type BackendStatusState = "online" | "offline" | "checking";

export type BackendStatusContextType = {
  status: BackendStatusState;
  isOnline: boolean;
  isChecking: boolean;
  lastCheckedAt: Date | null;
  error: string | null;
  data: BackendHealthResponse | null;
  checkStatus: () => Promise<void>;
};

const BackendStatusContext = createContext<BackendStatusContextType | null>(null);

const POLL_INTERVAL_MS = 30000; // 30 seconds

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BackendStatusState>("checking");
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BackendHealthResponse | null>(null);

  const inFlightRef = useRef(false);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const executeCheck = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsChecking(true);

    try {
      const result = await checkBackendHealth();
      setLastCheckedAt(new Date());

      if (result.isOnline) {
        setStatus("online");
        setError(null);
        setData(result.data ?? null);
      } else {
        setStatus("offline");
        setError(result.error ?? "Backend server is unreachable");
        setData(null);
      }
    } catch (err) {
      setStatus("offline");
      setError(err instanceof Error ? err.message : "Health check failed");
      setData(null);
    } finally {
      setIsChecking(false);
      inFlightRef.current = false;
    }
  }, []);

  const checkRef = useRef(executeCheck);
  useEffect(() => {
    checkRef.current = executeCheck;
  }, [executeCheck]);

  // Manual retry function called by users
  const checkStatus = useCallback(async () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }
    intervalIdRef.current = setInterval(() => {
      void checkRef.current();
    }, POLL_INTERVAL_MS);

    await executeCheck();
  }, [executeCheck]);

  useEffect(() => {
    let active = true;

    checkBackendHealth()
      .then((result) => {
        if (!active) return;
        setLastCheckedAt(new Date());
        if (result.isOnline) {
          setStatus("online");
          setError(null);
          setData(result.data ?? null);
        } else {
          setStatus("offline");
          setError(result.error ?? "Backend server is unreachable");
          setData(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        setStatus("offline");
        setError(err instanceof Error ? err.message : "Health check failed");
        setData(null);
      })
      .finally(() => {
        if (active) {
          setIsChecking(false);
        }
      });

    intervalIdRef.current = setInterval(() => {
      void checkRef.current();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  const value: BackendStatusContextType = {
    status,
    isOnline: status === "online",
    isChecking,
    lastCheckedAt,
    error,
    data,
    checkStatus,
  };

  return (
    <BackendStatusContext.Provider value={value}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus(): BackendStatusContextType {
  const context = useContext(BackendStatusContext);
  if (!context) {
    throw new Error("useBackendStatus must be used within a BackendStatusProvider");
  }
  return context;
}

