
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Clock,
  AlertTriangle,
  Bell,
  Eye,
  Power,
} from "lucide-react";

import api, { errMsg } from "../api";

// =====================================
// HELPERS
// =====================================

const emptyForm = {
  title: "",
  description: "",
  priority: "Normal",
  status: "Draft",
  expiresAt: "",
};

const formatDate = (date) => {
  if (!date) return "No expiry";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getArray = (data) => {
  if (Array.isArray(data)) return data;
  return data?.announcements || [];
};

const getPriorityStyle = (priority) => {
  switch (priority) {
    case "Urgent":
      return "bg-red-50 text-red-700 border-red-200";
    case "High":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
};

const getStatusStyle = (status) => {
  switch (status) {
    case "Published":
      return "bg-green-50 text-green-700";
    case "Draft":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

// =====================================
// MAIN COMPONENT
// =====================================

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  const [form, setForm] = useState(emptyForm);

  // =====================================
  // LOAD ANNOUNCEMENTS
  // =====================================

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/announcements");

      setAnnouncements(getArray(response.data));
    } catch (err) {
      console.error("Announcement loading error:", err);
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // =====================================
  // SUMMARY
  // =====================================

  const summary = useMemo(() => {
    return {
      total: announcements.length,
      published: announcements.filter(
        (item) => item.status === "Published"
      ).length,
      drafts: announcements.filter(
        (item) => item.status === "Draft"
      ).length,
      inactive: announcements.filter(
        (item) => item.status === "Inactive"
      ).length,
    };
  }, [announcements]);

  // =====================================
  // FILTER ANNOUNCEMENTS
  // =====================================

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return announcements.filter((item) => {
      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.priority?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [announcements, search, statusFilter]);

  // =====================================
  // FORM HELPERS
  // =====================================

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingAnnouncement(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (announcement) => {
    setEditingAnnouncement(announcement);

    setForm({
      title: announcement.title || "",
      description: announcement.description || "",
      priority: announcement.priority || "Normal",
      status: announcement.status || "Draft",
      expiresAt: announcement.expiresAt
        ? new Date(announcement.expiresAt)
            .toISOString()
            .slice(0, 10)
        : "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingAnnouncement(null);
    setForm(emptyForm);
    setError("");
  };

  // =====================================
  // VALIDATE FORM
  // =====================================

  const validateForm = () => {
    if (!form.title.trim()) {
      return "Announcement title is required.";
    }

    if (form.title.trim().length > 150) {
      return "Title cannot exceed 150 characters.";
    }

    if (!form.description.trim()) {
      return "Announcement description is required.";
    }

    if (
      !["Urgent", "High", "Normal"].includes(form.priority)
    ) {
      return "Please select a valid priority.";
    }

    if (
      !["Draft", "Published", "Inactive"].includes(form.status)
    ) {
      return "Please select a valid status.";
    }

    if (form.expiresAt) {
      const expiry = new Date(`${form.expiresAt}T23:59:59`);

      if (Number.isNaN(expiry.getTime())) {
        return "Please select a valid expiry date.";
      }

      if (
        form.status === "Published" &&
        expiry <= new Date()
      ) {
        return "Expiry date must be in the future.";
      }
    }

    return "";
  };

  // =====================================
  // SAVE ANNOUNCEMENT
  // =====================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      status: form.status,
      expiresAt: form.expiresAt || null,
    };

    setSaving(true);

    try {
      if (editingAnnouncement) {
        await api.put(
          `/announcements/${editingAnnouncement._id}`,
          payload
        );

        setSuccess("Announcement updated successfully.");
      } else {
        await api.post("/announcements", payload);

        setSuccess("Announcement created successfully.");
      }

      setShowForm(false);
      setEditingAnnouncement(null);
      setForm(emptyForm);

      await loadAnnouncements();
    } catch (err) {
      console.error("Announcement save error:", err);
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // =====================================
  // DEACTIVATE ANNOUNCEMENT
  // =====================================

  const deactivateAnnouncement = async (announcement) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${announcement.title}"?`
    );

    if (!confirmed) return;

    setActionLoading(announcement._id);
    setError("");
    setSuccess("");

    try {
      await api.patch(
        `/announcements/${announcement._id}/deactivate`
      );

      setSuccess("Announcement deactivated successfully.");

      await loadAnnouncements();
    } catch (err) {
      console.error("Announcement deactivation error:", err);
      setError(errMsg(err));
    } finally {
      setActionLoading("");
    }
  };

  // =====================================
  // UI
  // =====================================

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
            <Megaphone size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Announcement Management
            </h1>

            <p className="text-sm text-slate-500">
              Create and manage company announcements for employees.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadAnnouncements}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={17} />
            Add Announcement
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && !showForm && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {success}

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Total Announcements",
            value: summary.total,
            icon: Bell,
            color: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "Published",
            value: summary.published,
            icon: CheckCircle2,
            color: "bg-green-50 text-green-600",
          },
          {
            label: "Drafts",
            value: summary.drafts,
            icon: Clock,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "Inactive",
            value: summary.inactive,
            icon: Power,
            color: "bg-slate-100 text-slate-600",
          },
        ].map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500 sm:text-sm">
                    {card.label}
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-slate-800">
                    {loading ? "—" : card.value}
                  </h2>
                </div>

                <div className={`rounded-xl p-3 ${card.color}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FORM */}

      {showForm && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editingAnnouncement
                  ? "Edit Announcement"
                  : "Create Announcement"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter the announcement details and publishing status.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* TITLE */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Announcement Title *
              </label>

              <input
                type="text"
                maxLength={150}
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Enter announcement title"
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <p className="mt-1 text-right text-xs text-slate-400">
                {form.title.length}/150
              </p>
            </div>

            {/* DESCRIPTION */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Description *
              </label>

              <textarea
                rows={5}
                value={form.description}
                onChange={(e) =>
                  updateField("description", e.target.value)
                }
                placeholder="Write the announcement details..."
                required
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* PRIORITY, STATUS AND EXPIRY */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Priority
                </label>

                <select
                  value={form.priority}
                  onChange={(e) =>
                    updateField("priority", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Status
                </label>

                <select
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="Draft">Save as Draft</option>
                  <option value="Published">Publish Now</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Expiry Date
                </label>

                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    updateField("expiresAt", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Optional
                </p>
              </div>
            </div>

            {/* PREVIEW */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Eye size={16} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">
                  Priority Preview
                </span>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityStyle(form.priority)}`}
              >
                {form.priority === "Urgent" && (
                  <AlertTriangle size={13} />
                )}
                {form.priority}
              </span>

              <p className="mt-2 text-sm text-slate-500">
                {form.status === "Published"
                  ? "This announcement will be visible to employees."
                  : form.status === "Draft"
                    ? "This announcement will remain hidden until published."
                    : "This announcement will be hidden from employees."}
              </p>
            </div>

            {/* ACTIONS */}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving && (
                  <RefreshCw size={16} className="animate-spin" />
                )}

                {saving
                  ? "Saving..."
                  : editingAnnouncement
                    ? "Update Announcement"
                    : "Save Announcement"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEARCH AND FILTER */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">
              All Announcements
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Manage published announcements, drafts and archived notices.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search announcements..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 sm:w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* TABLE */}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <RefreshCw size={18} className="animate-spin" />
            Loading announcements...
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Megaphone size={25} />
            </div>

            <h3 className="font-semibold text-slate-700">
              No announcements found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {search || statusFilter !== "All"
                ? "Try changing your search or filter."
                : "Create your first company announcement."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Announcement</th>
                    <th className="px-5 py-3 font-semibold">Priority</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Published</th>
                    <th className="px-5 py-3 font-semibold">Expires</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAnnouncements.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/70">
                      <td className="max-w-sm px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {item.title}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {item.description}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityStyle(item.priority)}`}
                        >
                          {item.priority === "Urgent" && (
                            <AlertTriangle size={13} />
                          )}
                          {item.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(item.publishedAt)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={14} className="text-slate-400" />
                          {formatDate(item.expiresAt)}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          {item.status !== "Inactive" && (
                            <button
                              type="button"
                              onClick={() => deactivateAnnouncement(item)}
                              disabled={actionLoading === item._id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {actionLoading === item._id ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <Power size={14} />
                              )}
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Showing {filteredAnnouncements.length} of {announcements.length} announcements
            </div>
          </>
        )}
      </div>

      {/* INFORMATION */}

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Bell size={18} className="mt-0.5 shrink-0" />

        <p>
          <strong>Note:</strong> Only published and non-expired announcements
          are visible to employees and managers. Draft and inactive
          announcements remain available to HR.
        </p>
      </div>
    </div>
  );
}
