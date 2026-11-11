// Jumanji Real-time Game Socket Handler
// Board has 40 tiles (0 to 39, with 39 being the goal / JUMANJI!)
// Special tiles with events:
// - BOMBA: portlaydi va 3-5 qadam orqaga tushadi
// - ORQAGA: 2-4 qadam orqaga chekinadi
// - OLGA (Moshina / Gepard): 2-4 qadam oldinga sakraydi
// - TIMSOH / ILON / CHANGALZOR (Tuzoq): keyingi navbatni o'tkazib yuboradi (skip turn)
// - SAVOL / SIRLI QUTI: bonus XP yoki +2 qadam
// - JUMANJI (39-katak): MARRA!

const TILES_CONFIG = [
  { id: 0, type: "start", label: "START", desc: "Boshlang'ich nuqta 🏕️" },
  { id: 1, type: "normal", label: "1", desc: "Sokin so'qmoq" },
  { id: 2, type: "forward", label: "+2", steps: 2, desc: "Gepard izidan! +2 qadam oldinga 🐆" },
  { id: 3, type: "normal", label: "3", desc: "Bambukzor" },
  { id: 4, type: "trap", label: "🕸️", desc: "Bahaybat o'rgimchak to'ri! 1 navbat o'tkazib yuboriladi 🕷️" },
  { id: 5, type: "bomb", label: "💣", steps: -3, desc: "Portlovchi vulqon toshi! -3 qadam orqaga 💥" },
  { id: 6, type: "normal", label: "6", desc: "Lianalar orasida" },
  { id: 7, type: "backward", label: "-2", steps: -2, desc: "Zaharli o'tlar! -2 qadam orqaga 🍃" },
  { id: 8, type: "mystery", label: "❓", desc: "Sirli Jumanji sandig'i: omad sinovi! 🎁" },
  { id: 9, type: "normal", label: "9", desc: "Qadimgi toshlar" },
  { id: 10, type: "trap", label: "🐊", desc: "Timsohlar daryosi! 1 navbat dam olasiz 🐊" },
  { id: 11, type: "forward", label: "+3", steps: 3, desc: "Karkidonlar podasi surib ketdi! +3 qadam oldinga 🦏" },
  { id: 12, type: "normal", label: "12", desc: "Kaltakesaklar g'ori" },
  { id: 13, type: "bomb", label: "💣", steps: -4, desc: "Qadimgi mina portladi! -4 qadam orqaga 💥" },
  { id: 14, type: "normal", label: "14", desc: "Sokin sharshara" },
  { id: 15, type: "backward", label: "-3", steps: -3, desc: "Maymunlar bosqini! -3 qadam quvib yuborishdi 🐒" },
  { id: 16, type: "mystery", label: "❓", desc: "Sehrli quti: sehrli quvvat beradi! 💎" },
  { id: 17, type: "normal", label: "17", desc: "Zulmat o'rmoni" },
  { id: 18, type: "trap", label: "🐍", desc: "Bahaybat Anakonda! 1 navbat harakatsiz qolasiz 🐍" },
  { id: 19, type: "forward", label: "+2", steps: 2, desc: "Burgut qanotida! +2 qadam oldinga 🦅" },
  { id: 20, type: "danger", label: "⚠️", steps: -5, desc: "OVCHI VAN PELT! Uning o'qidan qoching! -5 qadam 🎯" },
  { id: 21, type: "normal", label: "21", desc: "Chigal ildizlar" },
  { id: 22, type: "bomb", label: "💣", steps: -4, desc: "BOMBA! Kuchli portlash: -4 qadam orqaga 💥" },
  { id: 23, type: "normal", label: "23", desc: "Qorong'u tunnel" },
  { id: 24, type: "trap", label: "🌪️", desc: "Tropik quyun! 1 navbat to'xtab turasiz 🌪️" },
  { id: 25, type: "backward", label: "-2", steps: -2, desc: "Ko'chki sodir bo'ldi! -2 qadam orqaga ⛰️" },
  { id: 26, type: "forward", label: "+4", steps: 4, desc: "Yashirin portal topildi! +4 qadam oldinga ⚡" },
  { id: 27, type: "normal", label: "27", desc: "Qadimgi ibodatxona zinalari" },
  { id: 28, type: "mystery", label: "❓", desc: "Qadimgi tumor: kutilmagan hodisa! ✨" },
  { id: 29, type: "trap", label: "🕳️", desc: "Botqoqlik! Cho'kib ketmaslik uchun 1 navbat kuting 🐸" },
  { id: 30, type: "bomb", label: "💣", steps: -5, desc: "KATTA BOMBA! -5 qadam orqaga uloqtirildi 💥" },
  { id: 31, type: "normal", label: "31", desc: "Sherlar maskani" },
  { id: 32, type: "backward", label: "-3", steps: -3, desc: "Qoplon hujumi! -3 qadam orqaga 🐆" },
  { id: 33, type: "forward", label: "+2", steps: 2, desc: "Ibodatxona sirlari! +2 qadam olg'a 🗝️" },
  { id: 34, type: "trap", label: "⏳", desc: "Vaqt tuzog'i! 1 navbat dam oling ⏳" },
  { id: 35, type: "bomb", label: "💣", steps: -4, desc: "Qo'riqchilar qopqoni! -4 qadam orqaga 💥" },
  { id: 36, type: "mystery", label: "❓", desc: "Jumanji bag'riga bir qadam! 🔮" },
  { id: 37, type: "backward", label: "-2", steps: -2, desc: "Marra oldidagi to'siq! -2 qadam orqaga 🛡️" },
  { id: 38, type: "forward", label: "+1", steps: 1, desc: "Oxirgi kuch! +1 qadam olg'a 🏃" },
  { id: 39, type: "finish", label: "JUMANJI", desc: "🏆 JUMANJI! Zafarga erishildi! Marra!" },
];

