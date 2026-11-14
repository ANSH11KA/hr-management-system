import LeaveRequest from "../models/LeaveRequest.js";
import { wrap } from "./wrap.js";

export const applyLeave = wrap(async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;
  const s = new Date(startDate), e = new Date(endDate);
  if (!leaveType || !reason || isNaN(s) || isNaN(e) || e < s)
    return res.status(400).json({ message: "Invalid leave details or date range" });
  const overlap = await LeaveRequest.findOne({
    employee: req.employee._id,
    status: { $nin: ["Rejected", "Cancelled"] }, // cancelled/rejected requests don't block new ones
    startDate: { $lte: e }, endDate: { $gte: s },
  });
  if (overlap) return res.status(409).json({ message: "Overlaps with an existing leave request" });
  res.status(201).json(await LeaveRequest.create({ employee: req.employee._id, leaveType, startDate: s, endDate: e, reason }));
});

export const myLeaves = wrap(async (req, res) =>
  res.json(
    await LeaveRequest.find({ employee: req.employee._id })
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
  ));

export const listLeaves = wrap(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  res.json(
    await LeaveRequest.find(filter)
      .populate({ path: "employee", populate: { path: "user", select: "name" } })
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
  );
});

export const decide = status => wrap(async (req, res) => {
  const lr = await LeaveRequest.findById(req.params.id);
  if (!lr) return res.status(404).json({ message: "Not found" });
  if (lr.status !== "Pending") return res.status(400).json({ message: `Already ${lr.status}` });
  Object.assign(lr, { status, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: req.body.note || "" });
  await lr.save();
  res.json(lr);
});

// Employee can cancel only their OWN request, and only while it is still Pending
export const cancelLeave = wrap(async (req, res) => {
  const lr = await LeaveRequest.findOne({ _id: req.params.id, employee: req.employee._id });
  if (!lr) return res.status(404).json({ message: "Leave request not found" });
  if (lr.status !== "Pending")
    return res.status(400).json({ message: `Only pending requests can be cancelled (this one is ${lr.status})` });
  lr.status = "Cancelled";
  await lr.save();
  res.json(lr);
});