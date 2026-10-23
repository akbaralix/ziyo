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
 * Profil ma'lumotlarini olish (O'zimniki)
 */
export async function getUserProfile() {
  return await apiClient("/api/auth/me", {
    method: "GET",
  });
}

/**
 * Boshqa foydalanuvchi profilini olish (ID yoki username orqali)
 */
export async function getUserProfileById(idOrUsername) {
  return await apiClient(`/api/auth/user/${encodeURIComponent(idOrUsername)}`, {
    method: "GET",
  });
}

/**
 * Kitob o'qish progressini serverga saqlash
 */
export async function saveReadingProgress(data) {
  return await apiClient("/api/auth/reading-progress", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
