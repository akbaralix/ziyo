import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    telegramUsername: {
      type: String,
      default: "",
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    studyPlace: {
      type: String,
      enum: ["institut", "maktab"],
      required: true,
    },
    course: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      default: "",
    },
    xp: {
      type: Number,
      default: 0,
    },
    rank: {
      type: Number,
      default: 1,
    },
    readBooks: {
      type: Number,
      default: 0,
    },
    solvedQuizzes: {
      type: Number,
      default: 0,
    },
    avatar: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
