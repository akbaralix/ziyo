import crypto from "node:crypto";
import os from "node:os";
import mongoose from "mongoose";
import User from "../db/User/User.js";
import QuizGame from "../db/Quiz/QuizGame.js";
import GameSession from "../db/Quiz/GameSession.js";
import OTP from "../db/OTP/otp.js";
import VisitLog from "../db/Analytics/VisitLog.js";
import { isDbConnected } from "../db/db.js";
import {
  getMemoryOtpStats,
  listMemoryQuizzes,
  listMemorySessions,
  listMemoryUsers,
} from "../db/memoryStore.js";

// Socket.IO instansiyasi saqlanadigan joy
let ioInstance = null;

// So'nggi 5 daqiqadagi faollik xotirada tezkor ushlab turiladi (in-memory)
// key: ipHash yoki userId, value: timestamp
const recentActiveClients = new Map();

// Har 1 daqiqada 15 daqiqadan eski faolliklarni tozalab turish
setInterval(() => {
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  for (const [key, timestamp] of recentActiveClients.entries()) {
    if (timestamp < fifteenMinutesAgo) {
      recentActiveClients.delete(key);
    }
  }
}, 60 * 1000);

export function setSocketIO(io) {
  ioInstance = io;
}

export function getSocketIO() {
  return ioInstance;
}

// IP manzilini xavfsiz heshlash (maxfiylikni saqlash maqsadida)
function hashIp(ip = "") {
  return crypto.createHash("sha256").update(String(ip || "127.0.0.1")).digest("hex").slice(0, 24);
}

// User-Agent orqali qurilma turini aniqlash
function detectDevice(userAgent = "") {
  const ua = String(userAgent).toLowerCase();
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) {
    return /ipad|tablet/i.test(ua) ? "tablet" : "mobile";
  }
  return "desktop";
}

// Tashrifni qayd qilish (Express middleware orqali chaqiriladi)
export async function recordVisit(req) {
  try {
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "127.0.0.1";
    const ipHash = hashIp(rawIp);
    const userAgent = req.headers["user-agent"] || "";
    const device = detectDevice(userAgent);
    const path = req.originalUrl || req.url || "/";
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const userId = req.user?._id || null;

    // In-memory active tracker yangilash
    const activeKey = userId ? `user:${userId}` : `ip:${ipHash}`;
    recentActiveClients.set(activeKey, Date.now());

    if (mongoose.connection.readyState !== 1) {
      return;
    }

    // Foydalanuvchining lastActiveAt maydonini yangilash
    if (userId) {
      User.updateOne({ _id: userId }, { lastActiveAt: now }).catch(() => {});
    }

    // Bazaga asinxron upsert (kutmasdan orqa fonda bajariladi)
    VisitLog.findOneAndUpdate(
      { date: todayStr, ipHash },
      {
        $inc: { hits: 1 },
        $set: {
          lastSeenAt: now,
          device,
          path,
          ...(userId ? { userId } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch((err) => {
      // Duplicate key error poygalarida xatolik chiqmasligi uchun
      if (err.code !== 11000) {
        console.error("VisitLog upsert xatosi:", err.message);
      }
    });
  } catch (error) {
    // Analytics xatosi asosiy so'rovga xalal bermasligi kerak
  }
}

// Real-vaqt onlayn statistikasi
export function getOnlineStats() {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fifteenMinAgo = now - 15 * 60 * 1000;

  let active5m = 0;
  let active15m = 0;
  let loggedInActive5m = 0;

  for (const [key, lastSeen] of recentActiveClients.entries()) {
    if (lastSeen >= fiveMinAgo) {
      active5m++;
      if (key.startsWith("user:")) loggedInActive5m++;
    }
    if (lastSeen >= fifteenMinAgo) {
      active15m++;
    }
  }

  // Socket.IO ulanishlar soni
  let socketCount = 0;
  if (ioInstance) {
    try {
      socketCount = ioInstance.engine?.clientsCount || ioInstance.sockets?.sockets?.size || 0;
    } catch {}
  }

  // Real-time online odamlar: socketlar yoki so'nggi 5 daqiqada faol bo'lganlar
  const totalOnline = Math.max(socketCount, active5m);

  return {
    socketCount,
    totalOnline,
    active5m,
    active15m,
    loggedInActive5m,
  };
}

// Tashriflar (Saytga kirganlar) statistikasi
export async function getTrafficStats() {
  if (!isDbConnected()) {
    return {
      today: { uniqueVisitors: 0, totalHits: 0, mobile: 0, desktop: 0 },
      thisWeek: { uniqueVisitors: 0 },
      thisMonth: { uniqueVisitors: 0, totalHits: 0 },
      allTimeHits: 0,
    };
  }
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Bugungi tashriflar
  const todayAggregation = await VisitLog.aggregate([
    { $match: { date: todayStr } },
    {
      $group: {
        _id: null,
        uniqueVisitors: { $sum: 1 },
        totalHits: { $sum: "$hits" },
        mobile: { $sum: { $cond: [{ $eq: ["$device", "mobile"] }, 1, 0] } },
        desktop: { $sum: { $cond: [{ $eq: ["$device", "desktop"] }, 1, 0] } },
      },
    },
  ]);

  const todayData = todayAggregation[0] || {
    uniqueVisitors: 0,
    totalHits: 0,
    mobile: 0,
    desktop: 0,
  };

  // 2. 7 kunlik (shu hafta) unikal tashrif buyuruvchilar
  const weekVisitors = await VisitLog.distinct("ipHash", {
    createdAt: { $gte: sevenDaysAgo },
  });

  // 3. 30 kunlik (1 oy ichida) unikal tashrif buyuruvchilar va jami ko'rishlar
  const monthAggregation = await VisitLog.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: null,
        totalHits: { $sum: "$hits" },
        uniqueIps: { $addToSet: "$ipHash" },
      },
    },
  ]);

  const monthHits = monthAggregation[0]?.totalHits || 0;
  const monthUniqueCount = monthAggregation[0]?.uniqueIps?.length || 0;

  // Jami barcha vaqtlardagi hits
  const totalAllHits = await VisitLog.aggregate([
    { $group: { _id: null, total: { $sum: "$hits" } } },
  ]);

  return {
    today: {
      uniqueVisitors: todayData.uniqueVisitors,
      totalHits: todayData.totalHits,
      mobile: todayData.mobile,
      desktop: todayData.desktop,
    },
    thisWeek: {
      uniqueVisitors: weekVisitors.length,
    },
    thisMonth: {
      uniqueVisitors: monthUniqueCount,
      totalHits: monthHits,
    },
    allTimeHits: totalAllHits[0]?.total || 0,
  };
}

