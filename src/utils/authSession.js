// In-memory auth session store (no JWT tokens persisted in localStorage/sessionStorage)
let inMemoryToken = null;
const listeners = new Set();

// Clean up any legacy token left in browser storage from earlier versions
try {
  if (typeof window !== "undefined") {
    window.localStorage?.removeItem("token");
    window.sessionStorage?.removeItem("token");
  }
} catch {
  // Ignore storage access errors in restricted contexts
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener(inMemoryToken);
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function getAuthToken() {
  return inMemoryToken;
}

export function setAuthToken(token) {
  inMemoryToken = typeof token === "string" && token.trim() ? token.trim() : null;
  notifyListeners();
}

export function setAuthSession(token, user) {
  inMemoryToken = typeof token === "string" && token.trim() ? token.trim() : null;
  try {
    if (typeof window !== "undefined" && user) {
      const userStr = JSON.stringify(user);
      const profileStr = JSON.stringify({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        username: user.username || user.telegramUsername || "user",
        profilePic: user.profilePic || "",
        bio: user.bio || "",
        studyPlace: user.studyPlace,
        course: user.course,
        xp: user.xp || 0,
        readingBook: user.readingBook?.currentPage || 0,
        solvedQuizzes: user.solvedQuizzes || 0,
      });

      window.localStorage?.setItem("hatify_user", userStr);
      window.localStorage?.setItem("hatify_user_profile", profileStr);
      window.localStorage?.setItem("ziyo_user", userStr);
      window.localStorage?.setItem("ziyo_user_profile", profileStr);
      window.dispatchEvent(new Event("storage"));
    }
  } catch {
    // Ignore storage errors
  }
  notifyListeners();
}

export function clearAuthSession() {
  inMemoryToken = null;
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.removeItem("token");
      window.sessionStorage?.removeItem("token");
      window.localStorage?.removeItem("hatify_user");
      window.localStorage?.removeItem("hatify_user_profile");
      window.localStorage?.removeItem("ziyo_user");
      window.localStorage?.removeItem("ziyo_user_profile");
      window.dispatchEvent(new Event("storage"));
    }
  } catch {
    // Ignore storage errors
  }
  notifyListeners();
}

export function subscribeAuthToken(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
