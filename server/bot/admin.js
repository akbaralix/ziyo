import { Markup } from "telegraf";
import User from "../db/User/User.js";
import { isDbConnected } from "../db/db.js";
import { listMemoryUsers } from "../db/memoryStore.js";
import {
  getFullDashboardStats,
  getUserStats,
  getQuizStats,
  getOtpStats,
  getTrafficStats,
  getOnlineStats,
  getServerStats,
} from "../services/analyticsService.js";

function getAdminIds(defaultAdminId) {
  const ids = new Set();
  if (defaultAdminId) ids.add(String(defaultAdminId));
  if (process.env.ADMIN_CHAT_ID)
    ids.add(String(process.env.ADMIN_CHAT_ID).trim());
  if (process.env.ADMIN_IDS) {
    process.env.ADMIN_IDS.split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }
  return ids;
}

export function isUserAdmin(userId, defaultAdminId) {
  if (!userId) return false;
  const adminIds = getAdminIds(defaultAdminId);
  return adminIds.has(String(userId));
}

function escapeHtml(text = "") {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Boshqaruv tugmalari (Inline Keyboards)
export function getAdminKeyboard(currentSection = "overview") {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        currentSection === "overview" ? "📊 • Bosh Panel •" : "📊 Bosh Panel",
        "admin:overview",
      ),
      Markup.button.callback(
        currentSection === "traffic"
          ? "🌐 • Onlayn & Tashrif •"
          : "🌐 Onlayn & Tashrif",
        "admin:traffic",
      ),
    ],
    [
      Markup.button.callback(
        currentSection === "users"
          ? "👥 • Foydalanuvchilar •"
          : "👥 Foydalanuvchilar",
        "admin:users",
      ),
      Markup.button.callback(
        currentSection === "quizzes" ? "🎯 • Quizlar •" : "🎯 Quizlar",
        "admin:quizzes",
      ),
    ],
    [
      Markup.button.callback(
        currentSection === "otp" ? "🔐 • OTP & Kirish •" : "🔐 OTP & Kirish",
        "admin:otp",
      ),
      Markup.button.callback(
        currentSection === "server" ? "🖥 • Server •" : "🖥 Server",
        "admin:server",
      ),
    ],
    [
      Markup.button.callback(
        "📢 Xabar yuborish (Broadcast)",
        "admin:broadcast_prompt",
      ),
      Markup.button.callback("🔄 Yangilash", `admin:refresh:${currentSection}`),
    ],
  ]);
}

