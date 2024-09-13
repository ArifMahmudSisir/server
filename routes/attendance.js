const express = require("express");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const authMiddleware = require("../middleware/authMiddleware");
const axios = require("axios");
const moment = require("moment");
const { default: mongoose } = require("mongoose");
const router = express.Router();

// Clock In
router.post("/clock-in", authMiddleware, async function (req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(400).send("User not available");
    }

    // Check if the user already has an active clock-in
    const activeAttendance = await Attendance.findOne({
      user: userId,
      clockOut: null,
    });

    if (activeAttendance) {
      return res.status(200).json({ msg: "Already clocked in" });
    }

    // Create new clock-in record
    const attendance = new Attendance({
      user: userId,
      clockIn: new Date(),
    });

    if (user) {
      user.attendance = attendance._id;
      await user.save();
    }
    await attendance.save();
    res.json({ msg: "Clocked in successfully", attendance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});
router.post("/clock-in-with-selfie", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { selfie } = req.body;

    if (!selfie) {
      return res.status(400).json({ msg: "Selfie is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).send("User not available");
    }

    // Check if the user already has an active clock-in
    const activeAttendance = await Attendance.findOne({
      user: userId,
      clockOut: null,
    });

    if (activeAttendance) {
      return res.status(200).json({ msg: "Already clocked in" });
    }

    // Create new clock-in record with selfie
    const attendance = new Attendance({
      user: userId,
      clockIn: new Date(),
      selfie, // Store the Base64 image string
    });

    if (user) {
      user.attendance = attendance._id;
      await user.save();
    }

    await attendance.save();
    res.json({ msg: "Clocked in with selfie successfully", attendance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});
router.get("/selfie/:attendanceId", authMiddleware, async (req, res) => {
  try {
    const { attendanceId } = req.params;

    if (!attendanceId) {
      return res.status(400).send("Attendance ID is required");
    }

    const attendance = await Attendance.findById(attendanceId);

    if (!attendance) {
      return res.status(404).json({ msg: "Attendance record not found" });
    }

    res.json({
      userId: attendance.user,
      clockIn: attendance.clockIn,
      clockOut: attendance.clockOut,
      selfie: attendance.selfie, // Return the selfie (Base64 image string)
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});

// Clock Out
router.post("/clock-out", authMiddleware, async function (req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(400).send("User not available");
    }

    // Find active clock-in record
    const activeAttendance = await Attendance.findOne({
      user: userId,
      clockOut: null,
    });

    if (user) {
      user.attendance = null;
      await user.save();
    }

    if (!activeAttendance) {
      return res.status(400).json({ msg: "No active clock-in record" });
    }

    // Update clock-out time
    activeAttendance.clockOut = new Date();
    await activeAttendance.save();

    res.json({ msg: "Clocked out successfully", attendance: activeAttendance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Get Attendance Records for a User
router.get("/users/:userId", authMiddleware, async function (req, res) {
  const userId = req.params.userId;
  let start_time = moment().toDate();
  let end_time = moment().add(7, "day").toDate();

  if (req.query?.start_time) {
    start_time = moment(req.query?.start_time).toDate();
  }
  if (req.query?.end_time) {
    end_time = moment(req.query?.end_time).toDate();
  }

  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const totalTime = await Attendance.aggregate([
      {
        $match: {
          user: userObjectId,
          clockIn: { $gte: start_time, $lte: end_time },
          clockOut: { $exists: true },
        },
      },
      {
        $project: {
          duration: { $subtract: ["$clockOut", "$clockIn"] },
        },
      },
      {
        $group: {
          _id: null,
          totalDuration: { $sum: "$duration" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSeconds: { $divide: ["$totalDuration", 1000] },
          hours: {
            $floor: { $divide: [{ $divide: ["$totalDuration", 1000] }, 3600] },
          },
          minutes: {
            $floor: {
              $divide: [
                { $mod: [{ $divide: ["$totalDuration", 1000] }, 3600] },
                60,
              ],
            },
          },
          seconds: { $mod: [{ $divide: ["$totalDuration", 1000] }, 60] },
        },
      },
    ]);

    const attendances = await Attendance.find({
      user: userId,
      clockIn: { $gte: start_time, $lte: end_time },
    }).populate("user", ["username", "email"]);

    res.json({ attendances, totalTime: totalTime[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});
router.get("/users/:userId/:attendanceId", authMiddleware, async (req, res) => {
  try {
    const { userId, attendanceId } = req.params;
    if (!userId) {
      res.status(400).send("User id is required.");
    }

    if (!attendanceId) {
      res.status(400).send("AttendanceId id is required.");
    }

    const attendance = await Attendance.findById(attendanceId);

    res.json(attendance);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});

router.get("/users/:userId", authMiddleware, async function (req, res) {
  const userId = req.params.userId;

  // Set default date range (last 7 days)
  let start_time = moment().subtract(7, "days").toDate();
  let end_time = moment().toDate();

  // Use query parameters if provided
  if (req.query.start_time) {
    start_time = moment(req.query.start_time).toDate();
  }
  if (req.query.end_time) {
    end_time = moment(req.query.end_time).toDate();
  }

  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Calculate total time
    const totalTime = await Attendance.aggregate([
      {
        $match: {
          user: userObjectId,
          clockIn: { $gte: start_time, $lte: end_time },
          clockOut: { $exists: true },
        },
      },
      {
        $project: {
          duration: { $subtract: ["$clockOut", "$clockIn"] },
        },
      },
      {
        $group: {
          _id: null,
          totalDuration: { $sum: "$duration" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSeconds: { $divide: ["$totalDuration", 1000] },
          hours: {
            $floor: { $divide: [{ $divide: ["$totalDuration", 1000] }, 3600] },
          },
          minutes: {
            $floor: {
              $divide: [
                { $mod: [{ $divide: ["$totalDuration", 1000] }, 3600] },
                60,
              ],
            },
          },
          seconds: { $mod: [{ $divide: ["$totalDuration", 1000] }, 60] },
        },
      },
    ]);

    // Fetch attendance records
    const attendances = await Attendance.find({
      user: userId,
      clockIn: { $gte: start_time, $lte: end_time },
    }).populate("user", ["username", "email"]);

    // Respond with attendance records and total time
    res.json({
      attendances,
      totalTime: totalTime[0] || { hours: 0, minutes: 0, seconds: 0 },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
