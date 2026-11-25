import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import OTP from "../db/OTP/otp.js";
import User from "../db/User/User.js";
import {
  handleRegisterAdmin,
  isUserAdmin,
  renderOverviewMessage,
  getAdminKeyboard,
} from "./admin.js";
import { setSocketIO } from "../services/analyticsService.js";

let bot = null;
export const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || 907402803;

export function getBot() {
  return bot;
}

function escapeHtml(text = "") {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function startBot(io = null) {
  if (io) {
    setSocketIO(io);
  }

  const token = process.env.BOT_TOKEN;

  if (!token) {
    console.error("❌ BOT_TOKEN belgilanmagan (.env faylini tekshiring).");
    return null;
  }

  if (bot) {
    return bot;
  }

  try {
    bot = new Telegraf(token);

    // Admin boshqaruv panelini ulash
    handleRegisterAdmin(bot, ADMIN_CHAT_ID);

    // /start komandasi
    bot.command("start", async (ctx) => {
      const telegramId = String(ctx.from?.id || ctx.message?.from?.id);
      const firstName =
        ctx.from?.first_name || ctx.message?.from?.first_name || "";
      const lastName =
        ctx.from?.last_name || ctx.message?.from?.last_name || "";
      const username = ctx.from?.username || ctx.message?.from?.username || "";

      let tokenParam = typeof ctx.match === "string" ? ctx.match.trim() : null;
      if (!tokenParam && ctx.message?.text) {
        const parts = ctx.message.text.split(" ");
        if (parts.length > 1) {
          tokenParam = parts.slice(1).join(" ").trim();
        }
      }

      try {
        // Tokensiz /start bosilgan holat
        if (!tokenParam) {
          // Agar foydalanuvchi Admin bo'lsa, to'g'ridan-to'g'ri Admin Panelni ko'rsatish
          if (isUserAdmin(telegramId, ADMIN_CHAT_ID)) {
            const overviewText = await renderOverviewMessage();
            await ctx.reply(
              `👑 <b>Assalomu alaykum, Hurmatli Admin!</b> 👋\n\n` +
                `Hatif platformasi boshqaruv tizimiga xush kelibsiz. Saytning barcha statistikasi real vaqtda quyida keltirilgan:\n\n` +
                overviewText,
              {
                parse_mode: "HTML",
                ...getAdminKeyboard("overview"),
              }
            );
            return;
          }

          const existingUser = await User.findOne({ telegramId });
          if (existingUser) {
            await ctx.reply(
              `Assalomu alaykum, <b>${escapeHtml(existingUser.firstName)} ${escapeHtml(existingUser.lastName)}</b>! 👋\n\n` +
                `Siz Hatif platformasidan ro‘yxatdan o‘tgansiz. Tizimga kirish uchun quyidagi tugmani bosing.`,
              {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                  [
                    Markup.button.webApp(
                      "🚀 Hatif platformasiga kirish",
                      "https://eduziyo.web.app"
                    ),
                  ],
                ]),
              }
            );
          } else {
            await ctx.reply(
              `Assalomu alaykum, <b>${escapeHtml(firstName)}</b>! 👋\n\n` +
                `Hatif platformasining rasmiy botiga xush kelibsiz. Sayt orqali kirish uchun platformadagi "Telegram orqali kirish" tugmasini bosing.`,
              { parse_mode: "HTML" }
            );
          }
          return;
        }

        // Token mavjud bo'lgan holat (Saytdan kirish OTP)
        const session = await OTP.findOne({
          $or: [{ token: tokenParam }, { tokenHash: tokenParam }],
        });

        if (!session) {
          await ctx.reply(
            "❌ <b>Xatolik:</b> Login havolasi noto‘g‘ri yoki allaqachon eskirgan. Iltimos, saytdan qaytadan login qiling.",
            { parse_mode: "HTML" }
          );
          return;
        }

        if (session.expiresAt < new Date()) {
          await ctx.reply(
            "⏰ <b>Muddati tugagan:</b> Ushbu login havolasining muddati tugagan. Saytdan yangi login havolasini oling.",
            { parse_mode: "HTML" }
          );
          return;
        }

        session.telegramId = telegramId;
        session.telegramUsername = username;
        session.telegramFirstName = firstName;
        session.telegramLastName = lastName;
        session.verified = true;
        session.verifiedAt = new Date();
        await session.save();

        const existingUser = await User.findOne({ telegramId });

        let replyText = `✅ <b>Telegram hisobingiz muvaffaqiyatli tasdiqlandi!</b>\n\n`;
        replyText += `Salom, <b>${escapeHtml(firstName)}</b> 👋\n\n`;

        if (existingUser) {
          replyText += `🎉 Siz muvaffaqiyatli tizimga kirdingiz! Brauzeringizga qaytib ishlashni davom ettirishingiz mumkin.`;
        } else {
          replyText += `🎓 Hatif platformasiga xush kelibsiz!\nSaytga qayting va ism-familiya hamda ta'lim ma'lumotlaringizni to‘ldirib ro‘yxatdan o‘tishni yakunlang.`;
        }

        await ctx.reply(replyText, { parse_mode: "HTML" });

        // Adminga xabar yuborish
        try {
          await bot.telegram.sendMessage(
            ADMIN_CHAT_ID,
            `✅ Telegram bot orqali tasdiqlandi: <a href="tg://user?id=${telegramId}">${escapeHtml(firstName)}</a> (@${username || "—"})`,
            { parse_mode: "HTML" }
          );
        } catch (adminErr) {
          // Admin chat mavjud bo'lmasa xatolik chiqmasligi uchun
        }
      } catch (err) {
        console.error("Bot start xatosi:", err);
        await ctx.reply(
          "❌ Xatolik yuz berdi. Iltimos, sayt orqali qaytadan urinib ko‘ring."
        );
      }
    });

    // Bot menyu komandalarini o'rnatish
    bot.telegram
      .setMyCommands([
        { command: "admin", description: "👑 Admin boshqaruv paneli" },
        { command: "stats", description: "📊 To'liq statistika" },
        { command: "online", description: "🟢 Onlayn va tashriflar" },
        { command: "users", description: "👥 Foydalanuvchilar" },
        { command: "quizzes", description: "🎯 Viktorinalar" },
        { command: "broadcast", description: "📢 Foydalanuvchilarga xabar" },
        { command: "start", description: "🚀 Botni ishga tushirish" },
      ])
      .catch(() => {});

    bot.launch().catch((err) => {
      console.warn(
        "⚠️ Telegram bot polling xatosi (ehtimol boshqa joyda ishlab turibdi):",
        err.message
      );
    });

    console.log("🤖 Telegram bot muvaffaqiyatli ishga tushirildi...");
    return bot;
  } catch (error) {
    console.error("Telegram botni ishga tushirishda xatolik:", error);
    return null;
  }
}
