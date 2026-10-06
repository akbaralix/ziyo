import { apiClient } from "./apiClient.js";

/**
 * Reytinglar bilan ishlash uchun API
 */
export async function getRatings() {
  try {
    return await apiClient("/api/ratings", { method: "GET" });
  } catch {
    return { success: true, ratings: [] };
  }
}
