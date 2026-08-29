"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ArrowLeft,
  FileText,
  Loader2,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), body }),
      });
      if (res.ok) {
        setName("");
        setBody("");
        setShowCreate(false);
        fetchTemplates();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteId(null);
        fetchTemplates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
            Message Templates
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Reusable message bodies for your campaigns.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/50 py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <FileText className="h-8 w-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-200">
            No templates yet
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Create a template to speed up campaign creation.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group relative rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition-all hover:border-amber-500/40"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-neutral-100">{t.name}</h3>
                </div>
                <button
                  onClick={() => setDeleteId(t.id)}
                  className="rounded-md p-1.5 text-neutral-600 transition-colors hover:bg-neutral-800 hover:text-red-400"
                  aria-label="Delete template"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm text-neutral-400">
                {t.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-neutral-100">
              Create Template
            </h2>
            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Summer Promo"
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300">
                  Message Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Hi {name}, here is our special offer…"
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteId(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-100">
                  Delete Template
                </h3>
                <p className="text-sm text-neutral-400">
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
