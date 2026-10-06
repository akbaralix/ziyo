import apiClient from "./apiClient.js";

// ===================== QUIZ GAME CRUD =====================

export async function createQuizGame(data) {
  return apiClient("/api/quiz", { method: "POST", body: JSON.stringify(data) });
}

export async function getMyQuizGames() {

  return apiClient("/api/quiz/my");
}

export async function getQuizGameById(id) {
  return apiClient(`/api/quiz/${id}`);
}

export async function updateQuizGame(id, data) {
  return apiClient(`/api/quiz/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteQuizGame(id) {
  return apiClient(`/api/quiz/${id}`, { method: "DELETE" });
}

// ===================== GAME SESSION =====================

export async function createGameSession(quizId) {
  return apiClient(`/api/quiz/${quizId}/session`, { method: "POST" });
}

export async function joinByPin(pin) {
  return apiClient(`/api/quiz/join/${pin}`);
}

export async function getSessionResults(sessionId) {
  return apiClient(`/api/quiz/session/${sessionId}/results`);
}
