"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Send,
  Calendar,
  Users,
  FileText,
  Clock,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

const campaignSchema = z.object({
  name: z.string().min(2, "Campaign name must be at least 2 characters"),
  description: z.string().optional(),
  contactListId: z.string().min(1, "Select a contact list"),
  templateId: z.string().optional(),
  message: z.string().min(1, "Message body is required"),
  delayType: z.enum(["fixed", "random", "progressive"]),
  delayValue: z.coerce.number().int().min(1000, "Min 1000ms").max(600000),
  maxAttempts: z.coerce.number().int().min(1, "Min 1").max(10),
  scheduledAt: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface ContactList {
  id: string;
  name: string;
  contactCount: number;
}

interface Template {
  id: string;
  name: string;
  body: string;
}

export default function NewCampaignPage() {
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema) as Resolver<CampaignFormData>,
    defaultValues: {
      name: "",
      description: "",
      contactListId: "",
      templateId: "",
      message: "",
      delayType: "fixed",
      delayValue: 5000,
      maxAttempts: 3,
      scheduledAt: "",
    },
  });

  const selectedTemplateId = watch("templateId");
  const messageValue = watch("message");

  const fetchData = useCallback(async () => {
    try {
      const [listsRes, templatesRes] = await Promise.all([
        fetch("/api/contact-lists"),
        fetch("/api/templates"),
      ]);
      if (listsRes.ok) setContactLists(await listsRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSelectTemplate = (id: string) => {
    setValue("templateId", id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setValue("message", tpl.body);
    }
  };

  const onSubmit = async (data: CampaignFormData) => {
    setSubmitting(true);
    try {
      const selectedTemplate = templates.find((t) => t.id === data.templateId);
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          message: data.message,
          contactListId: data.contactListId,
          templateId: data.templateId || null,
          templateName: selectedTemplate?.name ?? null,
          delayType: data.delayType,
          delayValue: data.delayValue,
          maxAttempts: data.maxAttempts,
          scheduledAt: data.scheduledAt || null,
        }),
      });

      if (res.ok) {
        setSubmitSuccess(true);
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
            <Send className="h-6 w-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-100">
            Campaign Created
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Your WhatsApp campaign has been created. Start it from the campaigns
            list when you&apos;re ready.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard/campaigns"
              className="flex items-center gap-2 rounded-xl border border-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            >
              View Campaigns
            </Link>
            <button
              onClick={() => setSubmitSuccess(false)}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-10">
        <Link
          href="/dashboard/campaigns"
          className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-amber-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
          New Campaign
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Create a new WhatsApp campaign to reach your audience.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                Campaign Details
              </h2>
              <p className="text-xs text-neutral-500">
                Basic information about your campaign
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Campaign Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register("name")}
                placeholder="e.g., Summer Sale 2024"
                className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              />
              {errors.name && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Description
              </label>
              <textarea
                {...register("description")}
                placeholder="Brief description of the campaign..."
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                Audience
              </h2>
              <p className="text-xs text-neutral-500">
                Select the contact list to target
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Contact List <span className="text-red-400">*</span>
            </label>
            {loadingLists ? (
              <div className="mt-1.5 flex items-center gap-2 text-sm text-neutral-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                Loading contact lists...
              </div>
            ) : (
              <>
                <select
                  {...register("contactListId")}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                >
                  <option value="">Select a contact list</option>
                  {contactLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.contactCount} contacts)
                    </option>
                  ))}
                </select>
                {contactLists.length === 0 && (
                  <p className="mt-1.5 text-xs text-neutral-600">
                    No contact lists available.{" "}
                    <Link
                      href="/dashboard/contacts"
                      className="text-amber-400 hover:underline"
                    >
                      Create one first
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
            {errors.contactListId && (
              <p className="mt-1.5 text-xs text-red-400">
                {errors.contactListId.message}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                Message
              </h2>
              <p className="text-xs text-neutral-500">
                The text sent to each contact
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Use Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => onSelectTemplate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              >
                <option value="">Write a custom message</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Message Body <span className="text-red-400">*</span>
              </label>
              <textarea
                {...register("message")}
                rows={5}
                placeholder="Hi there, check out our latest offer…"
                className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              />
              <p className="mt-1.5 text-xs text-neutral-600">
                {messageValue?.length ?? 0} characters
              </p>
              {errors.message && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.message.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                Delivery & Schedule
              </h2>
              <p className="text-xs text-neutral-500">
                Tune delays to avoid spam detection
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Delay Strategy
              </label>
              <select
                {...register("delayType")}
                className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              >
                <option value="fixed">Fixed interval</option>
                <option value="random">Random interval</option>
                <option value="progressive">Progressive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Delay Value (ms)
              </label>
              <input
                type="number"
                {...register("delayValue")}
                className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              />
              {errors.delayValue && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.delayValue.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Max Attempts
              </label>
              <input
                type="number"
                {...register("maxAttempts")}
                className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              />
              {errors.maxAttempts && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.maxAttempts.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-neutral-300">
              Schedule (optional)
            </label>
            <div className="mt-1.5 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-neutral-600" />
              <input
                type="datetime-local"
                {...register("scheduledAt")}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              />
            </div>
            <p className="mt-1.5 text-xs text-neutral-600">
              Leave empty to save as draft without scheduling.
            </p>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/campaigns"
            className="rounded-xl border border-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Create Campaign
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
