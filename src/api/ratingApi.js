import { apiClient } from "./apiClient.js";

/**
 * Reytinglar bilan ishlash uchun API (Haqiqiy foydalanuvchilar ro'yxati)
 */
export async function getRatings(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/api/ratings?${query}` : "/api/ratings";
    return await apiClient(endpoint, { method: "GET" });
  } catch (err) {
    console.error("getRatings error:", err);
    return { success: false, ratings: [] };
  }
}
