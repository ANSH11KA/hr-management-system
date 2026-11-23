
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Power,
  X,
  FileText,
  FileUp,
  Download,
  Eye,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  Clock,
  Filter,
  Upload,
} from "lucide-react";

import api, { errMsg } from "../api";

const CATEGORIES = [
  "HR Policies",
  "Leave",
  "Attendance",
  "Code of Conduct",
  "IT & Security",
  "Payroll",
  "Other",
];

const emptyForm = {
  title: "",
  description: "",
  content: "",
  category: "Other",
  effectiveDate: "",
  status: "Draft",
};

const formatDate = (date) => {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusStyle = (status) => {
  const styles = {
    Published: "bg-green-100 text-green-700",
    Draft: "bg-amber-100 text-amber-700",
    Inactive: "bg-gray-100 text-gray-600",
  };

  return styles[status] || styles.Draft;
};

const getPolicies = (response) => {
  return Array.isArray(response.data?.policies)
    ? response.data.policies
    : [];
};

export default function Policies() {
  const fileInputRef = useRef(null);

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [documentLoading, setDocumentLoading] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState(null);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/policies");
      setPolicies(getPolicies(response));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const stats = useMemo(() => {
    return {
      total: policies.length,
      published: policies.filter((p) => p.status === "Published").length,
      drafts: policies.filter((p) => p.status === "Draft").length,
      inactive: policies.filter((p) => p.status === "Inactive").length,
    };
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    const query = search.trim().toLowerCase();

    return policies.filter((policy) => {
      const matchesSearch =
        !query ||
        policy.title?.toLowerCase().includes(query) ||
        policy.description?.toLowerCase().includes(query) ||
        policy.category?.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "All" ||
        policy.category === categoryFilter;

      const matchesStatus =
        statusFilter === "All" ||
        policy.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [policies, search, categoryFilter, statusFilter]);

  const openCreateForm = () => {
    setEditingPolicy(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setError("");
    setSuccess("");
    setShowForm(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openEditForm = (policy) => {
    setEditingPolicy(policy);

    setForm({
      title: policy.title || "",
      description: policy.description || "",
      content: policy.content || "",
      category: policy.category || "Other",
      effectiveDate: policy.effectiveDate
        ? new Date(policy.effectiveDate).toISOString().slice(0, 10)
        : "",
      status: policy.status || "Draft",
    });

    setSelectedFile(null);
    setError("");
    setSuccess("");
    setShowForm(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingPolicy(null);
    setForm(emptyForm);
    setSelectedFile(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a valid PDF file.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("PDF size must not exceed 5 MB.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setError("");
    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Please enter a policy title.");
      return;
    }

    if (!form.content.trim() && !selectedFile) {
      const hasExistingPdf =
        Boolean(editingPolicy?.attachment?.filePath);

      if (!hasExistingPdf) {
        setError("Please enter policy content or upload a PDF.");
        return;
      }
    }

    if (form.title.trim().length > 180) {
      setError("Policy title cannot exceed 180 characters.");
      return;
    }

    if (form.description.length > 500) {
      setError("Description cannot exceed 500 characters.");
      return;
    }

    const formData = new FormData();

    formData.append("title", form.title.trim());
    formData.append("description", form.description.trim());
    formData.append("content", form.content.trim());
    formData.append("category", form.category);
    formData.append("status", form.status);

    if (form.effectiveDate) {
      formData.append("effectiveDate", form.effectiveDate);
    } else {
      formData.append("effectiveDate", "");
    }

    if (selectedFile) {
      formData.append("document", selectedFile);
    }

    try {
      setSaving(true);

      if (editingPolicy) {
        await api.put(
          `/policies/${editingPolicy._id}`,
          formData
        );

        setSuccess("Policy updated successfully.");
      } else {
        await api.post("/policies", formData);

        setSuccess("Policy created successfully.");
      }

      setShowForm(false);
      setEditingPolicy(null);
      setForm(emptyForm);
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadPolicies();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const deactivatePolicy = async (policy) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${policy.title}"? Employees will no longer be able to view it.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(policy._id);
      setError("");
      setSuccess("");

      await api.patch(
        `/policies/${policy._id}/deactivate`
      );

      setSuccess("Policy deactivated successfully.");

      await loadPolicies();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setActionLoading("");
    }
  };

  const openDocument = async (policy, download = false) => {
    try {
      setDocumentLoading(policy._id);
      setError("");

      const response = await api.get(
        `/policies/${policy._id}/document`,
        {
          params: download ? { download: "true" } : {},
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const url = window.URL.createObjectURL(blob);

      if (download) {
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download =
          policy.attachment?.fileName || "policy.pdf";

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to open the policy document."
      );
    } finally {
      setDocumentLoading("");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
              <ShieldCheck size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Company Policies
              </h1>

              <p className="text-sm text-gray-500">
                Create, manage and publish company policies.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadPolicies}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus size={18} />
            Create Policy
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />

          <div className="flex-1">{error}</div>

          <button
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={19} />
          {success}

          <button
            onClick={() => setSuccess("")}
            className="ml-auto"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Total Policies",
            value: stats.total,
            icon: BookOpen,
            color: "indigo",
          },
          {
            label: "Published",
            value: stats.published,
            icon: ShieldCheck,
            color: "green",
          },
          {
            label: "Drafts",
            value: stats.drafts,
            icon: Clock,
            color: "amber",
          },
          {
            label: "Inactive",
            value: stats.inactive,
            icon: FileText,
            color: "gray",
          },
        ].map((item) => {
          const Icon = item.icon;

          const colors = {
            indigo: "bg-indigo-100 text-indigo-700",
            green: "bg-green-100 text-green-700",
            amber: "bg-amber-100 text-amber-700",
            gray: "bg-gray-100 text-gray-600",
          };

          return (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {item.label}
                </p>

                <div className={`rounded-lg p-2 ${colors[item.color]}`}>
                  <Icon size={19} />
                </div>
              </div>

              <p className="mt-3 text-2xl font-bold text-gray-900">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* POLICY FORM */}
      {showForm && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPolicy ? "Edit Policy" : "Create New Policy"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Add policy information and optionally attach a PDF.
              </p>
            </div>

            <button
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            <div className="grid gap-5 md:grid-cols-2">
              {/* TITLE */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Policy Title <span className="text-red-500">*</span>
                </label>

                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  maxLength={180}
                  placeholder="e.g. Employee Attendance Policy"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* CATEGORY */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Category
                </label>

                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* STATUS */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* EFFECTIVE DATE */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Effective Date
                </label>

                <input
                  type="date"
                  name="effectiveDate"
                  value={form.effectiveDate}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              {/* DESCRIPTION */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Short Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  maxLength={500}
                  rows={2}
                  placeholder="Briefly explain what this policy covers..."
                  className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />

                <p className="mt-1 text-right text-xs text-gray-400">
                  {form.description.length}/500
                </p>
              </div>

              {/* POLICY CONTENT */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Policy Content
                </label>

                <textarea
                  name="content"
                  value={form.content}
                  onChange={handleChange}
                  rows={10}
                  placeholder="Write the complete company policy here..."
                  className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm leading-6 outline-none focus:border-indigo-500"
                />

                <p className="mt-1 text-xs text-gray-500">
                  You can write the policy here or upload a PDF below.
                  Both options can be used together.
                </p>
              </div>

              {/* PDF UPLOAD */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Attach Policy PDF
                </label>

                <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="policy-document"
                  />

                  <label
                    htmlFor="policy-document"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
                  >
                    <div className="rounded-full bg-indigo-100 p-3 text-indigo-700">
                      <FileUp size={25} />
                    </div>

                    <span className="text-sm font-semibold text-gray-800">
                      Click to upload a PDF
                    </span>

                    <span className="text-xs text-gray-500">
                      PDF only · Maximum file size 5 MB
                    </span>
                  </label>

                  {selectedFile && (
                    <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-200 bg-white p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="shrink-0 text-red-500" size={22} />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {selectedFile.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);

                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}

                  {!selectedFile &&
                    editingPolicy?.attachment?.filePath && (
                      <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="shrink-0 text-red-500" size={21} />

                          <span className="truncate text-sm text-gray-700">
                            Existing: {editingPolicy.attachment.fileName}
                          </span>
                        </div>

                        <span className="text-xs font-medium text-green-600">
                          Attached
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-200 pt-5 sm:flex-row">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    {editingPolicy ? "Update Policy" : "Save Policy"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search policies..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="relative">
            <Filter
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
            >
              <option value="All">All Categories</option>

              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          >
            <option value="All">All Statuses</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* POLICIES TABLE */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-gray-900">
              All Company Policies
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              {filteredPolicies.length} policies found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <RefreshCw size={19} className="animate-spin" />
            Loading policies...
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="rounded-full bg-gray-100 p-4 text-gray-400">
              <BookOpen size={30} />
            </div>

            <h3 className="mt-4 font-semibold text-gray-800">
              No policies found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Create a policy or change your search filters.
            </p>

            <button
              onClick={openCreateForm}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={16} />
              Create Policy
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Policy</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Effective Date</th>
                  <th className="px-5 py-3 font-semibold">Document</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredPolicies.map((policy) => (
                  <tr
                    key={policy._id}
                    className="hover:bg-gray-50/70"
                  >
                    <td className="max-w-[300px] px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {policy.title}
                      </p>

                      <p className="mt-1 truncate text-xs text-gray-500">
                        {policy.description || "No description provided"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {policy.category}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <CalendarDays size={15} />
                        {formatDate(policy.effectiveDate)}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {policy.attachment?.filePath ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                          <FileText size={16} />
                          PDF attached
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Text only
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                          policy.status
                        )}`}
                      >
                        {policy.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        {policy.attachment?.filePath && (
                          <>
                            <button
                              onClick={() => openDocument(policy)}
                              disabled={documentLoading === policy._id}
                              title="View PDF"
                              className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                            >
                              <Eye size={17} />
                            </button>

                            <button
                              onClick={() => openDocument(policy, true)}
                              disabled={documentLoading === policy._id}
                              title="Download PDF"
                              className="rounded-lg p-2 text-gray-500 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
                            >
                              <Download size={17} />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => openEditForm(policy)}
                          title="Edit policy"
                          className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <Pencil size={17} />
                        </button>

                        {policy.status !== "Inactive" && (
                          <button
                            onClick={() => deactivatePolicy(policy)}
                            disabled={actionLoading === policy._id}
                            title="Deactivate policy"
                            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Power size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FOOTER NOTE */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
        <ShieldCheck size={19} className="mt-0.5 shrink-0" />

        <p>
          Published policies become visible to employees and managers
          when their effective date arrives. Draft and inactive policies
          remain available only to HR/Admin.
        </p>
      </div>
    </div>
  );
}
