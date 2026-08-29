"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  Eye,
  Plus,
  Send,
  Clock,
  Loader2,
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
  running: {
    label: "Running",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  paused: {
    label: "Paused",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  stopped: {
    label: "Stopped",
    className:
      "border-neutral-700 bg-neutral-800/50 text-neutral-400",
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

const ACTIONS: Record<
  CampaignStatus,
  { start?: boolean; pause?: boolean; resume?: boolean; stop?: boolean; view?: boolean }
> = {
  draft: { start: true, view: true },
  running: { pause: true, stop: true, view: true },
  paused: { resume: true, stop: true, view: true },
  stopped: { start: true, view: true },
  completed: { view: true },
  failed: { view: true },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSchedule(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleAction = async (campaignId: string, action: string) => {
    if (action === "view") {
      router.push(`/dashboard/campaigns/${campaignId}`);
      return;
    }

    setActionLoading(`${campaignId}-${action}`);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const loadingSpinner = (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/50 py-20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
        <Inbox className="h-8 w-8 text-amber-400" />
      </div>
      <h3 className="text-lg font-semibold text-neutral-200">
        No campaigns yet
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        Create your first campaign to start reaching your audience.
      </p>
      <Link
        href="/dashboard/campaigns/new"
        className="mt-6 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
      >
        <Plus className="h-4 w-4" />
        Create Campaign
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
            Campaigns
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Manage and monitor your WhatsApp campaigns.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-lg hover:shadow-amber-500/20"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </header>

      {loading ? (
        loadingSpinner
      ) : campaigns.length === 0 ? (
        emptyState
      ) : (
        <div className="luxury-card luxury-card-glow overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Name
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Type
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Scheduled
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Created
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {campaigns.map((campaign) => {
                  const statusConfig = STATUS_CONFIG[campaign.status];
                  const actions = ACTIONS[campaign.status];

                  return (
                    <tr
                      key={campaign.id}
                      className="group transition-colors hover:bg-neutral-800/40"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-100">
                            {campaign.name}
                          </span>
                          {campaign.description && (
                            <span className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                              {campaign.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-neutral-400">
                          <Send className="h-3.5 w-3.5 text-neutral-600" />
                          <span>{campaign.templateName ?? "General"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-neutral-400">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-neutral-600" />
                          {formatSchedule(campaign.scheduledAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-neutral-500">
                        {formatDate(campaign.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {actions.start && (
                            <button
                              onClick={() => handleAction(campaign.id, "start")}
                              disabled={actionLoading !== null}
                              title="Start"
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
                            >
                              {actionLoading === `${campaign.id}-start` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {actions.pause && (
                            <button
                              onClick={() => handleAction(campaign.id, "pause")}
                              disabled={actionLoading !== null}
                              title="Pause"
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-50"
                            >
                              {actionLoading === `${campaign.id}-pause` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Pause className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {actions.resume && (
                            <button
                              onClick={() => handleAction(campaign.id, "resume")}
                              disabled={actionLoading !== null}
                              title="Resume"
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
                            >
                              {actionLoading === `${campaign.id}-resume` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {actions.stop && (
                            <button
                              onClick={() => handleAction(campaign.id, "stop")}
                              disabled={actionLoading !== null}
                              title="Stop"
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                            >
                              {actionLoading === `${campaign.id}-stop` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {actions.view && (
                            <button
                              onClick={() => handleAction(campaign.id, "view")}
                              disabled={actionLoading !== null}
                              title="View Details"
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-amber-400 disabled:opacity-50"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
