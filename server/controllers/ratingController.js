import User from "../db/User/User.js";
import { isDbConnected } from "../db/db.js";
import { listMemoryUsers } from "../db/memoryStore.js";

// Darajani hisoblash yordamchi funksiyasi
const calculateLevel = (xp = 0) => {
  if (xp >= 15000) return "Grandmaster 🏆";
  if (xp >= 10000) return "Akademik 🎓";
  if (xp >= 6000) return "Master 🌟";
  if (xp >= 3000) return "Bilimdon ⚡";
  if (xp >= 1000) return "Izlanuvchi 🔍";
  if (xp >= 300) return "Harakatdagi 🚀";
  return "Boshlovchi 🌱";
};

/**
 * Real foydalanuvchilar reytingini olish
 */
export const getLeaderboard = async (req, res) => {
  try {
    let users = [];
    if (isDbConnected()) {
      // Barcha ro'yxatdan o'tgan foydalanuvchilarni olish
      users = await User.find(
        {},
        "firstName lastName username telegramUsername profilePic xp solvedQuizzes readingBook finishedBooks studyPlace course createdAt",
      )
        .sort({
          xp: -1,
          solvedQuizzes: -1,
          "readingBook.currentPage": -1,
          createdAt: 1,
        })
        .lean();
    } else {
      users = listMemoryUsers().sort((a, b) => {
        if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
        if ((b.solvedQuizzes || 0) !== (a.solvedQuizzes || 0)) {
          return (b.solvedQuizzes || 0) - (a.solvedQuizzes || 0);
        }
        const pageA = a.readingBook?.currentPage || 0;
        const pageB = b.readingBook?.currentPage || 0;
        if (pageB !== pageA) return pageB - pageA;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
    }

    const ratings = users.map((u, index) => {
      const name =
        `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Foydalanuvchi";
      const username =
        u.username ||
        u.telegramUsername ||
        (u._id ? `user_${u._id.toString().slice(-4)}` : "foydalanuvchi");

      return {
        id: u._id.toString(),
        name,
        username,
        profilePic: u.profilePic,
        xp: u.xp || 0,
        level: calculateLevel(u.xp || 0),
        solvedQuizzes: u.solvedQuizzes || 0,
        readingBook: u.readingBook?.currentPage || 0,
        finishedBooksCount: Array.isArray(u.finishedBooks)
          ? u.finishedBooks.length
          : 0,
        studyPlace: u.studyPlace || "",
        course: u.course || "",
        rank: index + 1,
        trend: "0",
        createdAt: u.createdAt,
      };
    });

    return res.json({
      success: true,
      ratings,
      totalUsers: ratings.length,
    });
  } catch (error) {
    console.error("getLeaderboard xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Reyting ma'lumotlarini yuklashda xatolik yuz berdi.",
      ratings: [],
    });
  }
};
