const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Universal fetch wrapper to handle JSON requests, token headers, and error parsing
 */
export async function apiClient(endpoint, options = {}) {
  const token = localStorage.getItem("token");

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

    // If 401 Unauthorized, handle token expiration
    if (response.status === 401) {
      // If we got unauthorized on protected route, clean expired token
      if (token && !endpoint.includes("/auth/telegram")) {
        localStorage.removeItem("token");
        localStorage.removeItem("ziyo_user");
        window.location.href = "/login";
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || `Server xatoligi yuz berdi (${response.status})`
      );
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

export default apiClient;

