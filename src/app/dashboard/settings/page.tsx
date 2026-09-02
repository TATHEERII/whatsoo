"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ArrowLeft,
  Smartphone,
  RefreshCw,
  PowerOff,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Phone,
  LogOut,
} from "lucide-react";

interface WsStatus {
  ready: boolean;
  state: string;
  qr: string | null;
  phoneNumber: string | null;
  error: string | null;
  initializing?: boolean;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<WsStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingGenRef = useRef(0);
  const failureCountRef = useRef(0);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/auth/login" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
      setSigningOut(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) {
        const data = (await res.json()) as WsStatus;
        setStatus(data);
        setError(null);
        failureCountRef.current = 0;
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Status check failed (${res.status})`);
      }
    } catch {
      /* ignore transient network errors */
    }
  }, []);

  const checkEngineHealth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/whatsapp/status", { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setBusy(true);
    setError(null);
    try {
      const healthy = await checkEngineHealth();
      if (!healthy) {
        setError("WhatsApp engine is not reachable. Please try again later.");
        setConnecting(false);
        setBusy(false);
        return;
      }
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setError(data.error ?? "Failed to start WhatsApp. Is Chromium available?");
      }
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
      setConnecting(false);
    }
  };

  const handleReconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const healthy = await checkEngineHealth();
      if (!healthy) {
        setError("WhatsApp engine is not reachable. Please try again later.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/whatsapp/reconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setError(data.error ?? "Failed to reconnect WhatsApp.");
      }
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconnection failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async (clearSession = false) => {
    setBusy(true);
    try {
      const res = await fetch("/api/whatsapp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearSession }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to disconnect.");
      }
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const handleClearSessionAndReconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await handleDisconnect(true);
      await new Promise((r) => setTimeout(r, 1000));
      await handleConnect();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchStatus, 0);
    return () => clearTimeout(t);
  }, [fetchStatus]);

  useEffect(() => {
    const shouldPoll = status?.ready !== true && !connecting;
    if (!shouldPoll) return;

    const BASE_INTERVAL = 3000;
    const MAX_INTERVAL = 15000;
    const gen = ++pollingGenRef.current;

    const schedule = (delayMs: number) => {
      setTimeout(() => {
        if (pollingGenRef.current !== gen) return;
        fetchStatus().finally(() => {
          if (pollingGenRef.current !== gen) return;
          if (status?.ready === true) return;

          failureCountRef.current++;
          const backoffMs = Math.min(
            MAX_INTERVAL,
            BASE_INTERVAL * Math.pow(2, failureCountRef.current - 1)
          );
          schedule(backoffMs);
        });
      }, delayMs);
    };

    schedule(0);

    return () => {
      pollingGenRef.current = gen + 1;
    };
  }, [connecting, fetchStatus, status?.ready]);

  const connected = status?.ready === true && !status?.qr;

  const showReconnectButton =
    !connected &&
    !connecting &&
    !busy &&
    (status?.error !== null || status?.state === "UNLAUNCHED");

  const showErrorInBadge = status?.error && !connected && status?.state !== "INITIALIZING";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-10">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-amber-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
          Settings
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Connect your WhatsApp account to start sending campaigns.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">
              WhatsApp Connection
            </h2>
            <p className="text-xs text-neutral-500">
              {connected
                ? status?.phoneNumber
                  ? `Your WhatsApp session is active (+${status.phoneNumber}).`
                  : "Your WhatsApp session is active."
                : status?.state === "INITIALIZING"
                  ? "Starting WhatsApp engine, please wait…"
                  : status?.state === "UNLAUNCHED"
                    ? "WhatsApp engine is not running. Start it to connect."
                    : "Scan the QR code with the WhatsApp app to connect."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              connected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : showErrorInBadge
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-neutral-700 bg-neutral-800/50 text-neutral-400"
            }`}
          >
            {connected ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </>
            ) : status?.state === "INITIALIZING" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Initializing…
              </>
            ) : showErrorInBadge ? (
              <>
                <AlertCircle className="h-3 w-3" />
                {status.error}
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                {status ? `State: ${status.state}` : "Disconnected"}
              </>
            )}
          </span>

          {connected ? (
            <button
              onClick={() => handleDisconnect(false)}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PowerOff className="h-4 w-4" />
              )}
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {connecting ? "Connecting…" : "Connect WhatsApp"}
            </button>
          )}
        </div>

        {showReconnectButton && !showErrorInBadge && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleReconnect}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry / Reconnect
            </button>
            <button
              onClick={handleClearSessionAndReconnect}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Clear Session and Reconnect
            </button>
          </div>
        )}

        {showErrorInBadge && !error && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <div className="font-medium">Engine error</div>
            <div className="mt-1 break-words text-amber-200/80">{status.error}</div>
            <button
              onClick={handleReconnect}
              disabled={busy}
              className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry
            </button>
          </div>
        )}

        {error && !connected && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!connected && status?.qr && (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-neutral-800 bg-neutral-950/50 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={status.qr}
              alt="WhatsApp QR code"
              className="h-56 w-56 rounded-lg bg-white p-2"
            />
            <p className="mt-4 text-sm text-neutral-400">
              Open WhatsApp ? Linked Devices ? Link a Device and scan this code.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Account</h2>
            <p className="text-xs text-neutral-500">
              Sign out to connect a different Google account and link a new WhatsApp number.
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </section>
    </div>
  );
}
