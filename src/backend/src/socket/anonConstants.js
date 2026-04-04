// Anonymous Chat Constants — names, prompts, guidelines, filters

const ADJECTIVES = [
  "Calm",
  "Gentle",
  "Brave",
  "Quiet",
  "Kind",
  "Wise",
  "Warm",
  "Bright",
  "Serene",
  "Steady",
  "Caring",
  "Mellow",
  "Tender",
  "Swift",
  "Noble",
  "Joyful",
  "Mindful",
  "Peaceful",
  "Patient",
  "Hopeful",
];

const ANIMALS = [
  "Owl",
  "Fox",
  "Bear",
  "Dolphin",
  "Wolf",
  "Deer",
  "Hawk",
  "Turtle",
  "Panda",
  "Otter",
  "Koala",
  "Falcon",
  "Lynx",
  "Heron",
  "Seal",
  "Raven",
  "Crane",
  "Finch",
  "Rabbit",
  "Whale",
];

function generateAnonName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj} ${animal} ${num}`;
}

const TOPICS = [
  "anxiety",
  "loneliness",
  "academic",
  "relationships",
  "grief",
  "general",
];

const LOOKING_FOR = ["listener", "advice", "casual"];
const COMM_STYLES = ["talker", "listener", "balanced"];
const AVAILABILITY = ["5min", "15min", "30min"];
const AGE_BRACKETS = ["16-19", "20-25", "26+"];

const ICEBREAKER_PROMPTS = {
  anxiety: [
    "What's one small thing that helps you feel calmer?",
    "What does your ideal stress-free day look like?",
    "Have you found any techniques that help with worry?",
  ],
  loneliness: [
    "What's something small that made you smile recently?",
    "If you could spend a day with anyone, who would it be?",
    "What's a hobby you've always wanted to try?",
  ],
  academic: [
    "What subject gives you the most stress and why?",
    "What's one study hack that actually works for you?",
    "If grades didn't matter, what would you study?",
  ],
  relationships: [
    "What does a healthy relationship look like to you?",
    "What's the best relationship advice you've ever received?",
    "How do you recharge after social interactions?",
  ],
  grief: [
    "What's a happy memory you'd like to share?",
    "How do you honour the people you've lost?",
    "What gives you comfort on difficult days?",
  ],
  general: [
    "If you could learn one new skill instantly, what would it be?",
    "What's one thing that always makes you feel better?",
    "What are you most grateful for today?",
  ],
};

const EMOJI_REACTIONS = ["❤️", "🤗", "😊", "💪", "🙏", "✨", "🌟", "💙"];

const GRATITUDE_CARDS = [
  "Thanks for listening 💙",
  "You helped more than you know 🤗",
  "I'm glad we talked ✨",
  "You're a great listener 🌟",
  "This conversation meant a lot 💛",
  "Thank you for being kind 🙏",
];

const COMMUNITY_GUIDELINES = `
Welcome to MindSafe Anonymous Chat

By entering, you agree to:
• Be kind and respectful
• Keep conversations anonymous — don't share personal info (names, numbers, socials)
• Respect boundaries — if someone is uncomfortable, back off
• No harassment, hate speech, or sexual content
• If someone is in crisis, encourage them to seek professional help

Safety features:
• All messages are ephemeral — nothing is stored after you disconnect
• You can report or block your partner at any time
• Crisis resources are available with one click
• Type /exit at any time to leave immediately and see crisis resources

Remember: You're chatting with a real person who may be going through a tough time.
`;

// PII regex patterns
const PII_PATTERNS = [
  {
    name: "phone",
    pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  },
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  },
  { name: "social", pattern: /@[a-zA-Z0-9_]{2,30}/g },
  { name: "url", pattern: /https?:\/\/\S+/gi },
  { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
];

// Blocked words/phrases (keep short — extend as needed)
const BLOCKED_CONTENT = [
  "kys",
  "kill yourself",
  "go die",
  "neck yourself",
  "send nudes",
  "wanna sext",
  "f*ck you",
  "fk you",
];

const CRISIS_KEYWORDS_QUICK = [
  "suicide",
  "kill myself",
  "end my life",
  "take my life",
  "harm myself",
  "self harm",
  "self-harm",
  "cut myself",
  "want to die",
  "wanna die",
  "better off dead",
  "overdose",
];

const CRISIS_RESOURCES_MESSAGE = `
🆘 Crisis Resources — You Are Not Alone

• National Suicide Prevention Lifeline: 988
• Crisis Text Line: Text HOME to 741741
• Emergency Services: 911
• SAMHSA Helpline: 1-800-662-4357

If you or someone in this chat is in immediate danger, please reach out now.
`;

module.exports = {
  ADJECTIVES,
  ANIMALS,
  generateAnonName,
  TOPICS,
  LOOKING_FOR,
  COMM_STYLES,
  AVAILABILITY,
  AGE_BRACKETS,
  ICEBREAKER_PROMPTS,
  EMOJI_REACTIONS,
  GRATITUDE_CARDS,
  COMMUNITY_GUIDELINES,
  PII_PATTERNS,
  BLOCKED_CONTENT,
  CRISIS_KEYWORDS_QUICK,
  CRISIS_RESOURCES_MESSAGE,
};
