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
    profilePic: {
      type: String,
      required: true,
      trim: true,
      default: "",
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
    readingBook: {
      bookId: { type: String, default: "" },
      title: { type: String, default: "" },
      author: { type: String, default: "" },
      img: { type: String, default: "" },
      pages: { type: Number, default: 0 },
      currentPage: { type: Number, default: 1 },
      updatedAt: { type: Date, default: Date.now },
    },
    finishedBooks: [
      {
        bookId: { type: String, default: "" },
        title: { type: String, default: "" },
        author: { type: String, default: "" },
        img: { type: String, default: "" },
        pages: { type: Number, default: 0 },
        finishedAt: { type: Date, default: Date.now },
      },
    ],
  },

  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
