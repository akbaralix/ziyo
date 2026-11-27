import { getAuthToken, clearAuthSession } from "../utils/authSession.js";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Universal fetch wrapper to handle JSON requests, token headers, and error parsing
 */
export async function apiClient(endpoint, options = {}) {
  const token = getAuthToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, config);

    // If 401 Unauthorized, clear stale session cleanly so SPA router updates
    if (response.status === 401) {
      if (token && !endpoint.includes("/auth/telegram")) {
        clearAuthSession();
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiErr = new Error(
        data.error ||
          data.message ||
          `Server xatoligi yuz berdi (${response.status})`,
      );
      apiErr.status = response.status;
      throw apiErr;
    }

    return data;
  } catch (error) {
    if (error?.status !== 401) {
      console.error(`API Error [${endpoint}]:`, error);
    }
    throw error;
  }
}

export default apiClient;