// 1. Asosiy umumiy tahlil ko'rinishi (Dashboard Overview)
export async function renderOverviewMessage() {
  const data = await getFullDashboardStats();
  const time = new Date().toLocaleTimeString("uz-UZ", { hour12: false });

  let text = `👑 <b>HATIFY PLATFORMASI — ADMIN BOSHQARUV PANELI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Real-time onlayn
  text += `🟢 <b>REAL VAQTDA ONLAYN:</b>\n`;
  text += `├ ⚡ <b>Hozir saytda:</b> <code>${data.online.totalOnline}</code> kishi\n`;
  text += `├ 🔌 <b>Socket ulanishlar:</b> <code>${data.online.socketCount}</code> ta\n`;
  text += `└ ⏱ <b>So'nggi 5 daqiqada faol:</b> <code>${data.online.active5m}</code> kishi\n\n`;

  // Saytga tashriflar
  text += `🌐 <b>SAYTGA TASHRIFLAR (TRAFFIC):</b>\n`;
  text += `├ 📅 <b>Bugun kirganlar:</b> <code>${data.traffic.today.uniqueVisitors}</code> unikal foydalanuvchi\n`;
  text += `├ 👁 <b>Bugungi so'rovlar:</b> <code>${data.traffic.today.totalHits}</code> ta ko'rish\n`;
  text += `├ 🗓 <b>1 oy ichida kirganlar:</b> <code>${data.traffic.thisMonth.uniqueVisitors}</code> unikal odam\n`;
  text += `└ 📊 <b>Shu hafta kirganlar:</b> <code>${data.traffic.thisWeek.uniqueVisitors}</code> kishi\n\n`;

  // Foydalanuvchilar
  text += `👥 <b>FOYDALANUVCHILAR:</b>\n`;
  text += `├ 👤 <b>Jami ro'yxatdan o'tganlar:</b> <code>${data.users.totalUsers}</code> ta\n`;
  text += `├ 🆕 <b>Bugun yangi:</b> +<code>${data.users.todayUsers}</code> | <b>Shu oy:</b> +<code>${data.users.monthUsers}</code>\n`;
  text += `└ 📖 <b>Kitob o'quvchilar:</b> <code>${data.users.activeReaders}</code> ta faol\n\n`;

  // Quizlar
  text += `🎯 <b>QUIZLAR VA O'YINLAR:</b>\n`;
  text += `├ 📝 <b>Jami Quizlar:</b> <code>${data.quizzes.totalQuizzes}</code> ta (🔓 ${data.quizzes.publicQuizzes} ochiq)\n`;
  text += `├ 🎮 <b>Jami o'ynalgan:</b> <code>${data.quizzes.totalPlays}</code> marta\n`;
  text += `└ 🔥 <b>Hozir aktiv o'yin xonalari:</b> <code>${data.quizzes.activeSessions}</code> ta\n\n`;

  // OTP Loginlar
  text += `🔐 <b>OTP KIRISHLAR:</b>\n`;
  text += `├ 📬 <b>Jami sessiyalar:</b> <code>${data.otp.totalOtps}</code> ta\n`;
  text += `├ ✅ <b>Tasdiqlangan:</b> <code>${data.otp.verifiedOtps}</code> ta (${data.otp.conversionRate}%)\n`;
  text += `└ ⏳ <b>Kutayotgan tokenlar:</b> <code>${data.otp.pendingOtps}</code> ta\n\n`;

  // Server
  text += `🖥 <b>SERVER HOLATI:</b>\n`;
  text += `├ ⏱ <b>Ishlash vaqti:</b> <code>${data.server.uptime}</code>\n`;
  text += `├ 💾 <b>Xotira (RAM):</b> <code>${data.server.memory.heapUsedMB} MB</code> / ${data.server.memory.rssMB} MB\n`;
  text += `└ 🗄 <b>Baza (MongoDB):</b> ${data.server.dbStatus}\n\n`;

  text += `🕒 <i>Oxirgi yangilanish: ${time}</i>`;

  return text;
}

// 2. Foydalanuvchilar batafsil tahlili
export async function renderUsersMessage() {
  const users = await getUserStats();
  const time = new Date().toLocaleTimeString("uz-UZ", { hour12: false });

  let text = `👥 <b>FOYDALANUVCHILAR STATISTIKASI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `📊 <b>Umumiy ko'rsatkichlar:</b>\n`;
  text += `├ 👤 <b>Jami foydalanuvchilar:</b> <code>${users.totalUsers}</code> ta\n`;
  text += `├ ☀️ <b>Bugun ro'yxatdan o'tgan:</b> +<code>${users.todayUsers}</code> ta\n`;
  text += `├ 📅 <b>Oxirgi 7 kunda:</b> +<code>${users.weekUsers}</code> ta\n`;
  text += `├ 🗓 <b>1 oy ichida:</b> +<code>${users.monthUsers}</code> ta\n`;
  text += `└ ⚡ <b>Jami to'plangan XP:</b> <code>${users.totalXp.toLocaleString()}</code> ball\n\n`;

  text += `🏫 <b>O'qish joylari bo'yicha taqsimot:</b>\n`;
  text += `├ 🏫 <b>Maktab o'quvchilari:</b> <code>${users.studyPlaces.maktab}</code> ta\n`;
  text += `├ 🏛 <b>Talabalar (Institut):</b> <code>${users.studyPlaces.institut}</code> ta\n`;
  text += `└ 👨‍🏫 <b>Shaxsiy ustoz / Mustaqil:</b> <code>${users.studyPlaces.ustoz}</code> ta\n\n`;

  text += `🏆 <b>TOP 5 ENG FAOL FOYDALANUVCHILAR:</b>\n`;
  if (users.topUsers && users.topUsers.length > 0) {
    users.topUsers.forEach((u, i) => {
      const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
      const uname = u.telegramUsername
        ? `@${u.telegramUsername}`
        : "username yo'q";
      text += `${medals[i]} <b>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</b> (${uname})\n`;
      text += `   └ ⚡ <code>${u.xp || 0} XP</code> | 📍 ${u.studyPlace || "—"}\n`;
    });
  } else {
    text += `<i>Hozircha foydalanuvchilar mavjud emas</i>\n`;
  }

  text += `\n🆕 <b>SO'NGGI RO'YXATDAN O'TGANLAR:</b>\n`;
  if (users.recentUsers && users.recentUsers.length > 0) {
    users.recentUsers.forEach((u) => {
      const dateStr = u.createdAt
        ? new Date(u.createdAt).toLocaleDateString("uz-UZ")
        : "—";
      const uname = u.telegramUsername
        ? `@${u.telegramUsername}`
        : "username yo'q";
      text += `• <b>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</b> (${uname}) — <i>${dateStr}</i>\n`;
    });
  } else {
    text += `<i>Hozircha ma'lumot yo'q</i>\n`;
  }

  text += `\n🕒 <i>Oxirgi yangilanish: ${time}</i>`;
  return text;
}

