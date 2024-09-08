const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

// Set Location
router.put("/set-location/:userId", authMiddleware, async function(req, res) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ msg: "Access denied" });
  }

  const { lat, lng } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user.location = {
      type: "Point",
      coordinates: [lng, lat],
    };
    await user.save();
    res.json({ msg: "Location set successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

router.get("/get-location/:userId", authMiddleware, async function(req, res){

  // Check if the requesting user is an admin
  if (req.user.role === "admin") {
    return res.status(403).json({ msg: "Access denied" });
  }

  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Extract admin-set location from the user data
    const adminSetLocation = user.location;

    // Get the user's current location from the query params
    const { currentLatitude, currentLongitude } = req.query;

    // Compare the current location with the admin-set location
    const locationMatches =
      adminSetLocation.latitude === currentLatitude &&
      adminSetLocation.longitude === currentLongitude;

    if (locationMatches) {
      // If the locations match, return the desired URL
      return res.json({
        url: "http://localhost:5173/api/location/get-location/:userId",
      });
    } else {
      // If the locations don't match, deny access
      return res.status(403).json({ msg: "Location mismatch. Access denied." });
    }
  } catch (err) {
    console.error("Server Error:", err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
