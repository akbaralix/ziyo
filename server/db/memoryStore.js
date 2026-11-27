import crypto from "node:crypto";

// In-memory fallback store used only when MongoDB is disconnected (readyState !== 1)
const otpSessions = new Map();
const users = new Map();
const quizzes = new Map();
const gameSessions = new Map();

export function generateMemoryId() {
  return crypto.randomBytes(12).toString("hex");
}

// Periodically purge expired in-memory OTP sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of otpSessions.entries()) {
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= now) {
      otpSessions.delete(token);
    }
  }
}, 60 * 1000).unref?.();

// ===================== OTP SESSIONS =====================

export function createMemoryOtpSession({ token, expiresAt }) {
  const session = {
    token,
    tokenHash: null,
    expiresAt: new Date(expiresAt),
    telegramId: null,
    telegramUsername: "",
    telegramFirstName: "",
    telegramLastName: "",
    verifiedAt: null,
    verified: false,
    isClaimed: false,
    createdAt: new Date(),
  };
  otpSessions.set(token, session);
  return session;
}

export function findMemoryOtpByToken(token) {
  if (!token) return null;
  return otpSessions.get(token) || null;
}

export function findMemoryOtpByTokenOrHash(param) {
  if (!param) return null;
  const direct = otpSessions.get(param);
  if (direct) return direct;
  for (const session of otpSessions.values()) {
    if (session.tokenHash && session.tokenHash === param) {
      return session;
    }
  }
  return null;
}

export function getMemoryOtpStats() {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const all = Array.from(otpSessions.values());

  const totalOtps = all.length;
  const verifiedOtps = all.filter((s) => s.verified).length;
  const claimedOtps = all.filter((s) => s.isClaimed).length;
  const pendingOtps = all.filter(
    (s) => !s.verified && new Date(s.expiresAt) > now,
  ).length;
  const expiredOtps = all.filter(
    (s) => !s.verified && new Date(s.expiresAt) <= now,
  ).length;
  const todayOtps = all.filter(
    (s) => new Date(s.createdAt) >= startOfToday,
  ).length;
  const monthOtps = all.filter(
    (s) => new Date(s.createdAt) >= startOfMonth,
  ).length;

  return {
    totalOtps,
    verifiedOtps,
    claimedOtps,
    pendingOtps,
    expiredOtps,
    todayOtps,
    monthOtps,
    conversionRate:
      totalOtps > 0 ? Math.round((verifiedOtps / totalOtps) * 100) : 0,
  };
}

// ===================== USERS =====================

export function findMemoryUserById(id) {
  if (!id) return null;
  return users.get(String(id)) || null;
}

export function findMemoryUserByTelegramId(telegramId) {
  if (!telegramId) return null;
  const target = String(telegramId);
  for (const user of users.values()) {
    if (String(user.telegramId) === target) {
      return user;
    }
  }
  return null;
}

export function findMemoryUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).replace(/^@/, "").trim();
  const byId = users.get(clean);
  if (byId) return byId;

  const lower = clean.toLowerCase();
  for (const user of users.values()) {
    if (
      (user.username && user.username.toLowerCase() === lower) ||
      (user.telegramUsername &&
        user.telegramUsername.toLowerCase() === lower) ||
      (user.telegramId && String(user.telegramId) === clean)
    ) {
      return user;
    }
  }
  return null;
}

export function findMemoryUsernameConflict(cleanUsername, excludeUserId) {
  const lower = String(cleanUsername).toLowerCase();
  for (const user of users.values()) {
    if (excludeUserId && String(user._id) === String(excludeUserId)) {
      continue;
    }
    if (
      (user.username && user.username.toLowerCase() === lower) ||
      (user.telegramUsername && user.telegramUsername.toLowerCase() === lower)
    ) {
      return user;
    }
  }
  return null;
}

export function saveMemoryUser(userData) {
  const id = userData._id ? String(userData._id) : generateMemoryId();
  const existing = users.get(id);
  const now = new Date();
  const record = {
    xp: 0,
    solvedQuizzes: 0,
    bio: "",
    username: "",
    telegramUsername: "",
    profilePic: "",
    coverImage: "cosmic-waves",
    readingBook: {
      bookId: "",
      title: "",
      author: "",
      img: "",
      pages: 0,
      currentPage: 0,
      updatedAt: null,
    },
    finishedBooks: [],
    createdAt: existing?.createdAt || now,
    ...existing,
    ...userData,
    _id: id,
    updatedAt: now,
  };
  users.set(id, record);
  return record;
}

export function listMemoryUsers() {
  return Array.from(users.values());
}

