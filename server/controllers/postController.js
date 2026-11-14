import mongoose from "mongoose";
import Post from "../db/Post/Post.js";
import Comment from "../db/Post/Comment.js";
import User from "../db/User/User.js";
import { sendPostReportToAdmin } from "../bot/bot.js";

// 1. Yangi post yaratish
export const createPost = async (req, res) => {
  try {
    const {
      type,
      title,
      content,
      category,
      tags,
      options,
      correctOption,
      explanation,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Sarlavha kiritilishi shart!",
      });
    }

    if (type === "quiz" && (!options || options.length < 2)) {
      return res.status(400).json({
        success: false,
        message: "Viktorina uchun kamida 2 ta variant bo'lishi kerak!",
      });
    }

    const author = req.user;
    const fullName =
      `${author.firstName || ""} ${author.lastName || ""}`.trim() ||
      "Foydalanuvchi";

    const post = new Post({
      author: author._id,
      user: {
        id: author._id,
        name: fullName,
        username: author.telegramUsername || "user",
        profilePic: author.profilePic || "",
      },
      profilePic: author.profilePic,
      type: type || "post",
      title: title.trim(),
      content: content ? content.trim() : "",
      category: category || "Dasturlash",
      tags: Array.isArray(tags) ? tags : [],
      options: type === "quiz" && Array.isArray(options) ? options : [],
      correctOption: correctOption || "a",
      explanation: explanation ? explanation.trim() : "",
      likes: [],
      commentsCount: 0,
    });

    await post.save();

    // Foydalanuvchiga XP qo'shish
    try {
      author.xp = (author.xp || 0) + 15;
      await author.save();
    } catch {
      // ignore
    }

    const postObj = post.toObject();
    if (postObj.type === "quiz") {
      delete postObj.correctOption;
      delete postObj.explanation;
    }

    const formattedPost = {
      ...postObj,
      id: post._id,
      likes: 0,
      isLiked: false,
      isAuthor: true,
    };

    return res.status(201).json({
      success: true,
      message: "Post muvaffaqiyatli yaratildi!",
      post: formattedPost,
    });
  } catch (error) {
    console.error("Post yaratish xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Postni yaratishda xatolik yuz berdi.",
      error: error.message,
    });
  }
};

// 2. Barcha postlarni olish (Filtrlash va Like holati bilan, xavfsiz quiz)
export const getPosts = async (req, res) => {
  try {
    const { category, search, onlyMyPosts, userId, authorId, page, limit } =
      req.query;
    const currentUserId = req.user?._id;

    // Barcha shartlarni to'playdigan massiv
    const conditions = [];

    // 1. Agar user login qilgan bo'lsa, o'zi allaqachon javob bergan quiz'larni yashirish
    if (currentUserId) {
      conditions.push({
        $nor: [
          {
            type: "quiz",
            "quizAnswers.user": currentUserId,
          },
        ],
      });
    }

    const targetUserId = userId || authorId;
    if (targetUserId) {
      const cleanUserStr = String(targetUserId).replace(/^@/, "").trim();
      let targetUserObjectId = null;

      if (
        mongoose.Types.ObjectId.isValid(cleanUserStr) &&
        cleanUserStr.length === 24
      ) {
        targetUserObjectId = new mongoose.Types.ObjectId(cleanUserStr);
      } else {
        try {
          const foundUser = await User.findOne({
            $or: [
              { telegramUsername: new RegExp(`^${cleanUserStr}$`, "i") },
              { telegramId: cleanUserStr },
            ],
          });
          if (foundUser) {
            targetUserObjectId = foundUser._id;
          }
        } catch (e) {
          // ignore
        }
      }

      if (targetUserObjectId) {
        conditions.push({
          $or: [
            { author: targetUserObjectId },
            { "user.id": targetUserObjectId },
          ],
        });
      } else {
        conditions.push({ author: new mongoose.Types.ObjectId() });
      }
    } else if (onlyMyPosts === "true") {
      if (!currentUserId) {
        return res.json({ success: true, posts: [] });
      }
      conditions.push({ author: currentUserId });
    }

    if (category && category !== "Barchasi") {
      conditions.push({ category: new RegExp(`^${category}$`, "i") });
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      conditions.push({
        $or: [{ title: searchRegex }, { content: searchRegex }],
      });
    }

    // Barcha shartlarni $and orqali birlashtiramiz
    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 0; // 0 bo'lsa barchasi

    const totalPosts = await Post.countDocuments(filter);

    let query = Post.find(filter).sort({ createdAt: -1 });

    if (limitNum > 0) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }

    const posts = await query.lean();

    const formattedPosts = posts.map((post) => {
      const isLiked =
        currentUserId && Array.isArray(post.likes)
          ? post.likes.some(
              (likeUserId) =>
                likeUserId.toString() === currentUserId.toString(),
            )
          : false;

      const isAuthor =
        currentUserId && post.author
          ? post.author.toString() === currentUserId.toString()
          : false;

      let userQuizAnswer = null;
      if (
        post.type === "quiz" &&
        currentUserId &&
        Array.isArray(post.quizAnswers)
      ) {
        const found = post.quizAnswers.find(
          (ans) => ans.user && ans.user.toString() === currentUserId.toString(),
        );
        if (found) {
          userQuizAnswer = {
            selected: found.selectedOption,
            isCorrect: found.isCorrect,
            correctOption: post.correctOption,
            explanation: post.explanation || "",
          };
        }
      }

      const safePost = {
        ...post,
        id: post._id,
        likes: post.likes ? post.likes.length : 0,
        isLiked,
        isAuthor,
        userQuizAnswer,
      };

      // XAVFSIZLIK: DevTools orqali oldindan to'g'ri javobni ko'rib olmasliklari uchun yashiriladi
      if (safePost.type === "quiz") {
        delete safePost.correctOption;
        delete safePost.explanation;
        delete safePost.quizAnswers;
      }

      return safePost;
    });

    return res.json({
      success: true,
      posts: formattedPosts,
      total: totalPosts,
      page: pageNum,
      hasMore: limitNum > 0 ? pageNum * limitNum < totalPosts : false,
    });
  } catch (error) {
    console.error("Postlarni olish xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Postlarni yuklashda xatolik.",
      error: error.message,
    });
  }
};

