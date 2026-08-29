import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  Send,
  Users,
  MessageSquare,
  BarChart3,
  Plus,
  Upload,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [
    activeCampaigns,
    totalContacts,
    sentMessages,
    totalLogs,
  ] = await Promise.all([
    prisma.campaign.count({
      where: {
        userId: userId!,
        status: { in: ["running", "paused", "scheduled"] },
      },
    }),
    prisma.contact.count({ where: { userId: userId! } }),
    prisma.campaignLog.count({
      where: { campaign: { userId: userId! }, status: "sent" },
    }),
    prisma.campaignLog.count({ where: { campaign: { userId: userId! } } }),
  ]);

  const deliveryRate =
    totalLogs > 0 ? ((sentMessages / totalLogs) * 100).toFixed(1) : "0.0";

  const stats = [
    { label: "Active Campaigns", value: String(activeCampaigns), icon: Send, delta: "In progress" },
    { label: "Total Contacts", value: totalContacts.toLocaleString(), icon: Users, delta: "Imported" },
    {
      label: "Messages Sent",
      value: sentMessages.toLocaleString(),
      icon: MessageSquare,
      delta: "Delivered attempts",
    },
    {
      label: "Delivery Rate",
      value: `${deliveryRate}%`,
      icon: BarChart3,
      delta: "Across all campaigns",
    },
  ];

  const quickActions = [
    { label: "New Campaign", href: "/dashboard/campaigns/new", icon: Plus },
    { label: "Import Contacts", href: "/dashboard/contacts", icon: Upload },
    { label: "View Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  ];

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Here&apos;s what&apos;s happening with your WhatsApp campaigns today.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, delta }) => (
          <div
            key={label}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-amber-500/40"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm text-neutral-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-100">
              {value}
            </p>
            <p className="mt-1 text-xs text-amber-500/80">{delta}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-sm font-medium text-neutral-200 transition-colors hover:border-amber-500/40 hover:text-amber-400"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
