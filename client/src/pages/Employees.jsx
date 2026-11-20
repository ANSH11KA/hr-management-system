
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Users,
  UserMinus,
  Clock,
  Eye,
  BriefcaseBusiness,
  Mail,
  Phone,
  MapPin,
  Building2,
  GraduationCap,
  CreditCard,
  ShieldCheck,
  Upload,
  FileText,
  UserRound,
  Filter,
  RotateCcw,
  Save,
  LoaderCircle,
  LayoutGrid,
  List,
} from "lucide-react";

import api, { errMsg } from "../api";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const emptyEducation = {
  qualification: "",
  institution: "",
  boardOrUniversity: "",
  specialization: "",
  passingYear: "",
  marks: "",
};

const emptyForm = {
  email: "",
  password: "",
  role: "employee",

  employeeId: "",
  phone: "",
  department: "",
  designation: "",
  joiningDate: "",
  employmentStatus: "active",
  employmentType: "Full-time",
  workLocation: "",
  probationMonths: "",
  salary: "",
  manager: "",

  personal: {
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    bloodGroup: "",
    maritalStatus: "",
    panNumber: "",
    aadhaarNumber: "",
    voterIdNumber: "",
    passportNumber: "",
  },

  contact: {
    personalEmail: "",
    alternatePhone: "",
    currentAddress: {
      addressLine: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
    },
    permanentAddress: {
      addressLine: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
    },
  },

  bank: {
    accountHolderName: "",
    bankName: "",
    branchName: "",
    branchAddress: "",
    accountNumber: "",
    ifscCode: "",
    accountType: "",
  },

  socialMedia: {
    facebook: "",
    linkedin: "",
    instagram: "",
    youtube: "",
  },

  emergencyContact: {
    name: "",
    relationship: "",
    phone: "",
    alternatePhone: "",
  },

  previousEmployment: {
    companyName: "",
    designation: "",
    experienceYears: "",
  },

  education: [{ ...emptyEducation }],
};

const emptyFilters = {
  department: "",
  status: "",
};

const FORM_TABS = [
  { id: "account", label: "Account", icon: ShieldCheck },
  { id: "personal", label: "Personal", icon: UserRound },
  { id: "employment", label: "Employment", icon: BriefcaseBusiness },
  { id: "contact", label: "Contact", icon: MapPin },
  { id: "bank", label: "Bank", icon: CreditCard },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "additional", label: "Additional", icon: FileText },
  { id: "documents", label: "Documents", icon: Upload },
];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50";

const labelClass = "block text-sm font-medium text-slate-700";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

const clone = value => JSON.parse(JSON.stringify(value));

const initials = name =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .map(word => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const getValue = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object) ?? "";

const setValue = (object, path, value) => {
  const updated = clone(object);
  const keys = path.split(".");
  let current = updated;

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
    } else {
      current[key] = current[key] || {};
      current = current[key];
    }
  });

  return updated;
};

const getEmployeeName = employee => {
  const personal = employee.personal || {};

  return [
    personal.firstName,
    personal.middleName,
    personal.lastName,
  ]
    .filter(Boolean)
    .join(" ") || employee.user?.name || "Unknown employee";
};

const normalizeEmployee = employee => {
  const personal = employee.personal || {};

  const education =
    Array.isArray(employee.education) && employee.education.length
      ? employee.education.map(item => ({
          qualification: item.qualification || "",
          institution: item.institution || "",
          boardOrUniversity: item.boardOrUniversity || "",
          specialization: item.specialization || "",
          passingYear: item.passingYear || "",
          marks: item.marks || "",
        }))
      : [{ ...emptyEducation }];

  return {
    ...clone(emptyForm),

    email: employee.user?.email || "",
    role: employee.user?.role || "employee",

    employeeId: employee.employeeId || "",
    phone: employee.phone || "",
    department: employee.department || "",
    designation: employee.designation || "",
    joiningDate: employee.joiningDate?.slice(0, 10) || "",
    employmentStatus: employee.employmentStatus || "active",
    employmentType: employee.employmentType || "Full-time",
    workLocation: employee.workLocation || "",
    probationMonths: employee.probationMonths ?? "",
    salary: employee.salary ?? "",
    manager: employee.manager?._id || employee.manager || "",

    personal: {
      ...clone(emptyForm.personal),
      ...personal,
      dateOfBirth: personal.dateOfBirth?.slice(0, 10) || "",
    },

    contact: {
      ...clone(emptyForm.contact),
      ...employee.contact,
      currentAddress: {
        ...clone(emptyForm.contact.currentAddress),
        ...employee.contact?.currentAddress,
      },
      permanentAddress: {
        ...clone(emptyForm.contact.permanentAddress),
        ...employee.contact?.permanentAddress,
      },
    },

    bank: {
      ...clone(emptyForm.bank),
      ...employee.bank,
    },

    socialMedia: {
      ...clone(emptyForm.socialMedia),
      ...employee.socialMedia,
    },

    emergencyContact: {
      ...clone(emptyForm.emergencyContact),
      ...employee.emergencyContact,
    },

    previousEmployment: {
      ...clone(emptyForm.previousEmployment),
      ...employee.previousEmployment,
    },

    education,
  };
};

// --------------------------------------------------
// FORM DATA
// --------------------------------------------------

