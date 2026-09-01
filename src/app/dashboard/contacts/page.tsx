"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Users,
  Plus,
  Trash2,
  Upload,
  X,
  FileText,
} from "lucide-react";

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ContactPreview {
  name: string;
  phoneNumber: string;
  email: string;
}

export default function ContactsPage() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ContactList | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<ContactPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: { phone: string; reason: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch("/api/contact-lists");
      if (res.ok) {
        const data = await res.json();
        setLists(data);
      }
    } catch (error) {
      console.error("Failed to fetch contact lists:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await fetch("/api/contact-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newListName.trim(),
          description: newListDescription.trim() || null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewListName("");
        setNewListDescription("");
        fetchLists();
      }
    } catch (error) {
      console.error("Failed to create list:", error);
    }
  };

  const handleDeleteList = async () => {
    if (!deleteConfirm) return;

    try {
      const res = await fetch(`/api/contact-lists/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchLists();
      }
    } catch (error) {
      console.error("Failed to delete list:", error);
    }
  };

  const parseCsv = (text: string): ContactPreview[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => ["name", "names", "full_name", "fullname", "contact_name", "contactname", "lead_name", "customer_name"].includes(h));
    const phoneIdx = headers.findIndex((h) =>
      ["phone", "phone_number", "phonenumber", "mobile", "whatsapp", "contact", "number"].includes(h)
    );
    const emailIdx = headers.findIndex((h) => ["email", "mail", "email_address", "emailaddress"].includes(h));

    const preview: ContactPreview[] = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      preview.push({
        name: nameIdx >= 0 ? values[nameIdx] || "" : "",
        phoneNumber: phoneIdx >= 0 ? values[phoneIdx] || "" : "",
        email: emailIdx >= 0 ? values[emailIdx] || "" : "",
      });
    }
    return preview;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvPreview(parseCsv(text));
    };
    reader.readAsText(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || !selectedList) return;

    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await fetch(`/api/contact-lists/${selectedList.id}/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult({ imported: data.imported, skipped: data.skipped || [] });
        fetchLists();
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const openUploadModal = (list: ContactList) => {
    setSelectedList(list);
    setCsvFile(null);
    setCsvPreview([]);
    setImportResult(null);
    setShowUploadModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
            Contacts
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Manage your contact lists and import audiences for campaigns.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-lg hover:shadow-amber-500/20"
        >
          <Plus className="h-4 w-4" />
          New List
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/50 py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <Users className="h-8 w-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-200">
            No contact lists yet
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Create your first list to start organizing contacts.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <Plus className="h-4 w-4" />
            Create List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <div
              key={list.id}
              className="group relative rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition-all hover:border-amber-500/40 hover:shadow-xl hover:shadow-black/20"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-100">
                      {list.name}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {list.contactCount} contacts
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setDeleteConfirm(list)}
                    className="rounded-md p-1.5 text-neutral-600 transition-colors hover:bg-neutral-800 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {list.description && (
                <p className="mt-4 line-clamp-2 text-sm text-neutral-400">
                  {list.description}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4">
                <span className="text-xs text-neutral-600">
                  Created {formatDate(list.createdAt)}
                </span>
                <button
                  onClick={() => openUploadModal(list)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-amber-400"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-100">
                Create Contact List
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateList} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300">
                  List Name
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., VIP Customers"
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300">
                  Description
                </label>
                <textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && selectedList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowUploadModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  Upload Contacts
                </h2>
                <p className="text-sm text-neutral-500">
                  Add contacts to <span className="text-amber-400">{selectedList.name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="mt-6 space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border border-dashed border-neutral-700 bg-neutral-950/50 p-8 text-center transition-colors hover:border-amber-500/40 hover:bg-neutral-950"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {csvFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-amber-400" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-neutral-200">
                        {csvFile.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {(csvFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto h-10 w-10 text-neutral-600" />
                    <p className="mt-2 text-sm text-neutral-400">
                      Click to upload a CSV file
                    </p>
                    <p className="text-xs text-neutral-600">
                      Columns: name, phone, email
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
                <p className="text-xs font-medium text-neutral-400 mb-2">Expected CSV Format:</p>
                <div className="rounded-lg bg-neutral-900 p-3 font-mono text-xs text-neutral-300 overflow-x-auto">
                  <p className="text-amber-400">name,phone,email</p>
                  <p>John Doe,+1234567890,john@example.com</p>
                  <p>Jane Smith,+0987654321,jane@example.com</p>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Phone number is required. Name and email are optional.
                </p>
              </div>

              {csvPreview.length > 0 && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 overflow-hidden">
                  <div className="border-b border-neutral-800 px-4 py-2">
                    <p className="text-xs font-medium text-neutral-400">
                      Preview (first {csvPreview.length} rows)
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500">
                          <th className="px-4 py-2 font-medium">Name</th>
                          <th className="px-4 py-2 font-medium">Phone</th>
                          <th className="px-4 py-2 font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((contact, idx) => (
                          <tr key={idx} className="border-b border-neutral-800/50 last:border-0">
                            <td className="px-4 py-2 text-neutral-300">
                              {contact.name || "-"}
                            </td>
                            <td className="px-4 py-2 text-neutral-300">
                              {contact.phoneNumber || "-"}
                            </td>
                            <td className="px-4 py-2 text-neutral-300">
                              {contact.email || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    Successfully imported {importResult.imported} contacts.
                  </div>
                  {importResult.skipped.length > 0 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 overflow-hidden">
                      <div className="border-b border-amber-500/20 px-4 py-2">
                        <p className="text-xs font-medium text-amber-400">
                          Skipped {importResult.skipped.length} contacts
                        </p>
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-amber-500/20 text-amber-400/70">
                              <th className="px-4 py-2 font-medium">Phone</th>
                              <th className="px-4 py-2 font-medium">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.skipped.map((item, idx) => (
                              <tr key={idx} className="border-b border-amber-500/10 last:border-0">
                                <td className="px-4 py-2 text-neutral-300">{item.phone}</td>
                                <td className="px-4 py-2 text-neutral-400">{item.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setImportResult(null);
                  }}
                  className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                >
                  {importResult ? "Close" : "Cancel"}
                </button>
                {!importResult && (
                  <button
                    type="submit"
                    disabled={!csvFile || uploading}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-neutral-900 transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? "Importing..." : "Import Contacts"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-100">
                  Delete List
                </h3>
                <p className="text-sm text-neutral-400">
                  Are you sure you want to delete &ldquo;{deleteConfirm.name}&rdquo;? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteList}
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
