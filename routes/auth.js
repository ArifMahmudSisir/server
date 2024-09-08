const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const roles = require("../middleware/authorizeRoles");
const router = express.Router();

// Register user
router.post("/register", async function(req, res) {
  const { username, email, password, role } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    user = new User({ username, email, password, role });
    await user.save();

    const payload = { user: { id: user.id, role: user.role } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Login user/admin
router.post("/login", async function(req, res) {
  const { email, password } = req.body;

  try {
    // Find the user by email
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // Compare the entered password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // Prepare the payload with user ID and role
    const payload = { user: { id: user.id, role: user.role } };

    // Sign the JWT token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" }, // Token expiration time
      (err, token) => {
        if (err) throw err;

        // Send back the token and role in the response
        res.json({ token, role: user.role });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Get user info
router.get("/me", auth, async function(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



router.get("/users", auth, async function(req, res) {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied" });
    }

    // Get all users' usernames
    const users = await User.find({
      role: "user",
    });
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

router.get("/test", auth, (req, res) => {
  res.json({ msg: "Token is valid!" });
});

module.exports = router;