const buildFormData = (form, files, editing) => {
  const formData = new FormData();

  const fields = [
    "employeeId",
    "phone",
    "department",
    "designation",
    "joiningDate",
    "employmentStatus",
    "manager",
    "employmentType",
    "workLocation",
    "probationMonths",
    "salary",
  ];

  if (!editing) {
    fields.push("email", "password", "role");
  }

  fields.forEach(key => {
    const value = form[key];

    if (value !== "" && value !== null && value !== undefined) {
      formData.append(key, value);
    } else if (editing && key === "manager") {
      formData.append(key, "");
    }
  });

  [
    "personal",
    "contact",
    "bank",
    "socialMedia",
    "emergencyContact",
    "previousEmployment",
  ].forEach(key => {
    formData.append(key, JSON.stringify(form[key]));
  });

  const education = form.education.filter(item =>
    Object.values(item).some(value => value !== "")
  );

  formData.append("education", JSON.stringify(education));

  if (files.profilePicture) {
    formData.append("profilePicture", files.profilePicture);
  }

  files.documents.forEach(file => {
    formData.append("documents", file);
  });

  if (files.documents.length) {
    formData.append(
      "documentTypes",
      JSON.stringify(
        files.documents.map(() => files.documentType || "Other")
      )
    );
  }

  return formData;
};

// --------------------------------------------------
// REUSABLE UI
// --------------------------------------------------

