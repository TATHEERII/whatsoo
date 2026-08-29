import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Users,
  BarChart3,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [
    campaigns,
    contactCount,
    totalLogs,
    sentLogs,
    failedLogs,
    byStatus,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: { userId },
      include: {
        contactList: { select: { name: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.contact.count({ where: { userId } }),
    prisma.campaignLog.count({ where: { campaign: { userId } } }),
    prisma.campaignLog.count({ where: { campaign: { userId }, status: "sent" } }),
    prisma.campaignLog.count({ where: { campaign: { userId }, status: "failed" } }),
    prisma.campaign.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const successRate =
    totalLogs > 0 ? ((sentLogs / totalLogs) * 100).toFixed(1) : "0.0";

  const statusCounts = Object.fromEntries(
    byStatus.map((s) => [s.status, s._count._all])
  );

  const cards = [
    {
      label: "Campaigns",
      value: campaigns.length.toLocaleString(),
      icon: Send,
      hint: `${statusCounts["running"] ?? 0} running`,
    },
    {
      label: "Contacts",
      value: contactCount.toLocaleString(),
      icon: Users,
      hint: "Total audience",
    },
    {
      label: "Messages Sent",
      value: sentLogs.toLocaleString(),
      icon: CheckCircle2,
      hint: `${totalLogs.toLocaleString()} attempts`,
    },
    {
      label: "Delivery Rate",
      value: `${successRate}%`,
      icon: TrendingUp,
      hint: `${failedLogs} failed`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-amber-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
          Analytics
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Delivery performance across all your campaigns.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, hint }) => (
          <div
            key={label}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm text-neutral-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-100">
              {value}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{hint}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-100">
            Campaign Breakdown
          </h2>
        </div>

        {campaigns.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            No campaigns yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Messages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {campaigns.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-neutral-800/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/campaigns/${c.id}`}
                        className="font-medium text-neutral-100 hover:text-amber-400"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {c.contactList?.name ?? "No list"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-lg border border-neutral-700 bg-neutral-800/50 px-2.5 py-1 text-xs capitalize text-neutral-300">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {c.contactList?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      {c._count.logs}
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