// 3. Quizlar batafsil tahlili
export async function renderQuizzesMessage() {
  const quizzes = await getQuizStats();
  const time = new Date().toLocaleTimeString("uz-UZ", { hour12: false });

  let text = `🎯 <b>VIKTORINALAR (QUIZ) STATISTIKASI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `📊 <b>Umumiy ko'rsatkichlar:</b>\n`;
  text += `├ 📝 <b>Jami Quizlar:</b> <code>${quizzes.totalQuizzes}</code> ta\n`;
  text += `├ 🔓 <b>Ommaviy (Public):</b> <code>${quizzes.publicQuizzes}</code> ta\n`;
  text += `├ 🔒 <b>Shaxsiy (Private):</b> <code>${quizzes.privateQuizzes}</code> ta\n`;
  text += `├ 🎮 <b>Jami o'ynalishlar:</b> <code>${quizzes.totalPlays.toLocaleString()}</code> marta\n`;
  text += `├ 🎲 <b>O'yin sessiyalari:</b> <code>${quizzes.totalSessions}</code> ta\n`;
  text += `└ 🔴 <b>Hozir o'ynalayotgan sessiyalar:</b> <code>${quizzes.activeSessions}</code> ta\n\n`;

  text += `🔥 <b>ENG KO'P O'YNALGAN TOP QUIZLAR:</b>\n`;
  if (quizzes.topQuizzes && quizzes.topQuizzes.length > 0) {
    quizzes.topQuizzes.forEach((q, i) => {
      const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
      const qCount = q.questions ? q.questions.length : 0;
      text += `${medals[i]} <b>${escapeHtml(q.title)}</b>\n`;
      text += `   └ 🎮 <code>${q.playCount || 0}</code> marta o'ynalgan | ❓ ${qCount} ta savol\n`;
    });
  } else {
    text += `<i>Hozircha o'yinlar ro'yxatdan o'tmagan</i>\n`;
  }

  text += `\n🕒 <i>Oxirgi yangilanish: ${time}</i>`;
  return text;
}

// 4. OTP va Login batafsil tahlili
export async function renderOtpMessage() {
  const otp = await getOtpStats();
  const time = new Date().toLocaleTimeString("uz-UZ", { hour12: false });

  let text = `🔐 <b>OTP VA LOGISh SESSYALARI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `📊 <b>Sessiyalar tahlili:</b>\n`;
  text += `├ 📬 <b>Jami yaratilgan login havolalari:</b> <code>${otp.totalOtps}</code> ta\n`;
  text += `├ ✅ <b>Telegramda tasdiqlangan:</b> <code>${otp.verifiedOtps}</code> ta\n`;
  text += `├ 🚀 <b>Platformaga to'liq kirgan:</b> <code>${otp.claimedOtps}</code> ta\n`;
  text += `├ ⏳ <b>Hozir kutilayotgan (Aktiv):</b> <code>${otp.pendingOtps}</code> ta\n`;
  text += `├ ⏰ <b>Muddati o'tgan / bekor:</b> <code>${otp.expiredOtps}</code> ta\n`;
  text += `└ 📈 <b>Muvaffaqiyatli kirish ko'rsatkichi:</b> <code>${otp.conversionRate}%</code>\n\n`;

  text += `📅 <b>Vaqt oralig'i bo'yicha:</b>\n`;
  text += `├ ☀️ <b>Bugun boshlangan loginlar:</b> <code>${otp.todayOtps}</code> ta\n`;
  text += `└ 🗓 <b>Oxirgi 30 kunda (1 oyda):</b> <code>${otp.monthOtps}</code> ta\n\n`;

  text += `💡 <i>Har bir foydalanuvchi saytdan "Telegram orqali kirish" tugmasini bosganda yangi xavfsiz OTP sessiyasi hosil qilinadi.</i>\n\n`;
  text += `🕒 <i>Oxirgi yangilanish: ${time}</i>`;
  return text;
}

