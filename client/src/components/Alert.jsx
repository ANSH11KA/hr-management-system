import { CheckCircle2, AlertCircle } from "lucide-react";

export default function Alert({ msg }) {
  if (!msg?.text) return null;
  const error = msg.type === "error";
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <p role={error ? "alert" : "status"}
      className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
        error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      <Icon size={16} /> {msg.text}
    </p>
  );
}