// Foydalanuvchilar statistikasi
export async function getUserStats() {
  if (!isDbConnected()) {
    const allUsers = listMemoryUsers();
    const places = { maktab: 0, institut: 0, ustoz: 0 };
    let totalXp = 0;
    let activeReaders = 0;
    for (const u of allUsers) {
      totalXp += u.xp || 0;
      if (u.readingBook?.bookId) activeReaders++;
      if (u.studyPlace && places[u.studyPlace] !== undefined) {
        places[u.studyPlace]++;
      }
    }
    const topUsers = [...allUsers]
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 5);
    const recentUsers = [...allUsers]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
    return {
      totalUsers: allUsers.length,
      todayUsers: allUsers.length,
      weekUsers: allUsers.length,
      monthUsers: allUsers.length,
      studyPlaces: places,
      activeReaders,
      totalXp,
      avgXp: allUsers.length ? Math.round(totalXp / allUsers.length) : 0,
      topUsers,
      recentUsers,
    };
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    todayUsers,
    weekUsers,
    monthUsers,
    studyPlaces,
    activeReaders,
    totalXpData,
    topUsers,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfToday } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.aggregate([
      {
        $group: {
          _id: "$studyPlace",
          count: { $sum: 1 },
        },
      },
    ]),
    User.countDocuments({ "readingBook.bookId": { $exists: true, $ne: "" } }),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalXp: { $sum: "$xp" },
          avgXp: { $avg: "$xp" },
        },
      },
    ]),
    User.find({}, "firstName lastName telegramUsername xp rank studyPlace")
      .sort({ xp: -1 })
      .limit(5)
      .lean(),
    User.find({}, "firstName lastName telegramUsername studyPlace createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const places = { maktab: 0, institut: 0, ustoz: 0 };
  for (const item of studyPlaces) {
    if (item._id && places[item._id] !== undefined) {
      places[item._id] = item.count;
    }
  }

  return {
    totalUsers,
    todayUsers,
    weekUsers,
    monthUsers,
    studyPlaces: places,
    activeReaders,
    totalXp: totalXpData[0]?.totalXp || 0,
    avgXp: Math.round(totalXpData[0]?.avgXp || 0),
    topUsers,
    recentUsers,
  };
}

