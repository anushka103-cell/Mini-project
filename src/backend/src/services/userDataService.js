const userStore = require("../repositories");

async function addChatMessage(userId, payload) {
  const message = payload.encryptedContent
    ? {
        role: payload.role,
        encrypted: true,
        encryption: payload.encryptedContent,
        sentAt: payload.sentAt || new Date().toISOString(),
      }
    : {
        role: payload.role,
        content: payload.content,
        sentAt: payload.sentAt || new Date().toISOString(),
      };

  await userStore.addChatMessage(userId, message);
  return { success: true };
}

async function getChatMessages(userId) {
  return { messages: await userStore.getUserChats(userId) };
}

async function addMoodEntry(userId, payload) {
  await userStore.addMoodEntry(userId, {
    mood: payload.mood,
    intensity: payload.intensity,
    note: payload.note,
    date: new Date(),
  });
  return { success: true };
}

async function getMoodEntries(userId) {
  return { moods: await userStore.getUserMoods(userId) };
}

async function saveAvatar(userId, avatar3D) {
  const avatar = await userStore.setUserAvatar(userId, avatar3D);
  return { success: true, avatar };
}

async function getAvatar(userId) {
  return { avatar: await userStore.getUserAvatar(userId) };
}

async function upsertProfile(userId, patch) {
  const existingProfile = (await userStore.getUserProfile(userId)) || {};
  const mergedProfile = {
    ...existingProfile,
    ...patch,
  };

  if (
    existingProfile.mobile &&
    patch.mobile &&
    existingProfile.mobile !== patch.mobile
  ) {
    mergedProfile.isMobileVerified = false;
    mergedProfile.mobileVerifiedAt = null;
  }

  await userStore.upsertUserProfile(userId, mergedProfile);
  return { success: true };
}

async function getProfile(userId, email) {
  const user = await userStore.findUserById(userId);
  const profile = (await userStore.getUserProfile(userId)) || {};

  return {
    email: user?.email || email || profile.email || "",
    anonymizedUserId: userId,
    privacy: {
      encryptedAtRest: true,
      anonymizedSubjectIds: true,
      clientManagedE2EEForStoredChat: true,
      minimumNecessaryDisclosure: true,
    },
    profile: {
      fullName: profile.fullName || "",
      mobile: profile.mobile || "",
      anonymousName: profile.anonymousName || "Anonymous",
      anonymousMode:
        typeof profile.anonymousMode === "boolean"
          ? profile.anonymousMode
          : true,
      isEmailVerified: Boolean(user?.isVerified),
      isMobileVerified: Boolean(profile.isMobileVerified),
      mobileVerifiedAt: profile.mobileVerifiedAt || null,
      role: user?.role || "user",
    },
  };
}

async function deleteAccount(userId) {
  await userStore.deleteUserById(userId);
  return { success: true };
}

// Allowed preference keys (whitelist to prevent storing arbitrary data)
const ALLOWED_PREF_KEYS = new Set([
  "avatarName", "expressionIntensity", "background", "lightingPreset",
  "cameraPreset", "autoVoice", "voiceName", "speechRate", "speechPitch",
  "speechVolume", "captionsEnabled",
]);

async function saveAvatarPreferences(userId, prefs) {
  // Sanitize: only allow known keys, enforce types/bounds
  const sanitized = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (!ALLOWED_PREF_KEYS.has(key)) continue;
    if (typeof value === "string" && value.length > 200) continue;
    sanitized[key] = value;
  }
  // Store inside the user profile under avatarPreferences key
  const existingProfile = (await userStore.getUserProfile(userId)) || {};
  await userStore.upsertUserProfile(userId, {
    ...existingProfile,
    avatarPreferences: sanitized,
  });
  return { success: true, preferences: sanitized };
}

async function getAvatarPreferences(userId) {
  const profile = (await userStore.getUserProfile(userId)) || {};
  return { preferences: profile.avatarPreferences || {} };
}

module.exports = {
  addChatMessage,
  getChatMessages,
  addMoodEntry,
  getMoodEntries,
  saveAvatar,
  getAvatar,
  saveAvatarPreferences,
  getAvatarPreferences,
  upsertProfile,
  getProfile,
  deleteAccount,
};
