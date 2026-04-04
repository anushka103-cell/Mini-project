// Scored matching engine for anonymous chat
// Uses in-memory queue with scored pairing

const { TOPICS } = require("./anonConstants");

class MatchingEngine {
  constructor() {
    // Map<socketId, { socket, preferences, joinedAt }>
    this.queue = new Map();
    this.matchInterval = null;
  }

  start() {
    // Run matching sweep every 2 seconds
    this.matchInterval = setInterval(() => this._sweep(), 2000);
  }

  stop() {
    if (this.matchInterval) {
      clearInterval(this.matchInterval);
      this.matchInterval = null;
    }
  }

  addToQueue(socket, preferences) {
    this.queue.set(socket.id, {
      socket,
      preferences,
      joinedAt: Date.now(),
    });
    // Try immediate match
    this._tryMatchFor(socket.id);
    this._broadcastQueuePositions();
  }

  removeFromQueue(socketId) {
    this.queue.delete(socketId);
    this._broadcastQueuePositions();
  }

  getQueuePosition(socketId) {
    const ids = [...this.queue.keys()];
    const idx = ids.indexOf(socketId);
    return idx === -1 ? -1 : idx + 1;
  }

  get queueSize() {
    return this.queue.size;
  }

  // ---- Scoring ----

  _score(prefA, prefB, waitA, waitB) {
    let score = 0;

    // 1. Topic overlap (40 points max)
    const topicsA = new Set(prefA.topics || []);
    const topicsB = new Set(prefB.topics || []);
    let overlap = 0;
    for (const t of topicsA) {
      if (topicsB.has(t)) overlap++;
    }
    if (topicsA.size > 0 && topicsB.size > 0) {
      score += (overlap / Math.max(topicsA.size, topicsB.size)) * 40;
    } else {
      score += 20; // both picked nothing — neutral
    }

    // 2. Communication style complement (25 points)
    const sA = prefA.commStyle || "balanced";
    const sB = prefB.commStyle || "balanced";
    if (
      (sA === "talker" && sB === "listener") ||
      (sA === "listener" && sB === "talker")
    ) {
      score += 25;
    } else if (sA === "balanced" || sB === "balanced") {
      score += 15;
    } else {
      score += 5; // same style
    }

    // 3. Mood safety (20 points) — avoid pairing two low-mood users
    const mA = prefA.mood || 3;
    const mB = prefB.mood || 3;
    if (mA <= 2 && mB <= 2) {
      score += 0; // dangerous pair — penalise
    } else if (mA <= 2 || mB <= 2) {
      // One low, one stable — good
      score += mA <= 2 ? (mB >= 3 ? 20 : 10) : mA >= 3 ? 20 : 10;
    } else {
      score += 15;
    }

    // 4. Availability match (10 points)
    if (prefA.availability === prefB.availability) {
      score += 10;
    } else {
      const order = { "5min": 0, "15min": 1, "30min": 2 };
      const diff = Math.abs(
        (order[prefA.availability] ?? 1) - (order[prefB.availability] ?? 1),
      );
      score += diff <= 1 ? 5 : 0;
    }

    // 5. Trust bonus (5 points)
    const tA = prefA.trustScore || 0;
    const tB = prefB.trustScore || 0;
    score += Math.min((tA + tB) / 4, 5);

    // 6. Age bracket bonus
    if (
      prefA.ageBracket &&
      prefB.ageBracket &&
      prefA.ageBracket === prefB.ageBracket
    ) {
      score += 5;
    }

    // 7. Peer listener bonus
    if (
      (prefA.isListener && prefB.lookingFor === "listener") ||
      (prefB.isListener && prefA.lookingFor === "listener")
    ) {
      score += 15;
    }

    // 8. Trigger warning exclusion — hard filter
    const triggersA = new Set(prefA.triggerWarnings || []);
    const triggersB = new Set(prefB.triggerWarnings || []);
    for (const t of topicsA) {
      if (triggersB.has(t)) return -1; // incompatible
    }
    for (const t of topicsB) {
      if (triggersA.has(t)) return -1; // incompatible
    }

    // 9. Wait time bonus — relax standards over time
    const maxWait = Math.max(waitA, waitB);
    if (maxWait > 90000)
      score += 20; // 90s+: boost any match
    else if (maxWait > 60000)
      score += 10; // 60s+
    else if (maxWait > 30000) score += 5; // 30s+

    // 10. Reconnect code preference (handled externally — matched before queue)

    return score;
  }

