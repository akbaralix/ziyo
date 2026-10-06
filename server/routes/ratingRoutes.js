import { Router } from "express";
import { getLeaderboard } from "../controllers/ratingController.js";

const router = Router();

router.get("/", getLeaderboard);

export default router;
