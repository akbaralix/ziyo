import { apiClient } from "./apiClient.js";

/**
 * Barcha postlarni olish (filtr va qidiruv bilan)
 */
export async function fetchPosts(params = {}) {
  const query = new URLSearchParams();
  if (params.category && params.category !== "Barchasi") {
    query.append("category", params.category);
  }
  if (params.search) {
    query.append("search", params.search);
  }
  if (params.onlyMyPosts) {
    query.append("onlyMyPosts", "true");
  }
  if (params.userId) {
    query.append("userId", params.userId);
  }
  if (params.authorId) {
    query.append("authorId", params.authorId);
  }

  const endpoint = `/api/posts${query.toString() ? `?${query.toString()}` : ""}`;
  return await apiClient(endpoint, { method: "GET" });
}

/**
 * Yangi post yaratish
 */
export async function createPost(postData) {
  return await apiClient("/api/posts", {
    method: "POST",
    body: JSON.stringify(postData),
  });
}

/**
 * Postni tahrirlash (Faqat egasi)
 */
export async function updatePost(postId, postData) {
  return await apiClient(`/api/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify(postData),
  });
}

/**
 * Postga like bosish / olib tashlash (Toggle)
 */
export async function togglePostLike(postId) {
  return await apiClient(`/api/posts/${postId}/like`, {
    method: "POST",
  });
}

/**
 * Post izohlarini olish
 */
export async function fetchComments(postId) {
  return await apiClient(`/api/posts/${postId}/comments`, {
    method: "GET",
  });
}

/**
 * Postga yangi izoh yozish
 */
export async function addComment(postId, text) {
  return await apiClient(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

/**
 * Quiz javobini serverda tekshirish (Xavfsiz)
 */
export async function submitQuizAnswer(postId, selectedOption) {
  return await apiClient(`/api/posts/${postId}/answer`, {
    method: "POST",
    body: JSON.stringify({ selectedOption }),
  });
}

/**
 * Postni o'chirish (Faqat egasi)
 */
export async function deletePost(postId) {
  return await apiClient(`/api/posts/${postId}`, {
    method: "DELETE",
  });
}

/**
 * Post haqida shikoyat yuborish (Telegram bot orqali admin chatga)
 */
export async function reportPost(postId, reason) {
  return await apiClient(`/api/posts/${postId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