// 5. Tashriflar va Onlayn odamlar (Traffic & Online)
export async function renderTrafficMessage() {
  const [online, traffic] = await Promise.all([
    getOnlineStats(),
    getTrafficStats(),
  ]);
  const time = new Date().toLocaleTimeString("uz-UZ", { hour12: false });

  let text = `🌐 <b>SAYT TASHRIFLARI VA ONLAYN ODAMLAR</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `🟢 <b>REAL VAQTDA ONLAYN:</b>\n`;
  text += `├ ⚡ <b>Hozir platformada jami:</b> <code>${online.totalOnline}</code> kishi\n`;
  text += `├ 🔌 <b>Faol Socket ulanishlar:</b> <code>${online.socketCount}</code> ta\n`;
  text += `├ ⏱ <b>So'nggi 5 daqiqada faol bo'lganlar:</b> <code>${online.active5m}</code> kishi\n`;
  text += `├ 🕒 <b>So'nggi 15 daqiqada faol bo'lganlar:</b> <code>${online.active15m}</code> kishi\n`;
  text += `└ 🔑 <b>Shulardan tizimga kirganlar:</b> <code>${online.loggedInActive5m}</code> ta\n\n`;

  text += `📅 <b>SAYTGA TASHRIF BUYURGANLAR:</b>\n`;
  text += `├ ☀️ <b>BUGUN SAYTGA KIRGANLAR:</b> <code>${traffic.today.uniqueVisitors}</code> unikal odam\n`;
  text += `├ 👁 <b>Bugungi jami so'rovlar (hits):</b> <code>${traffic.today.totalHits}</code> ta\n`;
  text += `├ 📱 <b>Bugun Mobil qurilmalardan:</b> <code>${traffic.today.mobile}</code> ta\n`;
  text += `├ 💻 <b>Bugun Kompyuterdan:</b> <code>${traffic.today.desktop}</code> ta\n`;
  text += `├ 🗓 <b>1 OY ICHIDA SAYTGA KIRGANLAR:</b> <code>${traffic.thisMonth.uniqueVisitors}</code> unikal odam\n`;
  text += `├ 📈 <b>1 oylik jami sahifa ko'rishlar:</b> <code>${traffic.thisMonth.totalHits}</code> ta\n`;
  text += `├ 📊 <b>Shu haftada kirganlar (7 kun):</b> <code>${traffic.thisWeek.uniqueVisitors}</code> unikal odam\n`;
  text += `└ 🌐 <b>Barcha vaqtlardagi jami ko'rishlar:</b> <code>${traffic.allTimeHits}</code> ta\n\n`;

  text += `🕒 <i>Oxirgi yangilanish: ${time}</i>`;
  return text;
}

