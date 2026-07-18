export const WAITING_TIPS = [
  "Great chats often start with one curious question.",
  "Smile at the camera — it shows up on the other side.",
  "A simple “hey, where’s home?” breaks the ice fast.",
  "You can skip anytime. No awkward exit needed.",
  "Keep headphones ready — audio feels clearer.",
  "Short vibes welcome. Long stories welcome too.",
] as const;

export const QUEUE_LINES = [
  "People nearby are joining the pool…",
  "Looking for someone ready to talk…",
  "Almost there — keeping the match fresh…",
  "Pairing you with the next open seat…",
] as const;

export const ICEBREAKERS = [
  "Hey — what’s one good thing from your day?",
  "If you could teleport anywhere tonight, where?",
  "Coffee, tea, or neither?",
  "What song is stuck in your head lately?",
  "Are you more night owl or early bird?",
] as const;

export const REACTIONS = ["👋", "🔥", "😂", "👏", "❤️"] as const;

export type ReactionEmoji = (typeof REACTIONS)[number];

export type FloatingReaction = {
  id: string;
  emoji: ReactionEmoji;
  from: "me" | "stranger";
  x: number;
};
