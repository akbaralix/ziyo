import { apiClient } from "./apiClient.js";

/**
 * Foydalanuvchi profilini yangilash
 */
export async function updateProfile(data) {
  return await apiClient("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Profil ma'lumotlarini olish
 */
export async function getUserProfile() {
  return await apiClient("/api/auth/me", {
    method: "GET",
  });
}
