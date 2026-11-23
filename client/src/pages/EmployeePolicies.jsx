
import { useEffect, useState } from "react";
import {
  BookOpen,
  FileText,
  Search,
  RefreshCw,
  CalendarDays,
  Download,
  Eye,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

import api, { errMsg } from "../api";

const formatDate = (date) => {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function EmployeePolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [documentLoading, setDocumentLoading] = useState("");

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/policies/employee");

      setPolicies(
        Array.isArray(response.data?.policies)
          ? response.data.policies
          : []
      );
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const filteredPolicies = policies.filter((policy) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      policy.title?.toLowerCase().includes(query) ||
      policy.description?.toLowerCase().includes(query) ||
      policy.category?.toLowerCase().includes(query) ||
      policy.content?.toLowerCase().includes(query)
    );
  });

  const handleDocument = async (policy, download = false) => {
    let newTab = null;

    // Open a tab immediately during the click to avoid popup blocking.
    if (!download) {
      newTab = window.open("about:blank", "_blank");

      if (!newTab) {
        setError("Please allow pop-ups to view the policy PDF.");
        return;
      }

      newTab.document.title = "Loading policy document...";
      newTab.document.body.innerHTML =
        "<p style='font-family:Arial;padding:24px'>Loading policy document...</p>";
    }

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
      } else if (newTab && !newTab.closed) {
        newTab.location.href = url;
      }

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      if (newTab && !newTab.closed) {
        newTab.close();
      }

      setError(
        err.response?.data?.message ||
          "Unable to access the policy document."
      );
    } finally {
      setDocumentLoading("");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Company Policies
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              View company rules, guidelines and official documents.
            </p>
          </div>
        </div>

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
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />

          <span className="flex-1">{error}</span>

          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* SEARCH */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policies by title, category or content..."
          className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* POLICY COUNT */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">
            Available Policies
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            {filteredPolicies.length} policies available
          </p>
        </div>
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="flex justify-center rounded-xl border bg-white py-16 text-sm text-gray-500">
          <RefreshCw size={19} className="mr-2 animate-spin" />
          Loading company policies...
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <BookOpen size={28} />
          </div>

          <h3 className="mt-4 font-semibold text-gray-800">
            No policies available
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {search
              ? "Try another search term."
              : "Company policies published by HR will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredPolicies.map((policy) => (
            <article
              key={policy._id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 p-3 text-indigo-700">
                    <FileText size={23} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-gray-900">
                      {policy.title}
                    </h3>

                    <p className="mt-1 text-xs font-medium text-indigo-600">
                      {policy.category}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Published
                </span>
              </div>

              <div className="space-y-4 p-5">
                {policy.description && (
                  <p className="text-sm leading-6 text-gray-600">
                    {policy.description}
                  </p>
                )}

                {policy.content && (
                  <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm leading-7 text-gray-700">
                    {policy.content}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CalendarDays size={15} />
                  Effective from: {formatDate(policy.effectiveDate)}
                </div>

                {policy.attachment?.filePath && (
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText
                        size={20}
                        className="shrink-0 text-red-500"
                      />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {policy.attachment.fileName || "Policy PDF"}
                        </p>

                        <p className="text-xs text-gray-500">
                          PDF document
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleDocument(policy)}
                        disabled={documentLoading === policy._id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <Eye size={15} />
                        View
                      </button>

                      <button
                        onClick={() => handleDocument(policy, true)}
                        disabled={documentLoading === policy._id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Download size={15} />
                        Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
