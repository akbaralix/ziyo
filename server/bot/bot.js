import "dotenv/config";
import { Telegraf } from "telegraf";
import OTP from "../db/OTP/otp.js";
import User from "../db/User/User.js";
import Post from "../db/Post/Post.js";
import Comment from "../db/Post/Comment.js";

let bot = null;
export const ADMIN_CHAT_ID = 907402803;

export function getBot() {
  return bot;
}

export async function sendPostReportToAdmin({ post, reporter, reason = "" }) {
  if (!bot) {
    console.warn("⚠️ Telegram bot ishga tushmagan, shikoyat yuborilmadi.");
    return false;
  }

  const postAuthor = post?.user?.name || "Noma'lum muallif";
  const authorUsername = post?.user?.username
    ? `@${post.user.username}`
    : "username yo'q";
  const reporterName = reporter?.name || "Anonim foydalanuvchi";
  const reporterUsername = reporter?.username
    ? `@${reporter.username}`
    : "username yo'q";
  const reporterId = reporter?.id || "Noma'lum";

  const messageText =
    `🚨 <b>YANGI SHIKOYAT (POST REPORT)!</b>\n\n` +
    `📌 <b>Post sarlavhasi:</b> ${escapeHtml(post.title || "(Sarlavhasiz)")}\n` +
    `📝 <b>Post matni:</b> ${escapeHtml((post.content || "").slice(0, 300))}${(post.content || "").length > 300 ? "..." : ""}\n` +
    `🏷 <b>Kategoriya:</b> ${escapeHtml(post.category || "Umumiy")}\n` +
    `👤 <b>Post muallifi:</b> ${escapeHtml(postAuthor)} (${authorUsername})\n` +
    `🆔 <b>Post ID:</b> <code>${post._id || post.id}</code>\n\n` +
    `⚠️ <b>Shikoyat sababi:</b> ${escapeHtml(reason || "Platforma qoidalariga zid kontent")}\n` +
    `🙋‍♂️ <b>Shikoyat yuboruvchi:</b> ${escapeHtml(reporterName)} (${reporterUsername}) [ID: <code>${reporterId}</code>]\n` +
    `🕒 <b>Vaqti:</b> ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}`;

  try {
    await bot.telegram.sendMessage(ADMIN_CHAT_ID, messageText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🗑 Postni o'chirish (Qizil)",
              callback_data: `del_post:${post._id || post.id}`,
            },
            {
              text: "❌ Bekor qilish",
              callback_data: `cancel_rep:${post._id || post.id}`,
            },
          ],
        ],
      },
    });
    return true;
  } catch (err) {
    console.error("Shikoyatni adminga yuborishda xatolik:", err);
    return false;
  }
}

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
    bot = new Telegraf(token);

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
        if (!tokenParam) {
          const existingUser = await User.findOne({ telegramId });
          if (existingUser) {
            await ctx.reply(
              `Assalomu alaykum, <b>${existingUser.firstName} ${existingUser.lastName}</b>! 👋\n\n` +
                `Siz Ziyo platformasidan ro‘yxatdan o‘tgansiz. Tizimga kirish uchun sayt orqali "Telegram orqali kirish" tugmasini bosing.`,
              { parse_mode: "HTML" },
            );
          } else {
            await ctx.reply(
              `Assalomu alaykum, <b>${firstName}</b>! 👋\n\n` +
                `Ziyo platformasining rasmiy botiga xush kelibsiz. Sayt orqali kirish uchun platformadagi "Telegram orqali kirish" tugmasini bosing.`,
              { parse_mode: "HTML" },
            );
          }
          return;
        }

        const session = await OTP.findOne({
          $or: [{ token: tokenParam }, { tokenHash: tokenParam }],
        });

        if (!session) {
          await ctx.reply(
            "❌ <b>Xatolik:</b> Login havolasi noto‘g‘ri yoki allaqachon eskirgan. Iltimos, saytdan qaytadan login qiling.",
            { parse_mode: "HTML" },
          );
          return;
        }

        if (session.expiresAt < new Date()) {
          await ctx.reply(
            "⏰ <b>Muddati tugagan:</b> Ushbu login havolasining muddati tugagan. Saytdan yangi login havolasini oling.",
            { parse_mode: "HTML" },
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
        replyText += `Salom, <b>${firstName}</b> 👋\n\n`;

        if (existingUser) {
          replyText += `🎉 Siz muvaffaqiyatli tizimga kirdingiz! Brauzeringizga qaytib ishlashni davom ettirishingiz mumkin.`;
        } else {
          replyText += `🎓 Ziyo platformasiga xush kelibsiz!\nSaytga qayting va ism-familiya hamda ta'lim ma'lumotlaringizni to‘ldirib ro‘yxatdan o‘tishni yakunlang.`;
        }

        await ctx.reply(replyText, { parse_mode: "HTML" });

        await bot.telegram.sendMessage(
          ADMIN_CHAT_ID,
          `✅ Telegram bot orqali tasdiqlandi: <a href="tg://user?id=${telegramId}">${firstName}</a>`,
          { parse_mode: "HTML" },
        );
      } catch (err) {
        console.error("Bot start xatosi:", err);
        await ctx.reply(
          "❌ Xatolik yuz berdi. Iltimos, sayt orqali qaytadan urinib ko‘ring.",
        );
      }
    });

    // Admin inline button: Postni o'chirish
    bot.action(/^del_post:(.+)$/, async (ctx) => {
      const postId = ctx.match[1];
      try {
        const post = await Post.findById(postId);
        if (!post) {
          await ctx.answerCbQuery(
            "Ushbu post allaqachon o'chirilgan yoki topilmadi.",
          );
          await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
          return;
        }

        await Comment.deleteMany({ post: post._id });
        await Post.findByIdAndDelete(postId);

        await ctx.answerCbQuery("🗑 Post muvaffaqiyatli o'chirildi!");
        const originalText = ctx.callbackQuery.message?.text || "";
        await ctx.editMessageText(
          `${originalText}\n\n🛑 <b>[POST ADMIN TOMONIDAN O'CHIRILDI]</b>`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } },
        );
      } catch (error) {
        console.error("Postni bot orqali o'chirishda xatolik:", error);
        await ctx.answerCbQuery("O'chirishda xatolik yuz berdi.");
      }
    });

    // Admin inline button: Shikoyatni bekor qilish
    bot.action(/^cancel_rep:(.+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery("Shikoyat bekor qilindi (rad etildi).");
        const originalText = ctx.callbackQuery.message?.text || "";
        await ctx.editMessageText(
          `${originalText}\n\n✅ <b>[SHIKOYAT BEKOR QILINDI / RAD ETILDI]</b>`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } },
        );
      } catch (error) {
        console.error("Shikoyatni bekor qilishda xatolik:", error);
        await ctx.answerCbQuery("Xatolik yuz berdi.");
      }
    });

    bot.launch();

    console.log("🤖 Telegram bot muvaffaqiyatli ishga tushirildi...");
    return bot;
  } catch (error) {
    console.error("Telegram botni ishga tushirishda xatolik:", error);
    return null;
  }
}