function SectionHeading({ title, description }) {
  return (
    <div className="mb-5 border-b border-slate-100 pb-4">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}

function StatCard({ title, value, description, icon: Icon, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </h3>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${colors[color]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, size = "md" }) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-xl",
  };

  return (
    <div
      className={`${sizes[size]} grid shrink-0 place-items-center rounded-2xl bg-indigo-100 font-bold text-indigo-700`}
    >
      {initials(name)}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  ...props
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      <input
        className={inputClass}
        type={type}
        value={value ?? ""}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        required={required}
        disabled={disabled}
        {...props}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      <select
        className={inputClass}
        value={value ?? ""}
        onChange={event => onChange(event.target.value)}
        required={required}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function Employees() {
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  const [data, setData] = useState({
    items: [],
    pages: 1,
    total: 0,
  });

  const [managers, setManagers] = useState([]);

  const [query, setQuery] = useState({
    search: "",
    department: "",
    status: "",
    page: 1,
  });

  const [searchInput, setSearchInput] = useState("");
  const [filterInput, setFilterInput] = useState(emptyFilters);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [modal, setModal] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewEmployee, setPreviewEmployee] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(clone(emptyForm));
  const [activeTab, setActiveTab] = useState("account");

  const [files, setFiles] = useState({
    profilePicture: null,
    documents: [],
    documentType: "Other",
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewMode, setViewMode] = useState("table");

  // ------------------------------------------------
  // FETCH EMPLOYEES
  // ------------------------------------------------

  useEffect(() => {
    let ignore = false;

    const fetchEmployees = async () => {
      setLoading(true);

      try {
        const params = Object.fromEntries(
          Object.entries(query).filter(([, value]) => value !== "")
        );

        const response = await api.get("/employees", { params });

        if (!ignore) {
          setData({
            items: response.data.items || [],
            pages: response.data.pages || 1,
            total: response.data.total || 0,
          });

          setError("");
        }
      } catch (err) {
        if (!ignore) setError(errMsg(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchEmployees();

    return () => {
      ignore = true;
    };
  }, [query, reloadKey]);

  // ------------------------------------------------
  // FETCH MANAGERS
  // ------------------------------------------------

  useEffect(() => {
    if (!isAdmin) return;

    let ignore = false;

    const fetchManagers = async () => {
      try {
        // Fetch every page so managers beyond the first page are available.
        const firstResponse = await api.get("/employees", {
          params: { page: 1, limit: 100 },
        });

        const allEmployees = [...(firstResponse.data.items || [])];
        const totalPages = Math.max(1, Number(firstResponse.data.pages) || 1);

        for (let page = 2; page <= totalPages; page += 1) {
          const response = await api.get("/employees", {
            params: { page, limit: 100 },
          });
          allEmployees.push(...(response.data.items || []));
        }

        if (!ignore) {
          setManagers(
            allEmployees.filter(
              employee =>
                employee.user?.role === "manager" &&
                employee.employmentStatus !== "inactive" &&
                employee.employmentStatus !== "terminated" &&
                employee.user?.isActive !== false
            )
          );
        }
      } catch {
        if (!ignore) setManagers([]);
      }
    };

    fetchManagers();

    return () => {
      ignore = true;
    };
  }, [isAdmin, reloadKey]);

  // ------------------------------------------------
  // DASHBOARD STATISTICS
  // ------------------------------------------------

  const statistics = useMemo(() => {
    const employees = data.items;

    return {
      active: employees.filter(
        employee => employee.employmentStatus === "active"
      ).length,

      probation: employees.filter(
        employee => employee.employmentStatus === "probation"
      ).length,

      inactive: employees.filter(
        employee =>
          employee.employmentStatus === "inactive" ||
          employee.employmentStatus === "terminated"
      ).length,
    };
  }, [data.items]);

  // ------------------------------------------------
  // FORM HELPERS
  // ------------------------------------------------

  const resetFiles = () => {
    setFiles({
      profilePicture: null,
      documents: [],
      documentType: "Other",
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(clone(emptyForm));
    setActiveTab("account");
    resetFiles();
    setFormError("");
    setModal(true);
  };

  const openEdit = async employee => {
    setFormError("");
    setError("");

    try {
      const response = await api.get(`/employees/${employee._id}`);

      const fullEmployee =
        response.data.employee ||
        response.data.data?.employee ||
        response.data;

      setEditingId(employee._id);
      setForm(normalizeEmployee(fullEmployee));
      setActiveTab("personal");
      resetFiles();
      setModal(true);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const openPreview = async employee => {
    setPreviewLoading(true);
    setPreviewModal(true);
    setPreviewEmployee(null);

    try {
      const response = await api.get(`/employees/${employee._id}`);

      setPreviewEmployee(
        response.data.employee ||
        response.data.data?.employee ||
        response.data
      );
    } catch (err) {
      setError(errMsg(err));
      setPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateField = (path, value) => {
    setForm(previous => setValue(previous, path, value));
  };

  const updateEducation = (index, key, value) => {
    setForm(previous => {
      const education = [...previous.education];

      education[index] = {
        ...education[index],
        [key]: value,
      };

      return { ...previous, education };
    });
  };

  const addEducation = () => {
    setForm(previous => ({
      ...previous,
      education: [...previous.education, { ...emptyEducation }],
    }));
  };

  const removeEducation = index => {
    setForm(previous => ({
      ...previous,
      education:
        previous.education.length > 1
          ? previous.education.filter((_, i) => i !== index)
          : [{ ...emptyEducation }],
    }));
  };

  const closeModal = () => {
    if (saving) return;

    setModal(false);
    setEditingId(null);
    setFormError("");
    resetFiles();
  };

  const goToTab = direction => {
    const currentIndex = FORM_TABS.findIndex(
      tab => tab.id === activeTab
    );

    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < FORM_TABS.length) {
      setActiveTab(FORM_TABS[nextIndex].id);
    }
  };

  // ------------------------------------------------
  // SUBMIT FORM
  // ------------------------------------------------

  const submit = async event => {
    event.preventDefault();
    setFormError("");

    if (!form.personal.firstName.trim()) {
      setActiveTab("personal");
      setFormError("First name is required.");
      return;
    }

    if (!form.personal.lastName.trim()) {
      setActiveTab("personal");
      setFormError("Last name is required.");
      return;
    }

    if (!form.employeeId.trim()) {
      setActiveTab("employment");
      setFormError("Employee ID is required.");
      return;
    }

    if (!form.department.trim()) {
      setActiveTab("employment");
      setFormError("Department is required.");
      return;
    }

    if (!form.joiningDate) {
      setActiveTab("employment");
      setFormError("Joining date is required.");
      return;
    }

    // Regular employees must report to a manager. Managers may be top-level.
    if (form.role === "employee" && !form.manager) {
      setActiveTab("employment");
      setFormError("Please select a reporting manager for this employee.");
      return;
    }

    if (!editingId) {
      if (!form.email.trim()) {
        setActiveTab("account");
        setFormError("Work email is required.");
        return;
      }

      if (form.password.length < 8) {
        setActiveTab("account");
        setFormError("Password must contain at least 8 characters.");
        return;
      }
    }

    setSaving(true);

    try {
      const formData = buildFormData(
        form,
        files,
        Boolean(editingId)
      );

      if (editingId) {
        await api.put(`/employees/${editingId}`, formData);
      } else {
        await api.post("/employees", formData);
      }

      setModal(false);
      setEditingId(null);
      resetFiles();
      setReloadKey(key => key + 1);
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------
  // DEACTIVATE EMPLOYEE
  // ------------------------------------------------

  const deactivate = async employee => {
    const name = employee.user?.name || getEmployeeName(employee);

    const confirmed = window.confirm(
      `Deactivate ${name}? They will no longer be able to log in.`
    );

    if (!confirmed) return;

    try {
      setError("");
      await api.patch(`/employees/${employee._id}/deactivate`);
      setReloadKey(key => key + 1);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  // ------------------------------------------------
  // REACTIVATE EMPLOYEE
  // ------------------------------------------------

  const reactivate = async employee => {
    const name = employee.user?.name || getEmployeeName(employee);

    const confirmed = window.confirm(
      `Reactivate ${name}? Their employment status will be changed to Active and they will be able to log in again.`
    );

    if (!confirmed) return;

    try {
      setError("");

      const formData = new FormData();
      formData.append("employmentStatus", "active");

      await api.put(`/employees/${employee._id}`, formData);

      setReloadKey(key => key + 1);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  // ------------------------------------------------
  // EMPLOYEE ACTIONS
  // ------------------------------------------------

  const EmployeeActions = ({ employee, compact = false }) => {
    const isInactive = employee.employmentStatus === "inactive";
    const isTerminated = employee.employmentStatus === "terminated";

    const canDeactivate =
      !isInactive &&
      !isTerminated &&
      employee.user?.isActive !== false;

    const buttonClass =
      "rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-50";

    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => openPreview(employee)}
          className={`${buttonClass} text-slate-500 hover:bg-indigo-100 hover:text-indigo-700`}
          aria-label="View employee"
          title="View profile"
        >
          <Eye size={compact ? 16 : 17} />
        </button>

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => openEdit(employee)}
              className={`${buttonClass} text-slate-500 hover:bg-indigo-100 hover:text-indigo-700`}
              aria-label="Edit employee"
              title="Edit employee"
            >
              <Pencil size={compact ? 16 : 17} />
            </button>

            {isInactive && (
              <button
                type="button"
                onClick={() => reactivate(employee)}
                className={`${buttonClass} text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700`}
                aria-label="Reactivate employee"
                title="Reactivate employee"
              >
                <UserCheck size={compact ? 16 : 17} />
              </button>
            )}

            {canDeactivate && (
              <button
                type="button"
                onClick={() => deactivate(employee)}
                className={`${buttonClass} text-slate-500 hover:bg-red-50 hover:text-red-600`}
                aria-label="Deactivate employee"
                title="Deactivate employee"
              >
                <UserX size={compact ? 16 : 17} />
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  // ------------------------------------------------
  // FILTERS AND PAGINATION
  // ------------------------------------------------

  const applySearch = event => {
    event.preventDefault();

    setQuery({
      search: searchInput.trim(),
      ...filterInput,
      page: 1,
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    setFilterInput(emptyFilters);

    setQuery({
      search: "",
      department: "",
      status: "",
      page: 1,
    });
  };

  // ------------------------------------------------
  // FORM FIELD RENDERERS
  // ------------------------------------------------

  const field = (label, path, props = {}) => (
    <Field
      label={label}
      value={getValue(form, path)}
      onChange={value => updateField(path, value)}
      {...props}
    />
  );

  const selectField = (label, path, options) => (
    <SelectField
      label={label}
      value={getValue(form, path)}
      onChange={value => updateField(path, value)}
      options={options}
    />
  );

  const sectionGrid = children => (
    <div className="grid gap-5 sm:grid-cols-2">{children}</div>
  );

  // ------------------------------------------------
  // EMPLOYEE CARD
  // ------------------------------------------------

  const EmployeeCard = ({ employee }) => {
    const name = employee.user?.name || getEmployeeName(employee);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={name} />

            <div className="min-w-0">
              <h3 className="truncate font-semibold text-slate-900">
                {name}
              </h3>
              <p className="truncate text-xs text-slate-500">
                {employee.employeeId}
              </p>
            </div>
          </div>

          <StatusBadge value={employee.employmentStatus} />
        </div>

        <div className="my-4 space-y-2.5 border-y border-slate-100 py-4 text-sm text-slate-500">
          <p className="flex items-center gap-2">
            <Building2 size={15} className="text-indigo-500" />
            {employee.department || "-"}
          </p>

          <p className="flex items-center gap-2">
            <BriefcaseBusiness size={15} className="text-indigo-500" />
            {employee.designation || "-"}
          </p>

          <p className="flex items-center gap-2 truncate">
            <Mail size={15} className="text-indigo-500" />
            {employee.user?.email || "-"}
          </p>

          <p className="flex items-center gap-2">
            <Phone size={15} className="text-indigo-500" />
            {employee.phone || "-"}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => openPreview(employee)}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            View profile
          </button>

          {isAdmin && (
            <EmployeeActions employee={employee} compact />
          )}
        </div>
      </div>
    );
  };

  // ==================================================
  // MAIN UI
  // ==================================================

  return (
    <div className="min-h-screen space-y-7 bg-slate-50/50 pb-8">

      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-indigo-600">
            <Users size={16} />
            <span className="font-semibold">
              Human Resource Management
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {isManager ? "My Team" : "Employee Directory"}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage employee information, records and organizational details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey(key => key + 1)}
            className={secondaryButton}
            disabled={loading}
          >
            <RotateCcw size={16} />
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreate}
              className={primaryButton}
            >
              <Plus size={18} />
              Add employee
            </button>
          )}
        </div>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total employees"
          value={data.total}
          description="Matching employee records"
          icon={Users}
          color="indigo"
        />

        <StatCard
          title="Active employees"
          value={statistics.active}
          description="On the current page"
          icon={UserCheck}
          color="emerald"
        />

        <StatCard
          title="On probation"
          value={statistics.probation}
          description="On the current page"
          icon={Clock}
          color="amber"
        />

        <StatCard
          title="Inactive employees"
          value={statistics.inactive}
          description="Inactive or terminated on this page"
          icon={UserMinus}
          color="rose"
        />
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">
              Employee directory
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Search and filter employee records.
            </p>
          </div>

          <Filter size={19} className="text-indigo-500" />
        </div>

        <form onSubmit={applySearch}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_200px_190px_auto_auto]">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                aria-label="Search employees"
                placeholder="Search name, email or employee ID..."
                className={`${inputClass} mt-0 pl-10`}
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
              />
            </div>

            <input
              aria-label="Department filter"
              placeholder="Department"
              className={`${inputClass} mt-0`}
              value={filterInput.department}
              onChange={event =>
                setFilterInput(previous => ({
                  ...previous,
                  department: event.target.value,
                }))
              }
            />

            <select
              aria-label="Status filter"
              className={`${inputClass} mt-0`}
              value={filterInput.status}
              onChange={event =>
                setFilterInput(previous => ({
                  ...previous,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>

            <button type="submit" className={primaryButton}>
              <Search size={16} />
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className={secondaryButton}
            >
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* DIRECTORY TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            All employees
          </h2>
          <p className="text-sm text-slate-500">
            Showing {data.items.length} of {data.total} matching records
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg p-2 ${
              viewMode === "table"
                ? "bg-indigo-600 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            aria-label="Table view"
          >
            <List size={18} />
          </button>

          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-lg p-2 ${
              viewMode === "grid"
                ? "bg-indigo-600 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* EMPLOYEE DIRECTORY */}
      {loading ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <LoaderCircle
            size={32}
            className="animate-spin text-indigo-600"
          />
          <p className="mt-3 text-sm font-medium text-slate-500">
            Loading employee records...
          </p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-500">
            <Users size={30} />
          </div>

          <h3 className="mt-4 font-bold text-slate-800">
            No employees found
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Try changing your search or filter criteria.
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 text-sm font-semibold text-indigo-600"
          >
            Clear all filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map(employee => (
            <EmployeeCard
              key={employee._id}
              employee={employee}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-semibold">Employee</th>
                  <th className="px-5 py-4 font-semibold">Employee ID</th>
                  <th className="px-5 py-4 font-semibold">Department</th>
                  <th className="px-5 py-4 font-semibold">Designation</th>
                  <th className="px-5 py-4 font-semibold">Manager</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {data.items.map(employee => {
                  const name =
                    employee.user?.name || getEmployeeName(employee);

                  return (
                    <tr
                      key={employee._id}
                      className="transition hover:bg-indigo-50/40"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openPreview(employee)}
                          className="flex items-center gap-3 text-left"
                        >
                          <Avatar name={name} />

                          <div>
                            <p className="font-semibold text-slate-800 hover:text-indigo-600">
                              {name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {employee.user?.email || "-"}
                            </p>
                          </div>
                        </button>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-600">
                        {employee.employeeId || "-"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {employee.department || "-"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {employee.designation || "-"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {employee.manager?.employeeId || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge value={employee.employmentStatus} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <EmployeeActions employee={employee} />
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

      {/* PAGINATION */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <p className="text-sm text-slate-500">
          Page{" "}
          <span className="font-bold text-slate-800">{query.page}</span>
          {" "}of{" "}
          <span className="font-bold text-slate-800">
            {data.pages || 1}
          </span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={query.page <= 1 || loading}
            onClick={() =>
              setQuery(previous => ({
                ...previous,
                page: previous.page - 1,
              }))
            }
            className={secondaryButton}
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <button
            type="button"
            disabled={query.page >= data.pages || loading}
            onClick={() =>
              setQuery(previous => ({
                ...previous,
                page: previous.page + 1,
              }))
            }
            className={secondaryButton}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ==============================================
          CREATE / EDIT EMPLOYEE MODAL
      ============================================== */}

      {modal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5">
          <form
            onSubmit={submit}
            encType="multipart/form-data"
            className="flex h-[min(94vh,920px)] max-h-[94vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-7 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600 sm:h-11 sm:w-11">
                  {editingId ? <Pencil size={21} /> : <Plus size={23} />}
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    {editingId ? "Edit employee" : "Add new employee"}
                  </h2>

                  <p className="text-xs text-slate-500">
                    {editingId
                      ? "Update employee information and records."
                      : "Create an employee profile and account."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close form"
              >
                <X size={21} />
              </button>
            </div>

            {/* TABS */}
            <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-3 sm:px-5">
              <div className="grid grid-cols-4 gap-1 sm:flex sm:justify-between sm:gap-2">
                {FORM_TABS.map((tab, index) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  const completed =
                    FORM_TABS.findIndex(item => item.id === activeTab) > index;

                  return (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setFormError("");
                      }}
                      disabled={saving}
                      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center transition sm:flex-1 sm:flex-row sm:gap-2 sm:px-2 sm:py-3 ${
                        active
                          ? "border-indigo-200 bg-indigo-100 text-indigo-700 shadow-sm"
                          : completed
                            ? "border-transparent bg-white text-indigo-600 hover:bg-indigo-50"
                            : "border-transparent text-slate-500 hover:bg-white hover:text-indigo-600"
                      }`}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span className="truncate text-[10px] font-semibold sm:text-xs">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* PROGRESS */}
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${
                        ((FORM_TABS.findIndex(
                          tab => tab.id === activeTab
                        ) + 1) /
                          FORM_TABS.length) *
                        100
                      }%`,
                    }}
                  />
                </div>

                <span className="shrink-0 text-[11px] font-medium text-slate-500">
                  {FORM_TABS.findIndex(tab => tab.id === activeTab) + 1} of{" "}
                  {FORM_TABS.length}
                </span>
              </div>
            </div>

            {/* FORM ERROR */}
            {formError && (
              <div
                role="alert"
                className="mx-4 mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-7"
              >
                {formError}
              </div>
            )}

            {/* TAB CONTENT */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7 sm:py-7">
              <div className="mx-auto w-full max-w-5xl">

                {/* ACCOUNT TAB */}
                {activeTab === "account" && (
                  <div>
                    <SectionHeading
                      title="Account information"
                      description="Set up employee login credentials and account permissions."
                    />

                    {editingId ? (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
                        <div className="flex items-center gap-3">
                          <ShieldCheck
                            className="text-indigo-600"
                            size={25}
                          />
                          <div>
                            <p className="font-semibold text-indigo-900">
                              Account already created
                            </p>
                            <p className="text-sm text-indigo-700">
                              Work email: {form.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      sectionGrid(
                        <>
                          {field("Work email", "email", {
                            type: "email",
                            required: true,
                          })}

                          {field("Password", "password", {
                            type: "password",
                            required: true,
                            minLength: 8,
                          })}

                          {selectField("Account role", "role", [
                            { value: "employee", label: "Employee" },
                            { value: "manager", label: "Manager" },
                          ])}
                        </>
                      )
                    )}
                  </div>
                )}

                {/* PERSONAL TAB */}
                {activeTab === "personal" && (
                  <div>
                    <SectionHeading
                      title="Personal information"
                      description="Add the employee's basic personal and identification details."
                    />

                    {sectionGrid(
                      <>
                        {field("First name", "personal.firstName", {
                          required: true,
                        })}

                        {field("Middle name", "personal.middleName")}

                        {field("Last name", "personal.lastName", {
                          required: true,
                        })}

                        {field("Date of birth", "personal.dateOfBirth", {
                          type: "date",
                        })}

                        {selectField("Gender", "personal.gender", [
                          { value: "", label: "Select gender" },
                          { value: "Male", label: "Male" },
                          { value: "Female", label: "Female" },
                          { value: "Other", label: "Other" },
                        ])}

                        {field("Nationality", "personal.nationality")}

                        {field("Blood group", "personal.bloodGroup")}

                        {selectField(
                          "Marital status",
                          "personal.maritalStatus",
                          [
                            { value: "", label: "Select status" },
                            { value: "Single", label: "Single" },
                            { value: "Married", label: "Married" },
                            { value: "Divorced", label: "Divorced" },
                            { value: "Widowed", label: "Widowed" },
                          ]
                        )}

                        {field("PAN number", "personal.panNumber")}

                        {field("Aadhaar number", "personal.aadhaarNumber")}

                        {field("Voter ID", "personal.voterIdNumber")}

                        {field("Passport number", "personal.passportNumber")}
                      </>
                    )}
                  </div>
                )}

                {/* EMPLOYMENT TAB */}
                {activeTab === "employment" && (
                  <div>
                    <SectionHeading
                      title="Employment information"
                      description="Configure the employee's job details, reporting structure and employment status."
                    />

                    {sectionGrid(
                      <>
                        {field("Employee ID", "employeeId", {
                          required: true,
                        })}

                        {field("Phone number", "phone", {
                          type: "tel",
                        })}

                        {field("Department", "department", {
                          required: true,
                        })}

                        {field("Designation", "designation")}

                        {field("Joining date", "joiningDate", {
                          type: "date",
                          required: true,
                        })}

                        {selectField("Employment type", "employmentType", [
                          { value: "Full-time", label: "Full-time" },
                          { value: "Part-time", label: "Part-time" },
                          { value: "Contract", label: "Contract" },
                          { value: "Intern", label: "Intern" },
                          { value: "Temporary", label: "Temporary" },
                        ])}

                        {field("Work location", "workLocation")}

                        {field("Probation months", "probationMonths", {
                          type: "number",
                          min: 0,
                        })}

                        {field("Salary", "salary", {
                          type: "number",
                          min: 0,
                        })}

                        <SelectField
                          label="Reporting manager"
                          value={form.manager}
                          onChange={value =>
                            updateField("manager", value)
                          }
                          required={form.role === "employee"}
                          options={[
                            {
                              value: "",
                              label:
                                form.role === "employee"
                                  ? "Select reporting manager"
                                  : "No manager (top-level manager)",
                            },
                            ...managers
                              .filter(
                                manager => manager._id !== editingId
                              )
                              .map(manager => ({
                                value: manager._id,
                                label: `${
                                  manager.user?.name ||
                                  getEmployeeName(manager)
                                } (${manager.employeeId})`,
                              })),
                          ]}
                        />

                        {editingId &&
                          selectField(
                            "Employment status",
                            "employmentStatus",
                            [
                              { value: "active", label: "Active" },
                              { value: "probation", label: "Probation" },
                              { value: "inactive", label: "Inactive" },
                              { value: "terminated", label: "Terminated" },
                            ]
                          )}
                      </>
                    )}
                  </div>
                )}

                {/* CONTACT TAB */}
                {activeTab === "contact" && (
                  <div className="space-y-8">
                    <div>
                      <SectionHeading
                        title="Contact information"
                        description="Personal contact details and addresses."
                      />

                      {sectionGrid(
                        <>
                          {field(
                            "Personal email",
                            "contact.personalEmail",
                            { type: "email" }
                          )}

                          {field(
                            "Alternate phone",
                            "contact.alternatePhone",
                            { type: "tel" }
                          )}
                        </>
                      )}
                    </div>

                    <div>
                      <SectionHeading title="Current address" />

                      {sectionGrid(
                        <>
                          {field(
                            "Address",
                            "contact.currentAddress.addressLine"
                          )}
                          {field("City", "contact.currentAddress.city")}
                          {field("State", "contact.currentAddress.state")}
                          {field("Country", "contact.currentAddress.country")}
                          {field("Pincode", "contact.currentAddress.pincode")}
                        </>
                      )}
                    </div>

                    <div>
                      <SectionHeading title="Permanent address" />

                      {sectionGrid(
                        <>
                          {field(
                            "Address",
                            "contact.permanentAddress.addressLine"
                          )}
                          {field("City", "contact.permanentAddress.city")}
                          {field("State", "contact.permanentAddress.state")}
                          {field(
                            "Country",
                            "contact.permanentAddress.country"
                          )}
                          {field(
                            "Pincode",
                            "contact.permanentAddress.pincode"
                          )}
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setForm(previous => ({
                          ...previous,
                          contact: {
                            ...previous.contact,
                            permanentAddress: {
                              ...previous.contact.currentAddress,
                            },
                          },
                        }));
                      }}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Copy current address to permanent address
                    </button>
                  </div>
                )}

                {/* BANK TAB */}
                {activeTab === "bank" && (
                  <div>
                    <SectionHeading
                      title="Bank information"
                      description="Enter employee bank and payment details."
                    />

                    {sectionGrid(
                      <>
                        {field("Account holder name", "bank.accountHolderName")}
                        {field("Bank name", "bank.bankName")}
                        {field("Branch name", "bank.branchName")}
                        {field("Branch address", "bank.branchAddress")}
                        {field("Account number", "bank.accountNumber")}
                        {field("IFSC code", "bank.ifscCode")}

                        {selectField("Account type", "bank.accountType", [
                          { value: "", label: "Select account type" },
                          { value: "Savings", label: "Savings" },
                          { value: "Current", label: "Current" },
                        ])}
                      </>
                    )}

                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <div className="flex items-center gap-2 font-semibold">
                        <ShieldCheck size={17} />
                        Sensitive information
                      </div>
                      <p className="mt-1 text-xs leading-relaxed">
                        Bank account details should only be entered and
                        viewed by authorized users.
                      </p>
                    </div>
                  </div>
                )}

                {/* EDUCATION TAB */}
                {activeTab === "education" && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-800">
                          Education details
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Add academic qualifications and achievements.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addEducation}
                        className={secondaryButton}
                      >
                        <Plus size={16} />
                        Add qualification
                      </button>
                    </div>

                    <div className="space-y-4">
                      {form.education.map((education, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
                                <GraduationCap size={19} />
                              </div>

                              <h4 className="font-semibold text-slate-800">
                                Qualification {index + 1}
                              </h4>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeEducation(index)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                              aria-label="Remove qualification"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            {[
                              ["Qualification", "qualification"],
                              ["Institution", "institution"],
                              ["Board / University", "boardOrUniversity"],
                              ["Specialization", "specialization"],
                              ["Passing year", "passingYear"],
                              ["Marks / Percentage / CGPA", "marks"],
                            ].map(([label, key]) => (
                              <Field
                                key={key}
                                label={label}
                                value={education[key]}
                                onChange={value =>
                                  updateEducation(index, key, value)
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ADDITIONAL TAB */}
                {activeTab === "additional" && (
                  <div className="space-y-8">
                    <div>
                      <SectionHeading title="Emergency contact" />

                      {sectionGrid(
                        <>
                          {field("Contact name", "emergencyContact.name")}
                          {field(
                            "Relationship",
                            "emergencyContact.relationship"
                          )}
                          {field("Phone", "emergencyContact.phone", {
                            type: "tel",
                          })}
                          {field(
                            "Alternate phone",
                            "emergencyContact.alternatePhone",
                            { type: "tel" }
                          )}
                        </>
                      )}
                    </div>

                    <div>
                      <SectionHeading title="Previous employment" />

                      {sectionGrid(
                        <>
                          {field(
                            "Company name",
                            "previousEmployment.companyName"
                          )}

                          {field(
                            "Previous designation",
                            "previousEmployment.designation"
                          )}

                          {field(
                            "Experience (years)",
                            "previousEmployment.experienceYears",
                            { type: "number", min: 0 }
                          )}
                        </>
                      )}
                    </div>

                    <div>
                      <SectionHeading title="Social media profiles" />

                      {sectionGrid(
                        <>
                          {field("Facebook", "socialMedia.facebook")}
                          {field("LinkedIn", "socialMedia.linkedin")}
                          {field("Instagram", "socialMedia.instagram")}
                          {field("YouTube", "socialMedia.youtube")}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* DOCUMENTS TAB */}
                {activeTab === "documents" && (
                  <div className="space-y-6">
                    <SectionHeading
                      title="Profile picture and documents"
                      description="Upload the employee's photograph and supporting documents."
                    />

                    <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-6">
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-3 rounded-2xl bg-indigo-100 p-4 text-indigo-600">
                          <UserRound size={30} />
                        </div>

                        <h4 className="font-semibold text-slate-800">
                          Employee profile picture
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          JPG, PNG or WEBP. Maximum 5 MB.
                        </p>

                        <label className="mt-4 cursor-pointer rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
                          <span className="inline-flex items-center gap-2">
                            <Upload size={16} />
                            Choose picture
                          </span>

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={event =>
                              setFiles(previous => ({
                                ...previous,
                                profilePicture:
                                  event.target.files?.[0] || null,
                              }))
                            }
                          />
                        </label>

                        {files.profilePicture && (
                          <p className="mt-3 text-xs font-medium text-indigo-700">
                            {files.profilePicture.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <SectionHeading
                        title="Employee documents"
                        description="Select a document category and upload one or more files."
                      />

                      <div className="space-y-4">
                        <SelectField
                          label="Document type"
                          value={files.documentType}
                          onChange={value =>
                            setFiles(previous => ({
                              ...previous,
                              documentType: value,
                            }))
                          }
                          options={[
                            "Resume",
                            "10th Certificate",
                            "12th Certificate",
                            "Diploma Certificate",
                            "Degree Certificate",
                            "Offer Letter",
                            "Joining Letter",
                            "Employment Agreement",
                            "Other",
                          ].map(type => ({
                            value: type,
                            label: type,
                          }))}
                        />

                        <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-7 text-center transition hover:border-indigo-300 hover:bg-indigo-50/50">
                          <Upload size={28} className="text-indigo-500" />

                          <span className="mt-3 text-sm font-semibold text-slate-700">
                            Click to upload documents
                          </span>

                          <span className="mt-1 text-xs text-slate-400">
                            PDF, JPG, PNG or WEBP. Maximum 5 MB per file.
                          </span>

                          <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={event =>
                              setFiles(previous => ({
                                ...previous,
                                documents: Array.from(
                                  event.target.files || []
                                ),
                              }))
                            }
                          />
                        </label>

                        {files.documents.length > 0 && (
                          <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                            <p className="text-sm font-semibold text-slate-700">
                              Selected documents ({files.documents.length})
                            </p>

                            {files.documents.map((file, index) => (
                              <div
                                key={`${file.name}-${index}`}
                                className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
                              >
                                <FileText
                                  size={19}
                                  className="shrink-0 text-indigo-500"
                                />

                                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                                  {file.name}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setFiles(previous => ({
                                      ...previous,
                                      documents: previous.documents.filter(
                                        (_, i) => i !== index
                                      ),
                                    }))
                                  }
                                  className="text-red-500 hover:text-red-700"
                                  aria-label="Remove document"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.04)] sm:px-7 sm:py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToTab(-1)}
                  disabled={
                    saving ||
                    FORM_TABS.findIndex(tab => tab.id === activeTab) === 0
                  }
                  className={secondaryButton}
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => goToTab(1)}
                  disabled={
                    saving ||
                    FORM_TABS.findIndex(tab => tab.id === activeTab) ===
                      FORM_TABS.length - 1
                  }
                  className={secondaryButton}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className={secondaryButton}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButton}
                >
                  {saving ? (
                    <>
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      {editingId ? "Save changes" : "Create employee"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==============================================
          EMPLOYEE PROFILE PREVIEW
      ============================================== */}

      {previewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">
                  Employee profile
                </h2>
                <p className="text-xs text-slate-500">
                  Employee information and employment details
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close preview"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              {previewLoading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <LoaderCircle
                    size={30}
                    className="animate-spin text-indigo-600"
                  />
                </div>
              ) : previewEmployee ? (
                <div className="space-y-7">
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-indigo-50 p-5">
                    <Avatar
                      name={getEmployeeName(previewEmployee)}
                      size="lg"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-bold text-slate-900">
                        {getEmployeeName(previewEmployee)}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {previewEmployee.designation || "Employee"}
                      </p>

                      <p className="mt-1 text-xs text-indigo-600">
                        {previewEmployee.employeeId}
                      </p>
                    </div>

                    <StatusBadge
                      value={previewEmployee.employmentStatus}
                    />
                  </div>

                  <div>
                    <SectionHeading title="Employment details" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        ["Department", previewEmployee.department],
                        ["Designation", previewEmployee.designation],
                        ["Employment type", previewEmployee.employmentType],
                        ["Work location", previewEmployee.workLocation],
                        [
                          "Joining date",
                          previewEmployee.joiningDate?.slice(0, 10),
                        ],
                        ["Phone", previewEmployee.phone],
                        ["Email", previewEmployee.user?.email],
                        [
                          "Reporting manager",
                          previewEmployee.manager?.employeeId,
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs font-medium text-slate-400">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {value || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <SectionHeading title="Personal information" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        [
                          "Date of birth",
                          previewEmployee.personal?.dateOfBirth?.slice(0, 10),
                        ],
                        ["Gender", previewEmployee.personal?.gender],
                        [
                          "Nationality",
                          previewEmployee.personal?.nationality,
                        ],
                        [
                          "Blood group",
                          previewEmployee.personal?.bloodGroup,
                        ],
                        [
                          "Marital status",
                          previewEmployee.personal?.maritalStatus,
                        ],
                        [
                          "Personal email",
                          previewEmployee.contact?.personalEmail,
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs font-medium text-slate-400">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {value || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <SectionHeading title="Address information" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        [
                          "Current address",
                          previewEmployee.contact?.currentAddress,
                        ],
                        [
                          "Permanent address",
                          previewEmployee.contact?.permanentAddress,
                        ],
                      ].map(([label, address]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <h4 className="mb-2 text-sm font-semibold text-slate-800">
                            {label}
                          </h4>
                          <p className="text-sm text-slate-600">
                            {[
                              address?.addressLine,
                              address?.city,
                              address?.state,
                              address?.country,
                              address?.pincode,
                            ]
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <SectionHeading title="Education" />

                    <div className="space-y-3">
                      {(previewEmployee.education || []).length === 0 ? (
                        <p className="text-sm text-slate-400">
                          No education details available.
                        </p>
                      ) : (
                        previewEmployee.education.map((item, index) => (
                          <div
                            key={item._id || index}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <h4 className="font-semibold text-slate-800">
                              {item.qualification}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              {item.institution || "-"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {item.boardOrUniversity} · {item.passingYear}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <ShieldCheck size={17} />
                        Restricted information
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        Sensitive identification and banking information
                        is managed through the authorized employee form.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4">
              {isAdmin && previewEmployee && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewModal(false);
                    openEdit(previewEmployee);
                  }}
                  className={primaryButton}
                >
                  <Pencil size={16} />
                  Edit employee
                </button>
              )}

              <button
                type="button"
                onClick={() => setPreviewModal(false)}
                className={secondaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
