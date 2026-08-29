"use client";

import { useState, useEffect, useCallback, type ComponentType } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Pause,
  Square,
  ArrowLeft,
  Loader2,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  Inbox,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  templateName: string | null;
  contactListName: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalContacts: number;
    sent: number;
    failed: number;
    successRate: string;
  };
}

interface CampaignLog {
  id: string;
  recipient: string;
  status: string;
  messageId: string | null;
  error: string | null;
  sentAt: string;
}

type CampaignStatus = Campaign["status"];

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "border-neutral-700 bg-neutral-800/50 text-neutral-400",
  },
  scheduled: {
    label: "Scheduled",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  paused: {
    label: "Paused",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  completed: {
    label: "Completed",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  failed: {
    label: "Failed",
    className:
      "border-red-500/30 bg-red-500/10 text-red-400",
  },
};

const ACTION_CONFIG: Record<
  CampaignStatus,
  { start?: boolean; pause?: boolean; resume?: boolean; stop?: boolean }
> = {
  draft: { start: true },
  scheduled: { start: true, stop: true },
  running: { pause: true, stop: true },
  paused: { resume: true, stop: true },
  stopped: { start: true },
  completed: {},
  failed: { start: true },
};

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; className: string; Icon: ComponentType<{ className?: string }> }
  > = {
    sent: {
      label: "Sent",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      Icon: CheckCircle2,
    },
    failed: {
      label: "Failed",
      className:
        "border-red-500/30 bg-red-500/10 text-red-400",
      Icon: XCircle,
    },
    pending: {
      label: "Pending",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-400",
      Icon: AlertCircle,
    },
    delivered: {
      label: "Delivered",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      Icon: CheckCircle2,
    },
    read: {
      label: "Read",
      className:
        "border-sky-500/30 bg-sky-500/10 text-sky-400",
      Icon: CheckCircle2,
    },
  };

  const entry = config[status] || config.pending;
  const { Icon } = entry;

  return (
    <span
      className={"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium " + entry.className}
    >
      <Icon className="h-3 w-3" />
      {entry.label}
    </span>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [campaignRes, logsRes] = await Promise.all([
        fetch("/api/campaigns/" + campaignId),
        fetch("/api/campaigns/" + campaignId + "/logs?limit=50"),
      ]);

      if (campaignRes.ok) {
        const data = await campaignRes.json();
        setCampaign(data);
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Failed to fetch campaign data:", error);
    } finally {
      setLoading(false);
      setLogsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!campaign) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [campaign, fetchData]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch("/api/campaigns/" + campaignId + "/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to " + action + " campaign:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-neutral-400">Campaign not found.</p>
        <Link
          href="/dashboard/campaigns"
          className="mt-4 text-sm text-amber-400 hover:text-amber-300"
        >
          Back to campaigns
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[campaign.status];
  const actions = ACTION_CONFIG[campaign.status];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/campaigns"
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
                {campaign.name}
              </h1>
              <span
                className={"inline-flex items-center rounded-lg border px-3 py-1 text-sm font-medium " + statusConfig.className}
              >
                {statusConfig.label}
              </span>
            </div>
            {campaign.description && (
              <p className="mt-1 text-sm text-neutral-400">
                {campaign.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actions.start && (
            <button
              onClick={() => handleAction("start")}
              disabled={actionLoading !== null}
              className="luxury-button"
            >
              {actionLoading === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start
            </button>
          )}
          {actions.pause && (
            <button
              onClick={() => handleAction("pause")}
              disabled={actionLoading !== null}
              className="luxury-button luxury-button-outline"
            >
              {actionLoading === "pause" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              Pause
            </button>
          )}
          {actions.resume && (
            <button
              onClick={() => handleAction("resume")}
              disabled={actionLoading !== null}
              className="luxury-button"
            >
              {actionLoading === "resume" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Resume
            </button>
          )}
          {actions.stop && (
            <button
              onClick={() => handleAction("stop")}
              disabled={actionLoading !== null}
              className="luxury-button"
              style={{
                background: "linear-gradient(145deg, #7f1d1d, #991b1b)",
                borderColor: "#b91c1c",
              }}
            >
              {actionLoading === "stop" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop
            </button>
          )}
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="luxury-card">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <Phone className="h-5 w-5" />
          </div>
          <p className="text-sm text-neutral-400">Total Contacts</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-100">
            {campaign.stats.totalContacts.toLocaleString()}
          </p>
        </div>

        <div className="luxury-card">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm text-neutral-400">Sent</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-100">
            {campaign.stats.sent.toLocaleString()}
          </p>
        </div>

        <div className="luxury-card">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <XCircle className="h-5 w-5" />
          </div>
          <p className="text-sm text-neutral-400">Failed</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-100">
            {campaign.stats.failed.toLocaleString()}
          </p>
        </div>

        <div className="luxury-card">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="text-sm text-neutral-400">Success Rate</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-100">
            {campaign.stats.successRate}
          </p>
        </div>
      </section>

      <section className="luxury-card luxury-card-glow">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">
            Message Log
          </h2>
          <span className="text-xs text-neutral-500">
            Auto-refreshing every 5s
          </span>
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
            <Inbox className="mb-2 h-8 w-8" />
            <p className="text-sm">No messages sent yet.</p>
          </div>
        ) : (
          <div className="luxury-scrollbar overflow-y-auto" style={{ maxHeight: "600px" }}>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-neutral-900">
                <tr className="border-b border-neutral-800">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-neutral-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-neutral-300">
                        <Phone className="h-3.5 w-3.5 text-neutral-600" />
                        {log.recipient}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-neutral-600" />
                        {formatTime(log.sentAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-red-400">
                      {log.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}