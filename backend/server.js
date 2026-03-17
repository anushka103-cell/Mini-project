require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  const newUser = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    isVerified: false,
    verificationToken,
  };

  users.push(newUser);

  const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;

  try {
    await resend.emails.send({
      from: "MindSafe <onboarding@resend.dev>",
      to: email,
      subject: "Verify your MindSafe account",
      html: `
        <h2>Welcome to MindSafe</h2>
        <p>Please verify your email to activate your account.</p>
        <p>
          <a href="${verificationLink}">
            Click here to verify your email
          </a>
        </p>
      `,
    });
  } catch (error) {
    console.error("Email error:", error);

    return res.status(500).json({
      message: "Failed to send verification email",
    });
  }

  res.status(201).json({
    message:
      "Registration successful. Please check your email to verify your account.",
  });
});
/* ================= VERIFY EMAIL ================= */

app.post("/api/verify-email", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      message: "Verification token missing",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretkey",
    );

    const user = users.find(
      (u) => u.email === decoded.email && u.verificationToken === token,
    );

    if (!user) {
      return res.status(400).json({
        message: "Invalid verification token",
      });
    }

    user.isVerified = true;
    user.verificationToken = null;

    res.json({
      message: "Email verified successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: "Invalid or expired token",
    });
  }
});

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);

  if (!user) {
    return res.status(400).json({
      message: "Invalid credentials",
    });
  }

  // if (!user.isVerified) {
  //   return res.status(403).json({
  //     message: "Please verify your email before logging in",
  //   });
  // }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(400).json({
      message: "Invalid credentials",
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "1d" },
  );

  res.json({ token });
});

/* ================= VERIFY TOKEN ================= */

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      message: "Invalid token",
    });
  }
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

  res.json({
    messages: chats[userId] || [],
  });
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

  res.json({
    moods: moods[userId] || [],
  });
});

/* ================= AVATAR ================= */

app.post("/api/avatar", verifyToken, (req, res) => {
  const userId = req.user.id;
  const { avatar3D } = req.body;

  if (!avatars[userId]) avatars[userId] = {};

  avatars[userId].avatar3D = avatar3D;

  res.json({
    success: true,
    avatar: avatars[userId],
  });
});

app.get("/api/avatar", verifyToken, (req, res) => {
  const userId = req.user.id;

  res.json({
    avatar: avatars[userId] || null,
  });
});

/* ================= PROFILE ================= */

app.post("/api/profile", verifyToken, (req, res) => {
  const userId = req.user.id;

  profiles[userId] = {
    ...profiles[userId],
    ...req.body,
  };

  res.json({ success: true });
});

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

/* ================= DELETE ACCOUNT ================= */

app.delete("/api/profile", verifyToken, (req, res) => {
  const userId = req.user.id;

  users = users.filter((u) => u.id !== userId);

  delete chats[userId];
  delete moods[userId];
  delete avatars[userId];
  delete profiles[userId];

  res.json({ success: true });
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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
