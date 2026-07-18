const STORAGE_KEY = "skipcam-moments-v1";

export type MomentsStats = {
  total: number;
  streak: number;
  lastDay: string | null;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function read(): MomentsStats {
  if (typeof window === "undefined") {
    return { total: 0, streak: 0, lastDay: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { total: 0, streak: 0, lastDay: null };
    const parsed = JSON.parse(raw) as Partial<MomentsStats>;
    return {
      total: Number(parsed.total) || 0,
      streak: Number(parsed.streak) || 0,
      lastDay: typeof parsed.lastDay === "string" ? parsed.lastDay : null,
    };
  } catch {
    return { total: 0, streak: 0, lastDay: null };
  }
}

function write(stats: MomentsStats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function getMoments(): MomentsStats {
  return read();
}

/** Call once when a live video session successfully connects. */
export function recordMoment(): MomentsStats {
  const current = read();
  const today = todayKey();
  const yesterday = yesterdayKey();

  let streak = current.streak;
  if (current.lastDay === today) {
    // Already counted a moment today — keep streak, still bump total
  } else if (current.lastDay === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  const next: MomentsStats = {
    total: current.total + 1,
    streak,
    lastDay: today,
  };
  write(next);
  return next;
}
