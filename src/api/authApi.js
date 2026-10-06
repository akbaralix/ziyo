import { apiClient } from "./apiClient.js";

/**
 * 1. Telegram login sessiyasini boshlash (token va bot linkini olish)
 */
export async function initTelegramSession() {
  return await apiClient("/api/auth/telegram/init", {
    method: "POST",
  });
}

/**
 * 2. Telegram sessiyasini tekshirish (Botda start bosilganmi yoki yo'q)
 */
export async function checkTelegramSession(token) {
  return await apiClient(`/api/auth/telegram/check/${token}`, {
    method: "GET",
  });
}

/**
 * 3. Yangi foydalanuvchini ro'yxatdan o'tkazish (Steplar to'ldirilgach)
 */
export async function registerTelegramUser({
  token,
  telegramId,
  firstName,
  lastName,
  studyPlace,
  course,
}) {
  return await apiClient("/api/auth/telegram/register", {
    method: "POST",
    body: JSON.stringify({
      token,
      telegramId,
      firstName,
      lastName,
      studyPlace,
      course,
    }),
  });
}

/**
 * 4. Tizimdagi foydalanuvchi ma'lumotlarini olish (JWT token orqali)
 */
export async function getMe() {
  return await apiClient("/api/auth/me", {
    method: "GET",
  });
}

/**
 * 5. Tizimdan chiqish
 */
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("ziyo_user");
  localStorage.removeItem("ziyo_user_profile");
}