// 6. Server va texnik ko'rsatkichlar
export async function renderServerMessage() {
  const server = getServerStats();
  const time = new Date().toLocaleTimeString("uz-UZ", { hour12: false });

  let text = `🖥 <b>SERVER VA TIZIM SALOMATLIGI</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `⚙️ <b>Tizim parametrlari:</b>\n`;
  text += `├ ⏱ <b>Server ishlash vaqti (Uptime):</b> <code>${server.uptime}</code>\n`;
  text += `├ 🟢 <b>Node.js versiyasi:</b> <code>${server.nodeVersion}</code>\n`;
  text += `├ 💻 <b>Operatsion tizim:</b> <code>${server.platform}</code>\n`;
  text += `└ 🗄 <b>MongoDB holati:</b> ${server.dbStatus}\n\n`;

  text += `💾 <b>Xotira (RAM) sarfi:</b>\n`;
  text += `├ 📊 <b>Node.js Heap (ishlatilmoqda):</b> <code>${server.memory.heapUsedMB} MB</code>\n`;
  text += `├ 📈 <b>Node.js Heap (jami ajratilgan):</b> <code>${server.memory.heapTotalMB} MB</code>\n`;
  text += `├ 🧠 <b>Node.js RSS:</b> <code>${server.memory.rssMB} MB</code>\n`;
  text += `└ 🖥 <b>Tizim RAM:</b> Jami <code>${server.memory.totalSystemMemGB} GB</code> (Bo'sh: <code>${server.memory.freeSystemMemGB} GB</code>)\n\n`;

  text += `🕒 <i>Server mahalliy vaqti: ${server.timestamp}</i>`;
  return text;
}

// Broadcast holatini saqlash (admin ID -> true agar kutayotgan bo'lsa)
const broadcastPendingAdmins = new Set();

// Admin komandalari va callbacklarini ro'yxatga olish
export function handleRegisterAdmin(bot, defaultAdminId) {
  const checkAdmin = (ctx) => {
    const userId = ctx.from?.id;
    return isUserAdmin(userId, defaultAdminId);
  };

  // /admin komandasi
  bot.command("admin", async (ctx) => {
    if (!checkAdmin(ctx)) {
      return ctx.reply("❌ Sizda admin paneliga kirish huquqi mavjud emas.");
    }

    try {
      const text = await renderOverviewMessage();
      await ctx.reply(text, {
        parse_mode: "HTML",
        ...getAdminKeyboard("overview"),
      });
    } catch (error) {
      console.error("Admin dashboard xatosi:", error);
      await ctx.reply(
        "❌ Ma'lumotlarni yuklashda xatolik yuz berdi: " + error.message,
      );
    }
  });

  // /stats komandasi (Tezkor statistika)
  bot.command("stats", async (ctx) => {
    if (!checkAdmin(ctx)) return;
    try {
      const text = await renderOverviewMessage();
      await ctx.reply(text, {
        parse_mode: "HTML",
        ...getAdminKeyboard("overview"),
      });
    } catch (err) {
      ctx.reply("Xatolik: " + err.message);
    }
  });

  // /online komandasi
  bot.command("online", async (ctx) => {
    if (!checkAdmin(ctx)) return;
    try {
      const text = await renderTrafficMessage();
      await ctx.reply(text, {
        parse_mode: "HTML",
        ...getAdminKeyboard("traffic"),
      });
    } catch (err) {
      ctx.reply("Xatolik: " + err.message);
    }
  });

  // /users komandasi
  bot.command("users", async (ctx) => {
    if (!checkAdmin(ctx)) return;
    try {
      const text = await renderUsersMessage();
      await ctx.reply(text, {
        parse_mode: "HTML",
        ...getAdminKeyboard("users"),
      });
    } catch (err) {
      ctx.reply("Xatolik: " + err.message);
    }
  });

  // /quizzes komandasi
  bot.command("quizzes", async (ctx) => {
    if (!checkAdmin(ctx)) return;
    try {
      const text = await renderQuizzesMessage();
      await ctx.reply(text, {
        parse_mode: "HTML",
        ...getAdminKeyboard("quizzes"),
      });
    } catch (err) {
      ctx.reply("Xatolik: " + err.message);
    }
  });

  // /broadcast komandasi
  bot.command("broadcast", async (ctx) => {
    if (!checkAdmin(ctx)) return;

    const messageText = ctx.message.text.replace("/broadcast", "").trim();
    if (!messageText) {
      broadcastPendingAdmins.add(String(ctx.from.id));
      await ctx.reply(
        "📢 <b>Barcha foydalanuvchilarga xabar yuborish:</b>\n\n" +
          "Yubormoqchi bo'lgan xabaringiz matnini yozib yuboring (yoki bekor qilish uchun /cancel buyrug'ini bering):",
        { parse_mode: "HTML" },
      );
      return;
    }

    await executeBroadcast(ctx, bot, messageText);
  });

  // /cancel komandasi
  bot.command("cancel", async (ctx) => {
    if (!checkAdmin(ctx)) return;
    if (broadcastPendingAdmins.has(String(ctx.from.id))) {
      broadcastPendingAdmins.delete(String(ctx.from.id));
      await ctx.reply("Bekor qilindi. ❌");
    }
  });

  // Inline callback querylarni boshqarish
  bot.on("callback_query", async (ctx, next) => {
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith("admin:")) {
      return next();
    }

    if (!checkAdmin(ctx)) {
      return ctx.answerCbQuery(
        "❌ Sizda ushbu amalni bajarish uchun ruxsat yo'q!",
        {
          show_alert: true,
        },
      );
    }

    try {
      if (data === "admin:overview" || data === "admin:refresh:overview") {
        const text = await renderOverviewMessage();
        await safeEditMessage(ctx, text, getAdminKeyboard("overview"));
        await ctx.answerCbQuery("⚡ Bosh panel yangilandi!");
      } else if (data === "admin:users" || data === "admin:refresh:users") {
        const text = await renderUsersMessage();
        await safeEditMessage(ctx, text, getAdminKeyboard("users"));
        await ctx.answerCbQuery("⚡ Foydalanuvchilar ma'lumotlari yangilandi!");
      } else if (data === "admin:quizzes" || data === "admin:refresh:quizzes") {
        const text = await renderQuizzesMessage();
        await safeEditMessage(ctx, text, getAdminKeyboard("quizzes"));
        await ctx.answerCbQuery("⚡ Quizlar ma'lumotlari yangilandi!");
      } else if (data === "admin:otp" || data === "admin:refresh:otp") {
        const text = await renderOtpMessage();
        await safeEditMessage(ctx, text, getAdminKeyboard("otp"));
        await ctx.answerCbQuery("⚡ OTP ma'lumotlari yangilandi!");
      } else if (data === "admin:traffic" || data === "admin:refresh:traffic") {
        const text = await renderTrafficMessage();
        await safeEditMessage(ctx, text, getAdminKeyboard("traffic"));
        await ctx.answerCbQuery("⚡ Onlayn va tashriflar yangilandi!");
      } else if (data === "admin:server" || data === "admin:refresh:server") {
        const text = await renderServerMessage();
        await safeEditMessage(ctx, text, getAdminKeyboard("server"));
        await ctx.answerCbQuery("⚡ Server ko'rsatkichlari yangilandi!");
      } else if (data === "admin:broadcast_prompt") {
        broadcastPendingAdmins.add(String(ctx.from.id));
        await ctx.answerCbQuery();
        await ctx.reply(
          "📢 <b>Barcha foydalanuvchilarga xabar yuborish:</b>\n\n" +
            "Yubormoqchi bo'lgan xabaringizni yozib yuboring (Bekor qilish uchun: /cancel):",
          { parse_mode: "HTML" },
        );
      } else {
        await ctx.answerCbQuery();
      }
    } catch (error) {
      console.error("Admin callback xatosi:", error);
      await ctx.answerCbQuery("Xatolik: " + error.message, {
        show_alert: true,
      });
    }
  });

  // Admin xabar yozganda (agar broadcast kutilayotgan bo'lsa)
  bot.use(async (ctx, next) => {
    const userId = String(ctx.from?.id);
    if (
      broadcastPendingAdmins.has(userId) &&
      ctx.message?.text &&
      !ctx.message.text.startsWith("/")
    ) {
      broadcastPendingAdmins.delete(userId);
      await executeBroadcast(ctx, bot, ctx.message.text);
      return;
    }
    return next();
  });
}

