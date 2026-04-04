const { Server } = require("socket.io");
const Redis = require("ioredis");
const { MatchingEngine } = require("./matchingEngine");
const { RateLimiter, runSafetyChecks } = require("./safetyFilters");
const reconnectStore = require("./redisReconnectStore");
const {
  generateAnonName,
  ICEBREAKER_PROMPTS,
  CRISIS_RESOURCES_MESSAGE,
  EMOJI_REACTIONS,
  GRATITUDE_CARDS,
} = require("./anonConstants");

// ---- In-memory stores (reconnect codes moved to Redis) ----
const reportCounts = new Map(); // hash -> count
const shadowBanned = new Set(); // hashed ids
const trustScores = new Map(); // hash -> number
const userHashes = new Map(); // socketId -> stable hash for session

// ---- Helpers ----
function hashSocket(socket) {
  // Use a simple per-connection identifier; in production use hashed user-id
  if (userHashes.has(socket.id)) return userHashes.get(socket.id);
  const crypto = require("crypto");
  const h = crypto
    .createHash("sha256")
    .update(socket.id + (socket.handshake?.address || ""))
    .digest("hex")
    .slice(0, 16);
  userHashes.set(socket.id, h);
  return h;
}

function generateReconnectCode() {
  const adjectives = ["Calm", "Brave", "Kind", "Wise", "Warm", "Bright"];
  const animals = ["Owl", "Fox", "Bear", "Deer", "Wolf", "Seal"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const ani = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}-${ani}-${num}`;
}

// ---- Main setup ----

function setupAnonymousChat(server, { corsOrigin }) {
  // Init Redis for reconnect code persistence
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/0";
  const redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    lazyConnect: true,
  });
  redisClient.connect().catch((err) =>
    console.warn("Redis reconnect-store connect failed (codes will be in-memory):", err.message),
  );
  reconnectStore.init(redisClient);

  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
    pingInterval: 10000,
    pingTimeout: 15000,
  });

  const matchingEngine = new MatchingEngine();

  // Hook into match events for session initialization
  matchingEngine.onMatch = (
    socketA,
    socketB,
    { sharedTopic, warmupDuration },
  ) => {
    // Setup session timers for both sockets
    [socketA, socketB].forEach((s) => {
      s.chatStartedAt = Date.now();
      _resetIdleTimer(s, io);
      _startSessionTimer(s, io);
    });

    // Send icebreaker prompt after a short delay
    setTimeout(
      () => {
        const prompts =
          ICEBREAKER_PROMPTS[sharedTopic] || ICEBREAKER_PROMPTS.general;
        const prompt = prompts[Math.floor(Math.random() * prompts.length)];
        const icebreakerMsg = {
          text: `💡 Icebreaker: ${prompt}`,
          isSystem: true,
        };
        socketA.emit("systemMessage", icebreakerMsg);
        socketB.emit("systemMessage", icebreakerMsg);
      },
      warmupDuration === "off" ? 2000 : 1000,
    );
  };

  matchingEngine.start();

  const rateLimiter = new RateLimiter({ maxMessages: 20, windowMs: 60000 });

  // Track active sessions for emotion monitoring
  const sessionMessages = new Map(); // socketId -> string[]

  io.on("connection", (socket) => {
    console.log("[Anon] Connected:", socket.id);
    socket.partner = null;
    socket.anonName = null;
    socket.warmupEnded = true;
    socket.messageCount = 0;
    socket.lastMessageAt = Date.now();
    socket.chatStartedAt = null;
    socket.warningCount = 0;
    socket.idleTimer = null;
    socket.sessionTimer = null;

    // ---- Join Queue with preferences ----
    socket.on("joinQueue", async (prefs) => {
      const hash = hashSocket(socket);

      // Shadow ban check
      if (shadowBanned.has(hash)) {
        // Fake queue — never matched
        socket.emit("queuePosition", { position: 99, total: 100 });
        return;
      }

      const anonName = generateAnonName();
      socket.anonName = anonName;

      const preferences = {
        topics: Array.isArray(prefs?.topics)
          ? prefs.topics.slice(0, 6)
          : ["general"],
        lookingFor: prefs?.lookingFor || "casual",
        commStyle: prefs?.commStyle || "balanced",
        mood: Math.min(5, Math.max(1, Number(prefs?.mood) || 3)),
        availability: prefs?.availability || "15min",
        warmup: prefs?.warmup || "off",
        ageBracket: prefs?.ageBracket || null,
        triggerWarnings: Array.isArray(prefs?.triggerWarnings)
          ? prefs.triggerWarnings
          : [],
        isListener: !!prefs?.isListener,
        trustScore: trustScores.get(hash) || 0,
        anonName,
        avatarSeed: anonName.replace(/\s/g, "-").toLowerCase(),
        reconnectCode:
          typeof prefs?.reconnectCode === "string"
            ? prefs.reconnectCode.trim()
            : null,
      };

      // Check reconnect code priority
      if (preferences.reconnectCode) {
        try {
          const codeData = await reconnectStore.get(preferences.reconnectCode);
          if (codeData) {
            socket.reconnectTarget = codeData;
          }
        } catch (err) {
          console.warn("Redis reconnect lookup failed:", err.message);
        }
      }

      socket.preferences = preferences;
      socket.emit("anonIdentity", {
        name: anonName,
        avatarSeed: preferences.avatarSeed,
      });
      matchingEngine.addToQueue(socket, preferences);
    });

    // ---- Send Message ----
    socket.on("sendMessage", (message) => {
      if (!socket.partner || typeof message !== "string") return;
      const text = message.slice(0, 2000); // Max length

      // /exit safe word
      if (text.trim().toLowerCase() === "/exit") {
        socket.emit("crisisResources", { message: CRISIS_RESOURCES_MESSAGE });
        socket.emit("chatEnded", { reason: "safe_exit" });
        if (socket.partner) {
          io.to(socket.partner).emit("partnerDisconnected", {
            reason: "partner_left",
          });
          const partnerSocket = io.sockets.sockets.get(socket.partner);
          if (partnerSocket) partnerSocket.partner = null;
        }
        socket.partner = null;
        _clearTimers(socket);
        return;
      }

      // Run safety filters
      const safety = runSafetyChecks(text, socket.id, rateLimiter);

      if (!safety.allowed) {
        if (safety.reason === "rate_limited") {
          socket.emit("systemMessage", {
            text: "You're sending messages too fast. Please slow down.",
          });
        } else if (safety.reason === "blocked_content") {
          socket.warningCount++;
          if (socket.warningCount >= 3) {
            socket.emit("systemMessage", {
              text: "You've been disconnected for repeated violations.",
            });
            _disconnectPair(socket, io, "violation");
            return;
          }
          socket.emit("systemMessage", {
            text: "That message was blocked. Please be respectful.",
          });
        }
        return;
      }

      // PII warning (message still sent, but masked)
      if (safety.piiDetected) {
        socket.emit("systemMessage", {
          text: "Personal information was detected and hidden for safety. Please keep things anonymous.",
        });
      }

      // Crisis detection
      if (safety.crisisDetected) {
        // Send crisis resources to both users
        socket.emit("crisisResources", { message: CRISIS_RESOURCES_MESSAGE });
        io.to(socket.partner).emit("crisisResources", {
          message: CRISIS_RESOURCES_MESSAGE,
        });
      }

      // Track messages for emotion monitoring
      if (!sessionMessages.has(socket.id)) sessionMessages.set(socket.id, []);
      sessionMessages.get(socket.id).push(safety.filtered);

      // AI safety co-pilot: check every 3rd message
      socket.messageCount++;
      if (socket.messageCount % 3 === 0) {
        _emotionCheck(socket, io, sessionMessages.get(socket.id));
      }

      // Reset idle timer
      _resetIdleTimer(socket, io);

      // Deliver (possibly masked) message
      io.to(socket.partner).emit("receiveMessage", {
        text: safety.filtered,
        senderName: socket.anonName,
        timestamp: Date.now(),
      });
    });

    // ---- Emoji Reaction ----
    socket.on("emojiReaction", (emoji) => {
      if (!socket.partner) return;
      if (!EMOJI_REACTIONS.includes(emoji)) return;
      io.to(socket.partner).emit("emojiReaction", {
        emoji,
        senderName: socket.anonName,
      });
    });

    // ---- Typing (debounced client-side, forwarded here) ----
    socket.on("typing", () => {
      if (socket.partner) {
        io.to(socket.partner).emit("partnerTyping");
      }
    });

    socket.on("stopTyping", () => {
      if (socket.partner) {
        io.to(socket.partner).emit("partnerStopTyping");
      }
    });

    // ---- Warm-up ended ----
    socket.on("warmupReady", () => {
      socket.warmupEnded = true;
      if (socket.partner) {
        io.to(socket.partner).emit("partnerWarmupReady");
      }
    });

    // ---- Report ----
    socket.on("reportPartner", (data) => {
      if (!socket.partner) return;
      const reportedHash = hashSocket(
        io.sockets.sockets.get(socket.partner) || {
          id: socket.partner,
          handshake: {},
        },
      );
      const current = reportCounts.get(reportedHash) || 0;
      reportCounts.set(reportedHash, current + 1);

      // Auto shadow-ban thresholds
      if (current + 1 >= 6) {
        shadowBanned.add(reportedHash);
      } else if (current + 1 >= 3) {
        shadowBanned.add(reportedHash);
        // 24h ban — remove after timeout
        setTimeout(
          () => shadowBanned.delete(reportedHash),
          24 * 60 * 60 * 1000,
        );
      }

      socket.emit("systemMessage", {
        text: "Report received. Thank you for helping keep the community safe.",
      });
      _disconnectPair(socket, io, "reported");
    });

    // ---- Block ----
    socket.on("blockPartner", () => {
      if (!socket.partner) return;
      socket.emit("systemMessage", {
        text: "Partner blocked. Finding a new match...",
      });
      _disconnectPair(socket, io, "blocked");
    });

    // ---- Leave Chat ----
    socket.on("leaveChat", () => {
      _disconnectPair(socket, io, "left");
    });

    // ---- Post-chat feedback ----
    socket.on("feedback", (data) => {
      // data: { positive: boolean, tags: string[] }
      if (!socket._lastPartnerId) return;
      const partnerHash = socket._lastPartnerHash;
      if (!partnerHash) return;
      const current = trustScores.get(partnerHash) || 0;
      if (data?.positive) {
        trustScores.set(partnerHash, current + 1);
      } else {
        trustScores.set(partnerHash, Math.max(0, current - 1));
      }
    });

    // ---- Reconnect code request ----
    socket.on("requestReconnect", async () => {
      if (!socket.partner) return;
      socket._wantsReconnect = true;
      const partnerSocket = io.sockets.sockets.get(socket.partner);
      if (partnerSocket && partnerSocket._wantsReconnect) {
        // Both agreed — generate code and persist to Redis
        const code = generateReconnectCode();
        const hashA = hashSocket(socket);
        const hashB = hashSocket(partnerSocket);
        try {
          await reconnectStore.set(code, hashA, hashB);
        } catch (err) {
          console.warn("Redis reconnect store failed:", err.message);
        }
        socket.emit("reconnectCode", { code });
        partnerSocket.emit("reconnectCode", { code });
      } else {
        // Waiting for partner
        socket.emit("systemMessage", {
          text: "Reconnect request sent to your partner.",
        });
        if (partnerSocket) {
          partnerSocket.emit("reconnectRequest");
        }
      }
    });

    // ---- Gratitude card ----
    socket.on("sendGratitude", (index) => {
      if (!socket.partner) return;
      const card = GRATITUDE_CARDS[index] || GRATITUDE_CARDS[0];
      io.to(socket.partner).emit("gratitudeCard", {
        text: card,
        senderName: socket.anonName,
      });
    });

    // ---- Disconnect ----
    socket.on("disconnect", () => {
      matchingEngine.removeFromQueue(socket.id);

      if (socket.partner) {
        const partnerSocket = io.sockets.sockets.get(socket.partner);
        if (partnerSocket) {
          partnerSocket._lastPartnerId = socket.id;
          partnerSocket._lastPartnerHash = hashSocket(socket);
          partnerSocket.partner = null;
          partnerSocket.emit("partnerDisconnected", { reason: "disconnected" });
        }
      }

      _clearTimers(socket);
      rateLimiter.clear(socket.id);
      sessionMessages.delete(socket.id);
      userHashes.delete(socket.id);
      console.log("[Anon] Disconnected:", socket.id);
    });
  });

  // ---- Internal helpers ----

  function _disconnectPair(socket, ioRef, reason) {
    const partnerId = socket.partner;
    if (partnerId) {
      const partnerSocket = ioRef.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket._lastPartnerId = socket.id;
        partnerSocket._lastPartnerHash = hashSocket(socket);
        partnerSocket.partner = null;
        partnerSocket.emit("partnerDisconnected", { reason });
        _clearTimers(partnerSocket);
      }
    }
    socket._lastPartnerId = partnerId;
    socket._lastPartnerHash = partnerId
      ? hashSocket(
          ioRef.sockets.sockets.get(partnerId) || {
            id: partnerId,
            handshake: {},
          },
        )
      : null;
    socket.partner = null;
    socket.emit("chatEnded", { reason });
    _clearTimers(socket);
  }

  function _clearTimers(socket) {
    if (socket.idleTimer) {
      clearTimeout(socket.idleTimer);
      socket.idleTimer = null;
    }
    if (socket.sessionTimer) {
      clearTimeout(socket.sessionTimer);
      socket.sessionTimer = null;
    }
    if (socket.idleWarningTimer) {
      clearTimeout(socket.idleWarningTimer);
      socket.idleWarningTimer = null;
    }
  }

  function _resetIdleTimer(socket, ioRef) {
    if (socket.idleWarningTimer) clearTimeout(socket.idleWarningTimer);
    if (socket.idleTimer) clearTimeout(socket.idleTimer);

    // Warn at 4 min idle
    socket.idleWarningTimer = setTimeout(
      () => {
        if (socket.partner) {
          socket.emit("systemMessage", {
            text: "You've been idle for 4 minutes. Chat will end in 1 minute if no activity.",
          });
        }
      },
      4 * 60 * 1000,
    );

    // Disconnect at 5 min idle
    socket.idleTimer = setTimeout(
      () => {
        if (socket.partner) {
          socket.emit("systemMessage", {
            text: "Chat ended due to inactivity.",
          });
          _disconnectPair(socket, ioRef, "idle");
        }
      },
      5 * 60 * 1000,
    );
  }

  function _startSessionTimer(socket, ioRef) {
    // Gentle nudge at 45 min
    socket.sessionTimer = setTimeout(
      () => {
        if (socket.partner) {
          socket.emit("systemMessage", {
            text: "You've been chatting for 45 minutes — that's great! Consider taking a break if you need one. 💙",
          });
        }
      },
      45 * 60 * 1000,
    );
  }

  async function _emotionCheck(socket, ioRef, recentMessages) {
    // Call emotion_detection service for last 3 messages
    if (!recentMessages || recentMessages.length < 3) return;
    const lastThree = recentMessages.slice(-3).join(". ");

    try {
      const emotionUrl =
        process.env.EMOTION_DETECTION_URL || "http://emotion_detection:8001";
      const resp = await fetch(`${emotionUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lastThree }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return;
      const data = await resp.json();

      // Check for severe negative sentiment
      const sentiment = data?.sentiment;
      if (
        sentiment &&
        (sentiment.sentiment === "very_negative" ||
          (sentiment.score !== undefined && sentiment.score < -0.6))
      ) {
        socket.emit("systemMessage", {
          text: "It sounds like things are getting heavy. Remember, you're not alone. Here are resources if you need them. 💙",
          showCrisisLink: true,
        });
      }
    } catch {
      // Silently fail — emotion check is best-effort
    }
  }

  return io;
}

module.exports = {
  setupAnonymousChat,
};
