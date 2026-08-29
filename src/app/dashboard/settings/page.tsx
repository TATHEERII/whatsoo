"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Smartphone,
  RefreshCw,
  PowerOff,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface WsStatus {
  ready: boolean;
  state: string;
  qr: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<WsStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) {
        const data = (await res.json()) as WsStatus;
        setStatus(data);
        setError(null);
      }
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const shouldPoll = status && !status.ready && !connecting ? true : false;
    if (shouldPoll) {
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchStatus, 2500);
      }
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status, connecting, fetchStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setBusy(true);
    setError(null);
    try {
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

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await fetch("/api/whatsapp/disconnect", { method: "POST" });
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.ready === true;

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
                ? "Your WhatsApp session is active."
                : "Scan the QR code with the WhatsApp app to connect."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              connected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-neutral-700 bg-neutral-800/50 text-neutral-400"
            }`}
          >
            {connected ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Connected
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
              onClick={handleDisconnect}
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

        {error && (
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
              Open WhatsApp → Linked Devices → Link a Device and scan this code.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
