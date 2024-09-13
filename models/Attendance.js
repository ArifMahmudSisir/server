const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  clockIn: { type: Date },
  clockOut: { type: Date },
  selfie: {type: String}
});

module.exports = mongoose.model("Attendance", AttendanceSchema);
