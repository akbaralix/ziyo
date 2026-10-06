import User from "../db/User/User.js";

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
    const { timeframe, category } = req.query;

    // Barcha ro'yxatdan o'tgan foydalanuvchilarni olish
    const users = await User.find(
      {},
      "firstName lastName telegramUsername avatar xp solvedQuizzes readBooks studyPlace course createdAt"
    )
      .sort({ xp: -1, solvedQuizzes: -1, readBooks: -1, createdAt: 1 })
      .lean();

    const ratings = users.map((u, index) => {
      const name =
        `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Foydalanuvchi";
      const username =
        u.telegramUsername ||
        (u._id ? `user_${u._id.toString().slice(-4)}` : "foydalanuvchi");

      return {
        id: u._id.toString(),
        name,
        username,
        avatar: u.avatar || "",
        xp: u.xp || 0,
        level: calculateLevel(u.xp || 0),
        solvedQuizzes: u.solvedQuizzes || 0,
        readBooks: u.readBooks || 0,
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