// 3. Postga Like bosish / Like qaytarib olish (Toggle)
export const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post topilmadi.",
      });
    }

    const userLikedIndex = post.likes.findIndex(
      (likeId) => likeId.toString() === userId.toString(),
    );

    let isLiked = false;

    if (userLikedIndex > -1) {
      // Like olib tashlanadi
      post.likes.splice(userLikedIndex, 1);
      isLiked = false;
    } else {
      // Like qo'shiladi
      post.likes.push(userId);
      isLiked = true;
    }

    await post.save();

    return res.json({
      success: true,
      isLiked,
      likes: post.likes.length,
    });
  } catch (error) {
    console.error("Like toggle xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Like amalida xatolik yuz berdi.",
      error: error.message,
    });
  }
};

// 4. Postga izoh (Comment) yozish
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const author = req.user;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Izoh matni bo'sh bo'lishi mumkin emas!",
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post topilmadi.",
      });
    }

    const fullName =
      `${author.firstName || ""} ${author.lastName || ""}`.trim() ||
      "Foydalanuvchi";

    const comment = new Comment({
      post: post._id,
      author: author._id,
      profilePic: author.profilePic,
      user: {
        name: fullName,
        username: author.telegramUsername || "user",
        profilePic: author.profilePic || "",
      },
      text: text.trim(),
    });

    await comment.save();

    // Izohlar sonini yangilaymiz
    const totalComments = await Comment.countDocuments({ post: post._id });
    post.commentsCount = totalComments;
    await post.save();

    return res.status(201).json({
      success: true,
      message: "Izoh qo'shildi!",
      comment: {
        ...comment.toObject(),
        id: comment._id,
      },
      commentsCount: totalComments,
    });
  } catch (error) {
    console.error("Izoh qo'shish xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Izohni saqlashda xatolik.",
      error: error.message,
    });
  }
};

// 5. Postning izohlarini olish
export const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await Comment.find({ post: id })
      .sort({ createdAt: 1 })
      .lean();

    const formattedComments = comments.map((c) => ({
      ...c,
      id: c._id,
    }));

    return res.json({
      success: true,
      comments: formattedComments,
    });
  } catch (error) {
    console.error("Izohlarni olish xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Izohlarni yuklashda xatolik.",
      error: error.message,
    });
  }
};