// Quizlar statistikasi
export async function getQuizStats() {
  if (!isDbConnected()) {
    const allQuizzes = listMemoryQuizzes();
    const allSessions = listMemorySessions();
    const totalPlays = allQuizzes.reduce((acc, q) => acc + (q.playCount || 0), 0);
    const activeSessions = allSessions.filter((s) =>
      ["waiting", "active", "question", "answer"].includes(s.status),
    ).length;
    return {
      totalQuizzes: allQuizzes.length,
      publicQuizzes: allQuizzes.filter((q) => q.isPublic).length,
      privateQuizzes: allQuizzes.filter((q) => !q.isPublic).length,
      totalPlays,
      avgQuestions: allQuizzes.length
        ? Math.round(
            allQuizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0) /
              allQuizzes.length,
          )
        : 0,
      totalSessions: allSessions.length,
      activeSessions,
      topQuizzes: [...allQuizzes]
        .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
        .slice(0, 5),
      recentQuizzes: allQuizzes.slice(0, 3),
    };
  }
  const [
    totalQuizzes,
    publicQuizzes,
    privateQuizzes,
    playCountData,
    totalSessions,
    activeSessions,
    topQuizzes,
    recentQuizzes,
  ] = await Promise.all([
    QuizGame.countDocuments(),
    QuizGame.countDocuments({ isPublic: true }),
    QuizGame.countDocuments({ isPublic: false }),
    QuizGame.aggregate([
      {
        $group: {
          _id: null,
          totalPlays: { $sum: "$playCount" },
          avgQuestions: { $avg: { $size: "$questions" } },
        },
      },
    ]),
    GameSession.countDocuments(),
    GameSession.countDocuments({
      status: { $in: ["waiting", "active", "question", "answer"] },
    }),
    QuizGame.find({}, "title playCount questions isPublic")
      .sort({ playCount: -1 })
      .limit(5)
      .lean(),
    QuizGame.find({}, "title host createdAt")
      .populate("host", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
  ]);

  return {
    totalQuizzes,
    publicQuizzes,
    privateQuizzes,
    totalPlays: playCountData[0]?.totalPlays || 0,
    avgQuestions: Math.round(playCountData[0]?.avgQuestions || 0),
    totalSessions,
    activeSessions,
    topQuizzes,
    recentQuizzes,
  };
}

// OTP / Login statistikasi
export async function getOtpStats() {
  if (!isDbConnected()) {
    return getMemoryOtpStats();
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalOtps,
    verifiedOtps,
    claimedOtps,
    pendingOtps,
    expiredOtps,
    todayOtps,
    monthOtps,
  ] = await Promise.all([
    OTP.countDocuments(),
    OTP.countDocuments({ verified: true }),
    OTP.countDocuments({ isClaimed: true }),
    OTP.countDocuments({ verified: false, expiresAt: { $gt: now } }),
    OTP.countDocuments({ verified: false, expiresAt: { $lte: now } }),
    OTP.countDocuments({ createdAt: { $gte: startOfToday } }),
    OTP.countDocuments({ createdAt: { $gte: startOfMonth } }),
  ]);

  const conversionRate = totalOtps > 0 ? Math.round((verifiedOtps / totalOtps) * 100) : 0;

  return {
    totalOtps,
    verifiedOtps,
    claimedOtps,
    pendingOtps,
    expiredOtps,
    todayOtps,
    monthOtps,
    conversionRate,
  };
}

// Server va tizim parametrlari
export function getServerStats() {
  const uptimeSeconds = Math.floor(process.uptime());
  const days = Math.floor(uptimeSeconds / (24 * 3600));
  const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  const mem = process.memoryUsage();
  const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
  const totalSystemMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeSystemMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);

  const dbStateMap = {
    0: "🔴 Uzilgan (Disconnected)",
    1: "🟢 Bog'langan (Connected)",
    2: "🟡 Ulanmoqda (Connecting)",
    3: "🟠 Uzilmoqda (Disconnecting)",
  };

  return {
    uptime: `${days > 0 ? `${days}k ` : ""}${hours}s ${minutes}m ${seconds}s`,
    memory: {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      totalSystemMemGB,
      freeSystemMemGB,
    },
    nodeVersion: process.version,
    platform: `${process.platform} (${process.arch})`,
    dbStatus: dbStateMap[mongoose.connection.readyState] || "Noma'lum",
    timestamp: new Date().toLocaleTimeString("uz-UZ", { hour12: false }),
  };
}

// Barcha asosiy ko'rsatkichlarni bitta umumiy ob'ektga yig'ish (Dashboard)
export async function getFullDashboardStats() {
  const [online, traffic, users, quizzes, otp, server] = await Promise.all([
    getOnlineStats(),
    getTrafficStats(),
    getUserStats(),
    getQuizStats(),
    getOtpStats(),
    getServerStats(),
  ]);

  return {
    online,
    traffic,
    users,
    quizzes,
    otp,
    server,
  };
}