// Xabarni xavfsiz tahrirlash (Message is not modified xatosini oldini oladi)
async function safeEditMessage(ctx, newText, keyboard) {
  try {
    await ctx.editMessageText(newText, {
      parse_mode: "HTML",
      ...keyboard,
    });
  } catch (error) {
    if (
      error.description &&
      error.description.includes("message is not modified")
    ) {
      // O'zgarmagan bo'lsa hech narsa qilmaymiz
      return;
    }
    console.error("safeEditMessage xatosi:", error);
  }
}

// Broadcast yuborish yordamchi funksiyasi
async function executeBroadcast(ctx, bot, messageText) {
  const statusMsg = await ctx.reply("⏳ Xabar yuborilmoqda, kuting...");
  try {
    // Bazadagi barcha telegramId ga ega foydalanuvchilarni olish
    const users = isDbConnected()
      ? await User.find({
          telegramId: { $exists: true, $ne: "" },
        }).select("telegramId")
      : listMemoryUsers().filter((u) => u.telegramId);
    let sentCount = 0;
    let failedCount = 0;

    for (const u of users) {
      try {
        await bot.telegram.sendMessage(u.telegramId, messageText, {
          parse_mode: "HTML",
        });
        sentCount++;
      } catch (e) {
        failedCount++;
      }
      // Telegram rate limitini chetlab o'tish uchun kichik pauza
      await new Promise((r) => setTimeout(r, 40));
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✅ <b>Xabar muvaffaqiyatli tarqatildi!</b>\n\n` +
        `📨 Yetkazildi: <code>${sentCount}</code> ta foydalanuvchiga\n` +
        `❌ Yetib bormadi (bloklaganlar): <code>${failedCount}</code> ta`,
      { parse_mode: "HTML" },
    );
  } catch (error) {
    console.error("Broadcast xatosi:", error);
    await ctx.reply("❌ Xabar tarqatishda xatolik: " + error.message);
  }
}

export default handleRegisterAdmin;