// 6. Postni o'chirish (Faqat egasi)
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post topilmadi.",
      });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Siz faqat o'zingiz yaratgan postni o'chira olasiz.",
      });
    }

    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Post muvaffaqiyatli o'chirildi.",
    });
  } catch (error) {
    console.error("Postni o'chirish xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Postni o'chirishda xatolik.",
      error: error.message,
    });
  }
};

// 7. Postni tahrirlash (Faqat egasi)
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      category,
      tags,
      options,
      correctOption,
      explanation,
    } = req.body;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post topilmadi.",
      });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Siz faqat o'zingiz yaratgan postni tahrirlay olasiz.",
      });
    }

    if (title && title.trim()) post.title = title.trim();
    if (content !== undefined) post.content = content.trim();
    if (category) post.category = category;
    if (Array.isArray(tags)) post.tags = tags;
    if (Array.isArray(options)) post.options = options;
    if (correctOption) post.correctOption = correctOption;
    if (explanation !== undefined) post.explanation = explanation.trim();

    await post.save();

    return res.json({
      success: true,
      message: "Post muvaffaqiyatli tahrirlandi.",
      post: {
        ...post.toObject(),
        id: post._id,
      },
    });
  } catch (error) {
    console.error("Postni tahrirlash xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Postni tahrirlashda xatolik yuz berdi.",
      error: error.message,
    });
  }
};

// 8. Viktorina (Quiz) javobini serverda xavfsiz tekshirish va bazaga saqlash
export const checkQuizAnswer = async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedOption } = req.body;

    if (!selectedOption) {
      return res.status(400).json({
        success: false,
        message: "Tanlangan javob varianti ko'rsatilmadi.",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Viktorina savoliga javob berish uchun tizimga kiring!",
      });
    }

    const post = await Post.findById(id);
    if (!post || post.type !== "quiz") {
      return res.status(404).json({
        success: false,
        message: "Viktorina posti topilmadi.",
      });
    }

    // Foydalanuvchi bu quizga avval javob berganmi tekshiramiz
    const alreadyAnswered =
      Array.isArray(post.quizAnswers) &&
      post.quizAnswers.some(
        (ans) => ans.user && ans.user.toString() === req.user._id.toString(),
      );

    if (alreadyAnswered) {
      return res.status(400).json({
        success: false,
        message: "Siz ushbu viktorinaga allaqachon javob bergansiz!",
        alreadyAnswered: true,
        correctOption: post.correctOption,
        explanation: post.explanation || "",
      });
    }

    const isCorrect = post.correctOption === selectedOption;

    // Bazaga javobni saqlaymiz
    if (!Array.isArray(post.quizAnswers)) {
      post.quizAnswers = [];
    }
    post.quizAnswers.push({
      user: req.user._id,
      selectedOption,
      isCorrect,
      answeredAt: new Date(),
    });
    await post.save();

    // Agar foydalanuvchi to'g'ri topsa, unga XP va test statistikasini oshirish
    if (isCorrect) {
      try {
        req.user.xp = (req.user.xp || 0) + 10;
        req.user.solvedQuizzes = (req.user.solvedQuizzes || 0) + 1;
        await req.user.save();
      } catch {
        // ignore
      }
    }

    return res.json({
      success: true,
      isCorrect,
      selectedOption,
      correctOption: post.correctOption,
      explanation: post.explanation || "",
    });
  } catch (error) {
    console.error("Quiz javobini tekshirish xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Javobni tekshirishda xatolik yuz berdi.",
      error: error.message,
    });
  }
};

// 9. Post ustidan shikoyat qilish (Telegram bot orqali 907402803 chatiga)
export const reportPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post topilmadi.",
      });
    }

    const reporter = req.user
      ? {
          id: req.user._id,
          name:
            `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
            "Foydalanuvchi",
          username: req.user.telegramUsername || "user",
        }
      : {
          id: "mehmon",
          name: "Mehmon foydalanuvchi",
          username: "anonim",
        };

    const sent = await sendPostReportToAdmin({
      post,
      reporter,
      reason: reason?.trim() || "Qoidabuzarlik / Nomaqbul kontent",
    });

    return res.json({
      success: true,
      message: "Shikoyatingiz qabul qilindi va ma'muriyatga yuborildi. Rahmat!",
      telegramSent: sent,
    });
  } catch (error) {
    console.error("Shikoyat yuborishda xatolik:", error);
    return res.status(500).json({
      success: false,
      message: "Shikoyatni yuborishda xatolik yuz berdi.",
      error: error.message,
    });
  }
};