  _tryMatchFor(targetId) {
    if (!this.queue.has(targetId)) return null;

    const target = this.queue.get(targetId);
    let bestId = null;
    let bestScore = -1;

    for (const [id, entry] of this.queue) {
      if (id === targetId) continue;

      const waitA = Date.now() - target.joinedAt;
      const waitB = Date.now() - entry.joinedAt;
      const s = this._score(
        target.preferences,
        entry.preferences,
        waitA,
        waitB,
      );
      if (s > bestScore) {
        bestScore = s;
        bestId = id;
      }
    }

    // Minimum threshold (relaxes over time via wait bonus)
    const waitTime = Date.now() - target.joinedAt;
    const threshold = waitTime > 60000 ? 10 : waitTime > 30000 ? 20 : 30;

    if (bestId && bestScore >= threshold) {
      return this._createMatch(targetId, bestId, bestScore);
    }
    return null;
  }

  _sweep() {
    if (this.queue.size < 2) return;

    const ids = [...this.queue.keys()];
    const matched = new Set();

    // Greedy best-pair sweep
    for (let i = 0; i < ids.length; i++) {
      if (matched.has(ids[i])) continue;
      let bestJ = -1;
      let bestScore = -1;

      for (let j = i + 1; j < ids.length; j++) {
        if (matched.has(ids[j])) continue;
        const eA = this.queue.get(ids[i]);
        const eB = this.queue.get(ids[j]);
        const s = this._score(
          eA.preferences,
          eB.preferences,
          Date.now() - eA.joinedAt,
          Date.now() - eB.joinedAt,
        );
        if (s > bestScore) {
          bestScore = s;
          bestJ = j;
        }
      }

      const waitTime = Date.now() - this.queue.get(ids[i]).joinedAt;
      const threshold = waitTime > 60000 ? 10 : waitTime > 30000 ? 20 : 30;

      if (bestJ !== -1 && bestScore >= threshold) {
        this._createMatch(ids[i], ids[bestJ], bestScore);
        matched.add(ids[i]);
        matched.add(ids[bestJ]);
      }
    }
  }

  _createMatch(idA, idB, score) {
    const entryA = this.queue.get(idA);
    const entryB = this.queue.get(idB);
    if (!entryA || !entryB) return null;

    this.queue.delete(idA);
    this.queue.delete(idB);

    const socketA = entryA.socket;
    const socketB = entryB.socket;

    socketA.partner = idB;
    socketB.partner = idA;
    socketA.partnerPrefs = entryB.preferences;
    socketB.partnerPrefs = entryA.preferences;
    socketA.matchScore = score;
    socketB.matchScore = score;

    // Determine shared topic for ice-breakers
    const topicsA = new Set(entryA.preferences.topics || []);
    const topicsB = new Set(entryB.preferences.topics || []);
    let sharedTopic = "general";
    for (const t of topicsA) {
      if (topicsB.has(t)) {
        sharedTopic = t;
        break;
      }
    }

    // Determine warm-up
    const warmA = entryA.preferences.warmup || "off";
    const warmB = entryB.preferences.warmup || "off";
    // If either wants warm-up, use it
    let warmupDuration = "off";
    if (warmA !== "off" || warmB !== "off") {
      const order = { off: 0, "1min": 1, "2min": 2, "5min": 3, untilReady: 4 };
      warmupDuration =
        (order[warmA] || 0) >= (order[warmB] || 0) ? warmA : warmB;
    }

    const matchData = {
      partnerName: null, // set per-socket below
      sharedTopic,
      warmupDuration,
    };

    socketA.sharedTopic = sharedTopic;
    socketB.sharedTopic = sharedTopic;
    socketA.warmupDuration = warmupDuration;
    socketB.warmupDuration = warmupDuration;
    socketA.warmupEnded = warmupDuration === "off";
    socketB.warmupEnded = warmupDuration === "off";
    socketA.messageCount = 0;
    socketB.messageCount = 0;
    socketA.lastMessageAt = Date.now();
    socketB.lastMessageAt = Date.now();

    const matchPayloadA = {
      ...matchData,
      partnerName: entryB.preferences.anonName,
      partnerAvatar: entryB.preferences.avatarSeed,
      partnerIsListener: !!entryB.preferences.isListener,
    };
    const matchPayloadB = {
      ...matchData,
      partnerName: entryA.preferences.anonName,
      partnerAvatar: entryA.preferences.avatarSeed,
      partnerIsListener: !!entryA.preferences.isListener,
    };

    socketA.emit("matched", matchPayloadA);
    socketB.emit("matched", matchPayloadB);

    // Fire onMatch callback if set (used by anonymousChat for session init)
    if (typeof this.onMatch === "function") {
      this.onMatch(socketA, socketB, { sharedTopic, warmupDuration });
    }

    this._broadcastQueuePositions();
    return { idA, idB, score, sharedTopic };
  }

  _broadcastQueuePositions() {
    let pos = 1;
    for (const [, entry] of this.queue) {
      entry.socket.emit("queuePosition", {
        position: pos,
        total: this.queue.size,
      });
      pos++;
    }
  }
}

module.exports = { MatchingEngine };
