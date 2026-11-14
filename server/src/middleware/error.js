// middleware/error.js
export const notFound = (req, res) =>
  res.status(404).json({ message: "Route not found" });

export const errorHandler = (err, req, res, next) => {
  // Duplicate key (unique index): employeeId, email, one attendance/DAR per day
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const labels = {
      email: "email address",
      employeeId: "employee ID",
      date: "attendance record for this date",
      reportDate: "report for this date",
    };
    return res.status(409).json({ message: `Duplicate value: ${labels[field] || field} already exists` });
  }

  // Malformed ObjectId, e.g. /employees/abc
  if (err.name === "CastError")
    return res.status(400).json({ message: "Invalid ID" });

  // Mongoose schema validation
  if (err.name === "ValidationError")
    return res.status(400).json({
      message: Object.values(err.errors).map(e => e.message).join(", "),
    });

  // Malformed JSON body
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ message: "Invalid JSON in request body" });

  // Body larger than the 100kb limit set in app.js
  if (err.type === "entity.too.large")
    return res.status(413).json({ message: "Request body too large" });

  console.error(err); // log internally, never send the stack to the client
  res.status(err.status || 500).json({
    message: err.status && err.status < 500 ? err.message : "Server error",
  });
};