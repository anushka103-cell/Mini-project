"use client";

/**
 * AvatarServiceClient
 * RESTful API client for MindSafe backend services
 * Handles mood tracking, emotions, recommendations, crisis detection
 * Includes retry logic, caching, and offline support
 */

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://mindsafe-api.onrender.com/api";
const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

class AvatarServiceClient {
  constructor(baseUrl = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.cache = new Map();
    this.requestQueue = [];
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Listen for online/offline events
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.flushQueue();
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
      });
    }
  }

  /**
   * Make API request with retry logic and caching
   * @param {string} method - HTTP method
   * @param {string} path - API path (relative to baseUrl)
   * @param {Object} data - Request body (for POST/PUT)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, data = null, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const cacheKey = `${method}:${url}`;

    // Check cache for GET requests
    if (method === "GET") {
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
    }

    // If offline and has cache, return cached
    if (!this.isOnline && method === "GET") {
      const cached = this.getCached(cacheKey, true); // Ignore expiry
      if (cached) return cached;
    }

    // Queue request if offline (non-GET only)
    if (!this.isOnline && method !== "GET") {
      return this.queueRequest(method, path, data, options);
    }

    let lastError;

    // Retry logic
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.makeRequest(url, method, data, options);

        // Cache successful GET responses
        if (method === "GET") {
          this.setCached(cacheKey, response);
        }

        return response;
      } catch (error) {
        lastError = error;

        // Don't retry on 4xx errors (client errors)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Exponential backoff
        if (attempt < MAX_RETRIES - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError;
  }

  /**
   * Internal fetch wrapper with timeout
   */
  async makeRequest(url, method, data, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchOptions = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: controller.signal,
      };

      if (
        data &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        fetchOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw {
          status: response.status,
          message: response.statusText,
          data: await response.json().catch(() => null),
        };
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Cache management
   */
  getCached(key, ignoreExpiry = false) {
    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > CACHE_DURATION_MS;
    if (isExpired && !ignoreExpiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(pattern = null) {
    if (!pattern) {
      this.cache.clear();
    } else {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Offline request queuing
   */
  queueRequest(method, path, data, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        method,
        path,
        data,
        options,
        resolve,
        reject,
      });
    });
  }

  async flushQueue() {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    for (const item of queue) {
      try {
        const result = await this.request(
          item.method,
          item.path,
          item.data,
          item.options,
        );
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== API Endpoints ====================

  /**
   * Mood Tracking Endpoints
   */

  async trackMood(moodData) {
    /**
     * POST /mood/track
     * Track a mood reading
     * @param {Object} moodData
     *   - emotion: string ('happy', 'sad', etc)
     *   - valence: number (-1 to 1)
     *   - arousal: number (0 to 1)
     *   - context: object (activity, location, trigger)
     *   - note: string (optional user note)
     */
    return this.request("POST", "/mood/track", moodData);
  }

  async getMoodHistory(options = {}) {
    /**
     * GET /mood/history
     * Get emotion history
     * @param {Object} options
     *   - days: number (default: 7)
     *   - limit: number (default: 100)
     */
    const params = new URLSearchParams(options).toString();
    return this.request("GET", `/mood/history?${params}`);
  }

  async getMoodToday() {
    /**
     * GET /mood/today
     * Get today's mood summary
     */
    return this.request("GET", "/mood/today");
  }

  async getMoodWeeklySummary() {
    /**
     * GET /mood/weekly
     * Get weekly mood summary
     */
    return this.request("GET", "/mood/weekly");
  }

  /**
   * Emotion Analysis Endpoints
   */

  async analyzeEmotion(text) {
    /**
     * POST /emotion/analyze
     * Deep emotion analysis of text
     */
    return this.request("POST", "/emotion/analyze", { text });
  }

  async getEmotionTrends() {
    /**
     * GET /emotion/trends
     * Get emotion trends over time
     */
    return this.request("GET", "/emotion/trends");
  }

  async detectEmotionDominant(windowDays = 7) {
    /**
     * GET /emotion/dominant
     * Get dominant emotion in time window
     */
    return this.request("GET", `/emotion/dominant?days=${windowDays}`);
  }

  /**
   * Recommendation Endpoints
   */

  async getRecommendations(options = {}) {
    /**
     * GET /recommendations
     * Get personalized recommendations
     * @param {Object} options
     *   - type: 'coping' | 'activity' | 'meditation' | 'connection'
     *   - limit: number
     */
    const params = new URLSearchParams(options).toString();
    return this.request("GET", `/recommendations?${params}`);
  }

  async getRecommendationForEmotion(emotion) {
    /**
     * GET /recommendations/:emotion
     * Get recommendation for specific emotion
     */
    return this.request("GET", `/recommendations/${emotion}`);
  }

  /**
   * Crisis Detection Endpoints
   */

  async detectCrisis(text) {
    /**
     * POST /crisis/detect
     * Check for crisis indicators
     */
    return this.request("POST", "/crisis/detect", { text });
  }

  async getCrisisResources() {
    /**
     * GET /crisis/resources
     * Get crisis resources and hotlines
     */
    return this.request("GET", "/crisis/resources");
  }

  async reportCrisisEvent(eventData) {
    /**
     * POST /crisis/report
     * Report a crisis event (for emergency responders)
     */
    return this.request("POST", "/crisis/report", eventData);
  }

  /**
   * Avatar Preset Endpoints
   */

  async getAvatarPresets() {
    /**
     * GET /avatar/presets
     * Get user's saved avatar presets
     */
    return this.request("GET", "/avatar/presets");
  }

  async saveAvatarPreset(name, appearanceData) {
    /**
     * POST /avatar/presets
     * Save current avatar configuration
     */
    return this.request("POST", "/avatar/presets", {
      name,
      appearance: appearanceData,
    });
  }

  async deleteAvatarPreset(presetId) {
    /**
     * DELETE /avatar/presets/:id
     * Delete a saved preset
     */
    return this.request("DELETE", `/avatar/presets/${presetId}`);
  }

  /**
   * Analytics Endpoints
   */

  async getAnalytics(timeRange = "7d") {
    /**
     * GET /analytics
     * Get user analytics dashboard
     */
    return this.request("GET", `/analytics?range=${timeRange}`);
  }

  async getMentalHealthScore() {
    /**
     * GET /analytics/health-score
     * Get overall mental health score
     */
    return this.request("GET", "/analytics/health-score");
  }

  /**
   * Health Check / Service Status
   */

  async healthCheck() {
    /**
     * GET /health
     * Check if API is available
     */
    return this.request("GET", "/health");
  }

  /**
   * User Profile Endpoints
   */

  async getUserProfile() {
    /**
     * GET /user/profile
     * Get current user profile
     */
    return this.request("GET", "/user/profile");
  }

  async updateUserProfile(profileData) {
    /**
     * PUT /user/profile
     * Update user profile
     */
    return this.request("PUT", "/user/profile", profileData);
  }

  /**
   * Utility method for custom endpoints
   */

  async customRequest(method, path, data = null) {
    return this.request(method, path, data);
  }
}

// Export singleton instance
const avatarServiceClient = new AvatarServiceClient();

export default avatarServiceClient;
export { AvatarServiceClient };
