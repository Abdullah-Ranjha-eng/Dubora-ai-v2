import express from "express";
import { registerUser, loginUser, logoutUser, getUserProfile } from "../controllers/authController.js";
import { isAuthenticatedUser } from "../middlewares/auth.js";

const router = express.Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/logout").get(logoutUser);
router.route("/me").get(isAuthenticatedUser, getUserProfile);

export default router;