const PLAYER_COLORS = [
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber/Gold
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
];

const rooms = new Map(); // roomId -> roomState

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function initJumanjiSocket(io) {
  const jumanjiIo = io.of("/jumanji");

  jumanjiIo.on("connection", (socket) => {
    // 1. Yangi o'yin xonasi yaratish (Host)
    socket.on("create_room", ({ hostName, hostId, title }) => {
      const roomId = generateRoomId();
      const hostColor = PLAYER_COLORS[0];

      const room = {
        id: roomId,
        title: title || "Jumanji Sarguzashti",
        hostSocketId: socket.id,
        hostId: hostId || null,
        status: "LOBBY", // LOBBY, PLAYING, FINISHED
        turnIndex: 0,
        diceValue: null,
        lastEvent: null,
        winner: null,
        createdAt: Date.now(),
        players: [
          {
            id: socket.id,
            userId: hostId || null,
            name: hostName || "Yaratuvchi",
            color: hostColor,
            position: 0,
            skipTurn: false,
            isHost: true,
          },
        ],
        logs: [`🎮 O'yin yaratildi! Xona kodi: ${roomId}`],
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.roomId = roomId;

      socket.emit("room_created", {
        roomId,
        room,
        tiles: TILES_CONFIG,
      });
    });

    // 2. O'yinga qo'shilish
    socket.on("join_room", ({ roomId, playerName, userId }) => {
      const upperId = (roomId || "").trim().toUpperCase();
      const room = rooms.get(upperId);

      if (!room) {
        return socket.emit("error_msg", { message: "Bunday o'yin xonasi topilmadi!" });
      }

      if (room.status === "FINISHED") {
        return socket.emit("error_msg", { message: "Bu o'yin allaqachon tugagan!" });
      }

      // Agar o'yinchi avval qo'shilgan bo'lsa (qayta ulanish yoki host ulanishi)
      const existing = room.players.find(
        (p) =>
          p.id === socket.id ||
          (userId && p.userId === userId) ||
          (playerName && p.name.trim().toLowerCase() === playerName.trim().toLowerCase())
      );

      if (existing) {
        existing.id = socket.id; // yangilash
        if (playerName) existing.name = playerName;
        if (existing.isHost) {
          room.hostSocketId = socket.id;
        }
        socket.join(upperId);
        socket.roomId = upperId;

        socket.emit("room_joined", {
          roomId: upperId,
          room,
          tiles: TILES_CONFIG,
          playerId: socket.id,
        });

        return jumanjiIo.to(upperId).emit("room_updated", { room });
      }

      if (room.status === "PLAYING") {
        return socket.emit("error_msg", { message: "O'yin allaqachon boshlangan!" });
      }

      if (room.players.length >= 8) {
        return socket.emit("error_msg", { message: "O'yinda maksimal 8 ta o'yinchi bo'lishi mumkin!" });
      }

      const assignedColor = PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];
      const newPlayer = {
        id: socket.id,
        userId: userId || null,
        name: (playerName || `O'yinchi ${room.players.length + 1}`).trim(),
        color: assignedColor,
        position: 0,
        skipTurn: false,
        isHost: false,
      };

      room.players.push(newPlayer);
      room.logs.push(`👋 ${newPlayer.name} o'yinga qo'shildi!`);
      socket.join(upperId);
      socket.roomId = upperId;

      socket.emit("room_joined", {
        roomId: upperId,
        room,
        tiles: TILES_CONFIG,
        playerId: socket.id,
      });

      jumanjiIo.to(upperId).emit("room_updated", { room });
    });

    // 3. O'yinni boshlash (faqat Host)
    socket.on("start_game", () => {
      const roomId = socket.roomId;
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.hostSocketId !== socket.id) {
        return socket.emit("error_msg", { message: "Faqat o'yin egasi boshlashi mumkin!" });
      }

      if (room.players.length < 1) {
        return socket.emit("error_msg", { message: "Kamida 1 nafar o'yinchi kerak!" });
      }

      room.status = "PLAYING";
      room.turnIndex = 0;
      room.logs.push("🎲 Jumanji boshlandi! Birinchi yurish: " + room.players[0].name);

      jumanjiIo.to(roomId).emit("game_started", { room });
      jumanjiIo.to(roomId).emit("room_updated", { room });
    });

    // 4. Zarni tashlash (Roll Dice)
    socket.on("roll_dice", () => {
      const roomId = socket.roomId;
      const room = rooms.get(roomId);
      if (!room || room.status !== "PLAYING") return;

      const currentPlayer = room.players[room.turnIndex];
      if (!currentPlayer || currentPlayer.id !== socket.id) {
        return socket.emit("error_msg", { message: "Hozir sizning navbatingiz emas!" });
      }

      // Tasodifiy zar: 1 dan 6 gacha
      const dice = Math.floor(Math.random() * 6) + 1;
      room.diceValue = dice;

      let oldPos = currentPlayer.position;
      let landedPos = oldPos + dice;

      // 39 dan oshmasligi uchun
      if (landedPos >= TILES_CONFIG.length - 1) {
        landedPos = TILES_CONFIG.length - 1;
      }

      const tile = TILES_CONFIG[landedPos];
      let finalPos = landedPos;
      let eventMsg = `🎲 ${currentPlayer.name} zar tashladi: [${dice}] va ${landedPos}-katakka tushdi.`;
      let extraAction = null;

      // Katak voqeasini shu zahotiyoq hisoblash (bomba, orqaga, olg'a, tuzoq)
      if (tile.type === "bomb") {
        const back = Math.abs(tile.steps || 3);
        finalPos = Math.max(0, landedPos - back);
        eventMsg += ` 💥 BOMBA! Portlash sodir bo'ldi va ${back} qadam orqaga (${finalPos}-katakka) chekindi!`;
        extraAction = { type: "bomb", back, targetPos: finalPos };
      } else if (tile.type === "backward") {
        const back = Math.abs(tile.steps || 2);
        finalPos = Math.max(0, landedPos - back);
        eventMsg += ` 🍂 ${tile.desc}. -${back} qadam orqaga surildi (${finalPos}-katak).`;
        extraAction = { type: "backward", back, targetPos: finalPos };
      } else if (tile.type === "forward") {
        const fwd = tile.steps || 2;
        finalPos = Math.min(TILES_CONFIG.length - 1, landedPos + fwd);
        eventMsg += ` ⚡ ${tile.desc}. +${fwd} qadam oldinga sakradi (${finalPos}-katak)!`;
        extraAction = { type: "forward", fwd, targetPos: finalPos };
      } else if (tile.type === "trap") {
        currentPlayer.skipTurn = true;
        eventMsg += ` 🕸️ ${tile.desc}`;
        extraAction = { type: "trap" };
      } else if (tile.type === "danger") {
        const back = Math.abs(tile.steps || 5);
        finalPos = Math.max(0, landedPos - back);
        eventMsg += ` 🎯 ${tile.desc} -${back} qadam orqaga (${finalPos}-katak)!`;
        extraAction = { type: "danger", back, targetPos: finalPos };
      } else if (tile.type === "mystery") {
        const rand = Math.random();
        if (rand < 0.33) {
          finalPos = Math.min(TILES_CONFIG.length - 1, landedPos + 3);
          eventMsg += ` 🎁 Sehrli sandiqdan qanot chiqdi! +3 qadam oldinga (${finalPos}-katak)!`;
          extraAction = { type: "forward", fwd: 3, targetPos: finalPos };
        } else if (rand < 0.66) {
          finalPos = Math.max(0, landedPos - 2);
          eventMsg += ` 🎁 Sandiqdan zaharli o'tlar chiqdi! -2 qadam orqaga (${finalPos}-katak)!`;
          extraAction = { type: "backward", back: 2, targetPos: finalPos };
        } else {
          eventMsg += ` 🎁 Sandiqdan himoya qalqoni topildi!`;
          extraAction = { type: "shield" };
        }
      }

      // O'yinchi yakuniy pozitsiyasini o'rnatish
      currentPlayer.position = finalPos;

      room.lastEvent = {
        player: currentPlayer.name,
        color: currentPlayer.color,
        dice,
        tile,
        landedPos,
        finalPos,
        extraAction,
        message: eventMsg,
      };

      room.logs.push(eventMsg);
      if (room.logs.length > 50) room.logs.shift();

      // G'oliblikni tekshirish
      if (currentPlayer.position >= TILES_CONFIG.length - 1) {
        room.status = "FINISHED";
        room.winner = currentPlayer;
        room.logs.push(`🎉 JUMANJI! ${currentPlayer.name} o'yinda g'alaba qozondi!`);
        jumanjiIo.to(roomId).emit("game_finished", { winner: currentPlayer, room });
      } else {
        // Navbatni keyingi o'yinchiga o'tkazish
        advanceTurn(room);
      }

      jumanjiIo.to(roomId).emit("dice_rolled", {
        dice,
        playerId: currentPlayer.id,
        landedPos,
        finalPos,
        lastEvent: room.lastEvent,
        room,
      });

      jumanjiIo.to(roomId).emit("room_updated", { room });
    });

    // 5. O'yinni qayta boshlash (Restart)
    socket.on("restart_game", () => {
      const roomId = socket.roomId;
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.hostSocketId !== socket.id) {
        return socket.emit("error_msg", { message: "Faqat o'yin egasi qayta boshlashi mumkin!" });
      }

      room.status = "PLAYING";
      room.winner = null;
      room.diceValue = null;
      room.lastEvent = null;
      room.turnIndex = 0;
      room.players.forEach((p) => {
        p.position = 0;
        p.skipTurn = false;
      });
      room.logs.push("🔄 O'yin qayta boshlandi!");

      jumanjiIo.to(roomId).emit("game_restarted", { room });
      jumanjiIo.to(roomId).emit("room_updated", { room });
    });

    // 6. Xabarlar (Chat / Reaktsiyalar)
    socket.on("send_reaction", ({ emoji }) => {
      const roomId = socket.roomId;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      jumanjiIo.to(roomId).emit("reaction_received", {
        playerId: socket.id,
        playerName: player.name,
        color: player.color,
        emoji,
      });
    });

    // 7. Uzilish (Disconnect)
    socket.on("disconnect", () => {
      const roomId = socket.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const departing = room.players.find((p) => p.id === socket.id);
      if (departing) {
        room.logs.push(`👋 ${departing.name} aloqasi uzildi.`);
      }

      // Xonani darhol o'chirmaymiz, sahifa refresh yoki navigate bo'lishi mumkin
      // Faqat 15 daqiqadan so'ng agar hech kim bo'lmasa o'chiriladi
      setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (currentRoom) {
          const activeClients = jumanjiIo.adapter.rooms.get(roomId);
          if (!activeClients || activeClients.size === 0) {
            rooms.delete(roomId);
          }
        }
      }, 15 * 60 * 1000);

      jumanjiIo.to(roomId).emit("room_updated", { room });
    });
  });
}

function advanceTurn(room) {
  if (!room.players || room.players.length === 0) return;

  // Keyingi o'yinchini aniqlaymiz.
  // Agar keyingi o'yinchi skipTurn (tuzoqda) bo'lsa, uning tuzog'i shu zahoti bekor qilinadi va navbat undan keyingisiga o'tadi!
  let attempts = 0;
  while (attempts < room.players.length) {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    attempts++;

    const nextPlayer = room.players[room.turnIndex];
    if (nextPlayer.skipTurn) {
      nextPlayer.skipTurn = false;
      room.logs.push(`⏳ ${nextPlayer.name} tuzoqda bo'lgani uchun ushbu navbatni avtomatik o'tkazib yubordi!`);
      // yana bir marta oldinga o'tadi
      continue;
    } else {
      break;
    }
  }
}
