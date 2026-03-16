const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= TEMP STORAGE ================= */

let users = [];
let chats = {};
let moods = {};
let avatars = {};
let profiles = {};

/* ================= BASIC ROUTE ================= */

app.get("/", (req, res) => {
  res.json({ message: "MindSafe Backend Running" });
});

/* ================= REGISTER ================= */

app.post("/api/register", async (req, res) => {
  const { email, password, role } = req.body;

  const existingUser = users.find((user) => user.email === email);
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    role: role || "user",
  };

  users.push(newUser);

  res.status(201).json({ message: "User registered successfully" });
});

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);
  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    "supersecretkey",
    { expiresIn: "1d" },
  );

  res.json({ token });
});

/* ================= VERIFY TOKEN ================= */

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, "supersecretkey");
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

/* ================= VERIFY INTERN ================= */

const verifyIntern = (req, res, next) => {
  if (req.user.role !== "intern") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

/* ================= CHAT ================= */

app.post("/api/chat", verifyToken, (req, res) => {
  const { role, content } = req.body;
  const userId = req.user.id;

  if (!chats[userId]) chats[userId] = [];
  chats[userId].push({ role, content });

  res.json({ success: true });
});

app.get("/api/chat", verifyToken, (req, res) => {
  const userId = req.user.id;
  res.json({ messages: chats[userId] || [] });
});

/* ================= MOOD ================= */

app.post("/api/mood", verifyToken, (req, res) => {
  const { mood, intensity, note } = req.body;
  const userId = req.user.id;

  if (!moods[userId]) moods[userId] = [];

  moods[userId].push({
    mood,
    intensity,
    note,
    date: new Date(),
  });

  res.json({ success: true });
});

app.get("/api/mood", verifyToken, (req, res) => {
  const userId = req.user.id;
  res.json({ moods: moods[userId] || [] });
});

/* ================= AVATAR ================= */

app.post("/api/avatar", verifyToken, (req, res) => {
  const userId = req.user.id;
  const { avatar3D } = req.body;

  if (!avatars[userId]) {
    avatars[userId] = {};
  }

  avatars[userId].avatar3D = avatar3D;

  res.json({
    success: true,
    avatar: avatars[userId],
  });
});

app.get("/api/avatar", verifyToken, (req, res) => {
  const userId = req.user.id;

  if (!avatars[userId]) {
    return res.json({
      avatar: null,
    });
  }

  res.json({
    avatar: avatars[userId],
  });
});

/* ================= PROFILE & PRIVACY ================= */

// Save profile settings
app.post("/api/profile", verifyToken, (req, res) => {
  const userId = req.user.id;

  profiles[userId] = {
    ...profiles[userId],
    ...req.body,
  };

  res.json({ success: true });
});

// Get profile
app.get("/api/profile", verifyToken, (req, res) => {
  const userId = req.user.id;

  res.json({
    email: req.user.email,
    profile: profiles[userId] || {
      anonymousName: "Anonymous",
      anonymousMode: true,
    },
  });
});

// Delete account
app.delete("/api/profile", verifyToken, (req, res) => {
  const userId = req.user.id;

  users = users.filter((u) => u.id !== userId);
  delete chats[userId];
  delete moods[userId];
  delete avatars[userId];
  delete profiles[userId];

  res.json({ success: true });
});

/* ================= INTERN ROUTES ================= */

// Get all users
app.get("/api/intern/users", verifyToken, verifyIntern, (req, res) => {
  const safeUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
  }));

  res.json({ users: safeUsers });
});

// Get specific user data
app.get("/api/intern/user/:id", verifyToken, verifyIntern, (req, res) => {
  const userId = req.params.id;

  res.json({
    moods: moods[userId] || [],
    chats: chats[userId] || [],
    avatar: avatars[userId] || null,
  });
});

/* ================= SOCKET.IO ================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let waitingUsers = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  function tryMatch() {
    if (waitingUsers.length >= 2) {
      const user1 = waitingUsers.shift();
      const user2 = waitingUsers.shift();

      user1.partner = user2.id;
      user2.partner = user1.id;

      user1.emit("matched");
      user2.emit("matched");
    }
  }

  socket.on("joinQueue", () => {
    if (!waitingUsers.includes(socket)) {
      waitingUsers.push(socket);
      tryMatch();
    }
  });

  socket.on("sendMessage", (message) => {
    if (socket.partner) {
      io.to(socket.partner).emit("receiveMessage", message);
    }
  });

  socket.on("typing", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partnerTyping");
    }
  });

  socket.on("leaveChat", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partnerDisconnected");
    }
    socket.partner = null;
    waitingUsers = waitingUsers.filter((u) => u.id !== socket.id);
  });

  socket.on("disconnect", () => {
    waitingUsers = waitingUsers.filter((u) => u.id !== socket.id);

    if (socket.partner) {
      io.to(socket.partner).emit("partnerDisconnected");
    }

    console.log("User disconnected:", socket.id);
  });
});

/* ================= START SERVER ================= */

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
