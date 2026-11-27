import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  socketId: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  playerToken: { type: String, default: "" },
  name: { type: String, required: true },
  profilePic: { type: String, default: "" },
  score: { type: Number, default: 0 },
  connected: { type: Boolean, default: true },
  lastSeenAt: { type: Date, default: Date.now },
  answers: [
    {
      questionIndex: Number,
      chosenIndex: Number,
      isCorrect: Boolean,
      timeMs: Number, // javob vaqti ms da
      pointsEarned: Number,
    },
  ],
  joinedAt: { type: Date, default: Date.now },
});

const gameSessionSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizGame",
      required: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pin: { type: String, required: true }, // 6 raqamli
    status: {
      type: String,
      enum: ["waiting", "active", "question", "answer", "ended"],
      default: "waiting",
    },
    currentQuestion: { type: Number, default: -1 },
    countdownEndsAt: { type: Date, default: null },
    questionStartedAt: { type: Date, default: null },
    questionEndsAt: { type: Date, default: null },
    players: [playerSchema],
    reactionsEnabled: { type: Boolean, default: true },
    isLocked: { type: Boolean, default: false },
    backgroundTheme: { type: String, default: "default" },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Faqat faol sessiyalar orasida PIN takrorlanmasligi uchun partial unique indeks
gameSessionSchema.index(
  { pin: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "ended" } },
  },
);
gameSessionSchema.index({ status: 1 });
gameSessionSchema.index({ host: 1, status: 1 });

export default mongoose.model("GameSession", gameSessionSchema);
