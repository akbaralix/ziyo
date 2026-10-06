import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  socketId: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  name: { type: String, required: true },
  avatar: { type: String, default: "" },
  score: { type: Number, default: 0 },
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
    pin: { type: String, required: true, unique: true }, // 6 raqamli
    status: {
      type: String,
      enum: ["waiting", "active", "question", "answer", "ended"],
      default: "waiting",
    },
    currentQuestion: { type: Number, default: -1 },
    questionStartedAt: { type: Date, default: null },
    players: [playerSchema],
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// PIN indeksi
gameSessionSchema.index({ pin: 1 });
gameSessionSchema.index({ status: 1 });

export default mongoose.model("GameSession", gameSessionSchema);
