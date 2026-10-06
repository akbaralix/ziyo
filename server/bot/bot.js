import "dotenv/config";
import { Bot } from "node-telegram-bot-api";
import { run } from "node-telegram-bot-api/node";
import OTP from "../db/OTP/otp.js";
import User from "../db/User/User.js";

let bot = null;

export default function startBot() {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    console.error("❌ BOT_TOKEN belgilanmagan (.env faylini tekshiring).");
    return null;
  }

  if (bot) {
    return bot;
  }

  try {
    bot = new Bot(token);

    bot.command("start", async (ctx) => {
      const telegramId = String(ctx.from?.id || ctx.message?.from?.id);
      const firstName =
        ctx.from?.first_name || ctx.message?.from?.first_name || "";
      const lastName =
        ctx.from?.last_name || ctx.message?.from?.last_name || "";
      const username =
        ctx.from?.username || ctx.message?.from?.username || "";

      // Token parametrini olish
      let tokenParam =
        typeof ctx.match === "string" ? ctx.match.trim() : null;
      if (!tokenParam && ctx.message?.text) {
        const parts = ctx.message.text.split(" ");
        if (parts.length > 1) {
          tokenParam = parts.slice(1).join(" ").trim();
        }
      }

      try {
        if (!tokenParam) {
          const existingUser = await User.findOne({ telegramId });
          if (existingUser) {
            await ctx.reply(
              `Assalomu alaykum, <b>${existingUser.firstName} ${existingUser.lastName}</b>! 👋\n\n` +
                `Siz Ziyo platformasidan ro‘yxatdan o‘tgansiz. Tizimga kirish uchun sayt orqali "Telegram orqali kirish" tugmasini bosing.`,
              { parse_mode: "HTML" }
            );
          } else {
            await ctx.reply(
              `Assalomu alaykum, <b>${firstName}</b>! 👋\n\n` +
                `Ziyo platformasining rasmiy botiga xush kelibsiz. Sayt orqali kirish uchun platformadagi "Telegram orqali kirish" tugmasini bosing.`,
              { parse_mode: "HTML" }
            );
          }
          return;
        }

        // Token orqali login sessiyasini topamiz
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

        // Sessiyani tasdiqlaymiz
        session.telegramId = telegramId;
        session.telegramUsername = username;
        session.telegramFirstName = firstName;
        session.telegramLastName = lastName;
        session.verified = true;
        session.verifiedAt = new Date();
        await session.save();

        const existingUser = await User.findOne({ telegramId });

        let replyText = `✅ <b>Telegram hisobingiz muvaffaqiyatli tasdiqlandi!</b>\n\n`;
        replyText += `Salom, <b>${firstName}</b> 👋\n\n`;

        if (existingUser) {
          replyText += `🎉 Siz muvaffaqiyatli tizimga kirdingiz! Brauzeringizga qaytib ishlashni davom ettirishingiz mumkin.`;
        } else {
          replyText += `🎓 Ziyo platformasiga xush kelibsiz!\nSaytga qayting va ism-familiya hamda ta'lim ma'lumotlaringizni to‘ldirib ro‘yxatdan o‘tishni yakunlang.`;
        }

        await ctx.reply(replyText, { parse_mode: "HTML" });
        console.log(
          `✅ Telegram bot orqali tasdiqlandi: ${telegramId} (${firstName})`
        );
      } catch (err) {
        console.error("Bot start xatosi:", err);
        await ctx.reply(
          "❌ Xatolik yuz berdi. Iltimos, sayt orqali qaytadan urinib ko‘ring."
        );
      }
    });

    run(bot).catch((err) => {
      console.error("Telegram bot run xatosi:", err.message || err);
    });

    console.log("🤖 Telegram bot muvaffaqiyatli ishga tushirildi...");
    return bot;
  } catch (error) {
    console.error("Telegram botni ishga tushirishda xatolik:", error);
    return null;
  }
}
