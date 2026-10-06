import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: [{ type: String, required: true }], // 2-4 ta variant
  correctIndex: { type: Number, required: true }, // 0-3
  timeLimit: { type: Number, default: 20 }, // soniyalar
  points: { type: Number, default: 100 },
});

const quizGameSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: "" },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (arr) => arr.length >= 8 && arr.length <= 25,
        message: "Savollar soni 8 dan 25 tagacha bo'lishi kerak",
      },
    },
    isPublic: { type: Boolean, default: true },
    playCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("QuizGame", quizGameSchema);