export function calculateMemoryUserRank(targetUser) {
  if (!targetUser) return 1;
  const curXp = targetUser.xp || 0;
  const curSolved = targetUser.solvedQuizzes || 0;
  const curPage = targetUser.readingBook?.currentPage || 0;
  const curCreated = targetUser.createdAt
    ? new Date(targetUser.createdAt).getTime()
    : Date.now();

  let higherCount = 0;
  for (const u of users.values()) {
    const xp = u.xp || 0;
    const solved = u.solvedQuizzes || 0;
    const page = u.readingBook?.currentPage || 0;
    const created = u.createdAt ? new Date(u.createdAt).getTime() : Date.now();

    if (
      xp > curXp ||
      (xp === curXp && solved > curSolved) ||
      (xp === curXp && solved === curSolved && page > curPage) ||
      (xp === curXp &&
        solved === curSolved &&
        page === curPage &&
        created < curCreated)
    ) {
      higherCount += 1;
    }
  }
  return higherCount + 1;
}

// ===================== QUIZZES =====================

export function createMemoryQuiz({
  host,
  title,
  description = "",
  gameMode,
  questionCount,
  questions,
}) {
  const _id = generateMemoryId();
  const now = new Date();
  const mappedQuestions = questions.map((q) => ({
    ...q,
    _id: q._id || generateMemoryId(),
    type: q.type === "true_false" ? "true_false" : "quiz",
    timeLimit: Number(q.timeLimit) || 20,
    points: Number(q.points) || 100,
  }));
  const derivedMode =
    gameMode ||
    (mappedQuestions.every((q) => q.type === "true_false")
      ? "true_false"
      : mappedQuestions.some((q) => q.type === "true_false")
        ? "mixed"
        : "quiz");
  const quiz = {
    _id,
    host: String(host),
    title,
    description,
    gameMode: derivedMode,
    questionCount: questionCount ?? mappedQuestions.length,
    questions: mappedQuestions,
    isPublic: true,
    playCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  quizzes.set(_id, quiz);
  return quiz;
}

export function findMemoryQuizzesByHost(hostId) {
  const target = String(hostId);
  return Array.from(quizzes.values())
    .filter((q) => String(q.host) === target)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ questions: _q, ...rest }) => ({
      ...rest,
      gameMode: rest.gameMode || "quiz",
      questionCount: rest.questionCount ?? (_q ? _q.length : 0),
    }));
}

export function findMemoryQuizByIdAndHost(id, hostId) {
  const q = quizzes.get(String(id));
  if (!q || String(q.host) !== String(hostId)) return null;
  return q;
}

export function findMemoryQuizById(id) {
  return quizzes.get(String(id)) || null;
}

export function updateMemoryQuizByIdAndHost(id, hostId, updates) {
  const q = findMemoryQuizByIdAndHost(id, hostId);
  if (!q) return null;
  if (updates.title !== undefined) q.title = updates.title;
  if (updates.description !== undefined) q.description = updates.description;
  if (updates.questions !== undefined) {
    q.questions = updates.questions;
    q.questionCount = updates.questions.length;
  }
  if (updates.gameMode !== undefined) q.gameMode = updates.gameMode;
  if (updates.questionCount !== undefined) q.questionCount = updates.questionCount;
  q.updatedAt = new Date();
  return q;
}

export function deleteMemoryQuizByIdAndHost(id, hostId) {
  const q = findMemoryQuizByIdAndHost(id, hostId);
  if (!q) return null;
  quizzes.delete(String(id));
  return q;
}

export function listMemoryQuizzes() {
  return Array.from(quizzes.values());
}

// ===================== GAME SESSIONS =====================

export function createMemoryGameSession({ quiz, host, pin }) {
  const _id = generateMemoryId();
  const now = new Date();
  const session = {
    _id,
    quiz: String(quiz),
    host: String(host),
    pin,
    status: "waiting",
    currentQuestion: -1,
    countdownEndsAt: null,
    questionStartedAt: null,
    questionEndsAt: null,
    startedAt: null,
    endedAt: null,
    reactionsEnabled: true,
    isLocked: false,
    backgroundTheme: "default",
    players: [],
    createdAt: now,
    updatedAt: now,
  };
  gameSessions.set(_id, session);
  return session;
}

export function endMemorySessionsForHost(hostId) {
  const target = String(hostId);
  const activeStatuses = new Set(["waiting", "active", "question", "answer"]);
  const now = new Date();
  const endedIds = [];
  for (const s of gameSessions.values()) {
    if (String(s.host) === target && activeStatuses.has(s.status)) {
      s.status = "ended";
      s.endedAt = now;
      endedIds.push(String(s._id));
    }
  }
  return endedIds;
}

export function findMemorySessionByPin(pin) {
  for (const s of gameSessions.values()) {
    if (s.pin === pin && s.status !== "ended") {
      return s;
    }
  }
  return null;
}

export function findMemorySessionById(id) {
  return gameSessions.get(String(id)) || null;
}

export function listMemorySessions() {
  return Array.from(gameSessions.values());
}
