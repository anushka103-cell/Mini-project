# MindSafe — In-App Manual Testing Steps

> Open your browser to **http://localhost:3000** and follow each step below.
> All backend services are confirmed **UP and healthy** (13/13 containers).

---

## Test 1: Landing Page

**URL:** `http://localhost:3000/`

- [ ] Page loads with dark theme, gradient background, hero text: _"A safe world where your mind can breathe"_
- [ ] 6 feature cards visible: AI Companion, Anonymous Support, Mood Tracking, Avatars, Games, Privacy
- [ ] Click **"Get Started Free"** → goes to `/signup`
- [ ] Go back, click **"Sign In"** → goes to `/login`

---

## Test 2: Sign Up

**URL:** `http://localhost:3000/signup`

- [ ] Form shows: Email, Password, Confirm Password fields
- [ ] **"Create account"** button is disabled initially
- [ ] Type email: `testuser@mindsafe.local`
- [ ] Type password: `TestPass123!@`
  - [ ] Password checklist updates in real-time (8+ chars, letter, number, match)
- [ ] Confirm password: `TestPass123!@`
- [ ] **"Create account"** button becomes enabled
- [ ] Click **"Create account"**
- [ ] Success message appears with email verification info
- [ ] If a **"Verify Email Now"** button appears (dev mode), click it
- [ ] **"Continue with Google"** button is visible (don't click unless Google OAuth is configured)

> **Save these credentials — you'll use them for the rest of the tests.**

---

## Test 3: Email Verification

If you got a verification token/link in the previous step:

- [ ] Click the verify link or go to `/verify-email?token=<token>`
- [ ] Success message: email verified

If no token was returned (production mode), verify manually:

```powershell
docker exec mindsafe_postgres psql -U mindsafe_admin -d mindsafe_db -c "UPDATE users SET is_verified = true WHERE email = 'testuser@mindsafe.local';"
```

---

## Test 4: Login

**URL:** `http://localhost:3000/login`

### 4a. Email + Password Login

- [ ] Default tab is **"Email + Password"**
- [ ] Enter email: `testuser@mindsafe.local`
- [ ] Enter password: `TestPass123!@`
- [ ] Click **"Sign in"**
- [ ] Redirects to `/dashboard`

### 4b. Wrong Password (Error Handling)

- [ ] Go back to `/login`
- [ ] Enter correct email but wrong password: `wrongpassword`
- [ ] Click **"Sign in"**
- [ ] Error message appears (invalid credentials)

### 4c. Mobile + OTP Tab

- [ ] Click the **"Mobile + OTP"** tab
- [ ] Form changes to mobile number + OTP fields
- [ ] **"Request OTP"** button is visible

### 4d. Forgot Password

- [ ] Click **"Forgot password?"** link
- [ ] Enter email, submit
- [ ] Confirmation message appears

> **Now log in successfully and stay logged in for the remaining tests.**

---

## Test 5: Dashboard

**URL:** `http://localhost:3000/dashboard` (auto-redirect after login)

- [ ] Greeting message visible (_"Good morning/afternoon/evening"_)
- [ ] Wellness tip of the day shown
- [ ] 5 navigation cards visible:
  - [ ] 🤖 **Talk to AI** → click → goes to `/ai-companion`
  - [ ] 👤 **Connect Anonymously** → leads to `/anonymous`
  - [ ] 💙 **Log Your Mood** → leads to `/mood`
  - [ ] 🎮 **Relax & Play** → leads to `/games`
  - [ ] 🧑‍🎨 **Manage Avatar** → leads to `/avatar`
- [ ] If new user, onboarding flow may appear — complete it
- [ ] Sidebar navigation is visible and all links work

---

## Test 6: AI Companion (Chatbot)

**URL:** `http://localhost:3000/ai-companion`

This is the **core feature** — test thoroughly.

### 6a. Send a Message

- [ ] Chat interface loads with message input at bottom
- [ ] Type: `I've been feeling stressed about my exams lately`
- [ ] Click **Send** (or press Enter)
- [ ] AI response appears within a few seconds
- [ ] Response should be empathetic and relevant to stress/exams

### 6b. Continue Conversation

- [ ] Type: `What can I do to feel better?`
- [ ] Send the message
- [ ] AI responds with coping strategies or recommendations

### 6c. Test Response Style

- [ ] Find the response style dropdown (warm, professional, casual, etc.)
- [ ] Change to a different style
- [ ] Send another message: `Tell me a calming thought`
- [ ] Response tone should match selected style

### 6d. Settings Toggles

- [ ] Toggle **"Use my name in responses"** on/off
- [ ] Toggle **"Remember past conversations"** on/off
- [ ] Send another message and observe behavior changes

### 6e. Voice Playback (if available)

- [ ] Click **Voice Settings** button
- [ ] Adjust pitch, rate, volume sliders
- [ ] Send a message — check if voice reads the response aloud
- [ ] Click **Stop** to stop playback

---

## Test 7: Mood Tracker

**URL:** `http://localhost:3000/mood`

### 7a. Log a Mood

- [ ] **"Log"** tab is active by default
- [ ] Select a mood level (5 emojis: 😢 Terrible → 😊 Great)
- [ ] Select emotion tags: e.g., **Anxious**, **Tired**
- [ ] Select activity tags: e.g., **Exercise**, **Reading**
- [ ] Select trigger tags: e.g., **Work stress**
- [ ] Type optional notes: `Feeling better after a walk`
- [ ] Click **"Log Mood"**
- [ ] Success message appears

### 7b. Log a Second Mood (Same Day)

- [ ] Change mood to a different level (e.g., 😊 Great)
- [ ] Select different emotions: **Happy**, **Calm**
- [ ] Add notes: `Had a good evening`
- [ ] Click **"Log Mood"**
- [ ] Success — both entries should coexist (same-day append)

### 7c. View Charts

- [ ] Click the **"Charts"** tab
- [ ] Line chart shows mood intensity over time
- [ ] Pie chart or bar chart shows emotion distribution
- [ ] Data from your logged entries appears

### 7d. View History

- [ ] Click the **"History"** tab
- [ ] Both mood entries appear (newest first)
- [ ] Each entry shows mood score, emotions, notes, timestamp

### 7e. View Insights

- [ ] Click the **"Insights"** tab
- [ ] Shows wellness recommendations based on your mood level
- [ ] Suggestions change depending on low/mid/high mood

---

## Test 8: Profile

**URL:** `http://localhost:3000/profile`

- [ ] Email is displayed (read-only) with verification badge
- [ ] Anonymized User ID shown (read-only)
- [ ] Edit **Full Name**: `Test User`
- [ ] Edit **Mobile Number**: `+1234567890`
- [ ] Edit **Anonymous Name**: `BraveOwl42`
- [ ] Toggle **Anonymous Mode** on
- [ ] Click **"Save Profile"**
- [ ] Success message appears
- [ ] Refresh page → saved data persists

---

## Test 9: Avatar Customization

**URL:** `http://localhost:3000/avatar`

- [ ] 3D avatar renders in the canvas (WebGL)
- [ ] Click **"Show Customizer"** to open customization panel
- [ ] Change **avatar preset** — avatar updates in real-time
- [ ] Adjust **skin tone** color picker
- [ ] Adjust **hair color** color picker
- [ ] Adjust **clothing color** color picker
- [ ] Select a different **background** (living room, etc.)
- [ ] Adjust **voice settings**: pitch, rate, volume sliders
- [ ] Type a message in the chat input — avatar responds with emotion animation
- [ ] Close customizer panel

---

## Test 10: Insights & Analytics

**URL:** `http://localhost:3000/insights`

- [ ] Page loads with mood analytics
- [ ] **Total entries** count matches what you logged in Test 7
- [ ] **Average mood intensity** shown (0-10 scale)
- [ ] **Most frequent mood** displayed
- [ ] **Line chart**: mood intensity over time
- [ ] **Bar chart**: mood distribution by type
- [ ] Contextual insight message appears below charts

---

## Test 11: Emergency Help

**URL:** `http://localhost:3000/emergency`

- [ ] Page loads with crisis helplines list
- [ ] Helplines visible:
  - [ ] Vandrevala Foundation (24/7)
  - [ ] iCall
  - [ ] AASRA (24/7)
  - [ ] Snehi (24/7)
  - [ ] NIMHANS Helpline
- [ ] Phone numbers are clickable (tel: links)
- [ ] 5 coping step cards visible:
  - [ ] 🌬️ Breathe Slowly
  - [ ] 🧊 Grounding Technique (5-4-3-2-1)
  - [ ] 🚰 Drink Water
  - [ ] 📝 Write It Down
  - [ ] 🤝 Reach Out

---

## Test 12: Games & Wellness Activities

**URL:** `http://localhost:3000/games`

- [ ] Activity grid loads with 10 tiles
- [ ] Filter buttons visible: **All**, **Relaxation**, **Games**, **Wellness**
- [ ] Click each filter — tiles filter correctly

### 12a. Test a Breathing Exercise

- [ ] Click **"Guided Breathing"**
- [ ] Breathing patterns load (box breathing, 4-7-8, etc.)
- [ ] Follow the animation/timer
- [ ] Exercise completes or can be stopped

### 12b. Test a Game

- [ ] Go back to games grid
- [ ] Click **"Color Match"** (Stroop challenge)
- [ ] Game starts — match colors vs. text
- [ ] Score/lives display works
- [ ] Game ends, high score saved

### 12c. Test Gratitude Jar

- [ ] Click **"Gratitude Jar"**
- [ ] Type something you're grateful for
- [ ] Submit → appears in the jar
- [ ] Entries persist (localStorage)

### 12d. Test Affirmations

- [ ] Click **"Affirmations"**
- [ ] Affirmation cards display
- [ ] Favorite an affirmation (heart icon)
- [ ] Filter by favorites

---

## Test 13: Anonymous Peer Support

**URL:** `http://localhost:3000/anonymous`

- [ ] Chat interface loads
- [ ] Random DiceBear avatar generated for you
- [ ] Message input field visible
- [ ] Type: `Hi, I'm looking for someone to talk to`
- [ ] Click **Send**
- [ ] Message appears in chat
- [ ] **Soundscape controls** visible:
  - [ ] Select a sound: Rain, Ocean, Forest, Night, White Noise
  - [ ] Play button works — ambient sound plays
  - [ ] Volume slider adjusts volume
  - [ ] Stop button stops playback

> **Note:** A real peer connection requires another user on the other end. In solo testing, you can verify the UI loads and messages send without errors.

---

## Test 14: Sidebar Navigation

From any protected page:

- [ ] Sidebar is visible on the left
- [ ] All navigation links present:
  - [ ] Dashboard
  - [ ] AI Companion
  - [ ] Mood Tracker
  - [ ] Profile
  - [ ] Avatar
  - [ ] Insights
  - [ ] Emergency
  - [ ] Games
  - [ ] Anonymous
- [ ] Current page is highlighted in sidebar
- [ ] Clicking each link navigates correctly
- [ ] Sidebar collapses on mobile viewport (resize browser to ~375px)

---

## Test 15: Theme & Responsiveness

- [ ] App uses dark theme by default
- [ ] Toggle dark/light mode (if toggle exists in sidebar/header)
- [ ] Theme persists on page refresh
- [ ] Resize browser to mobile (375px) — layout adapts
- [ ] Resize to tablet (768px) — layout adapts
- [ ] Resize to desktop (1440px) — full layout

---

## Test 16: Auth Guard & Logout

### 16a. Auth Guard

- [ ] Open a new incognito/private window
- [ ] Go to `http://localhost:3000/dashboard` directly
- [ ] Should redirect to `/login` (not authenticated)
- [ ] Go to `http://localhost:3000/mood` directly
- [ ] Should redirect to `/login`

### 16b. Logout

- [ ] In your logged-in session, find and click **Logout**
- [ ] Redirects to `/login` or `/`
- [ ] Try accessing `/dashboard` — redirects to login
- [ ] Log back in to confirm re-login works

---

## Quick Summary Checklist

| #   | Feature                                      | Status |
| --- | -------------------------------------------- | ------ |
| 1   | Landing page loads                           | ☐      |
| 2   | Signup works                                 | ☐      |
| 3   | Email verification works                     | ☐      |
| 4   | Login works                                  | ☐      |
| 5   | Dashboard loads with cards                   | ☐      |
| 6   | AI Companion sends/receives messages         | ☐      |
| 7   | Mood Tracker: log, charts, history, insights | ☐      |
| 8   | Profile: edit and save                       | ☐      |
| 9   | Avatar: 3D renders, customization works      | ☐      |
| 10  | Insights: charts and analytics load          | ☐      |
| 11  | Emergency: helplines and coping steps shown  | ☐      |
| 12  | Games: activities launch and function        | ☐      |
| 13  | Anonymous: chat UI and soundscapes work      | ☐      |
| 14  | Sidebar navigation works on all pages        | ☐      |
| 15  | Theme toggle and responsive layout           | ☐      |
| 16  | Auth guard blocks unauthenticated access     | ☐      |
