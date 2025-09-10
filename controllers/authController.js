const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// Register
const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ username, email, password });

    if (user) {
      const token = generateToken(res, user._id);
      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token, // also send token if frontend wants localStorage option
      });
    }
  } catch (error) {
    console.error(error); // log actual error
    res.status(500).json({ message: "Server error" });
  }
};

// Login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      const token = generateToken(res, user._id);
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token,
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error(error); // log actual error
    res.status(500).json({ message: "Server error" });
  }
};

// Logout
const logout = (req, res) => {
  res.cookie("jwt", "", { httpOnly: true, expires: new Date(0) });
  res.json({ message: "Logged out successfully" });
};

// Profile (Protected)
const profile = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  res.json({
    _id: req.user._id,
    username: req.user.username,
    email: req.user.email,
  });
};

module.exports = { register, login, logout, profile };
