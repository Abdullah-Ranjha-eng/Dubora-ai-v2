import User from "../models/user.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import sendToken from "../utils/jwtToken.js";

// Register => POST /api/v1/register
export const registerUser = catchAsyncErrors(async (req, res, next) => {
  const { name, email, password } = req.body;
  const user = await User.create({ name, email, password });
  sendToken(user, 201, res);
});

// Login => POST /api/v1/login
export const loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return next(new ErrorHandler("Please enter email and password.", 400));

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password)))
    return next(new ErrorHandler("Invalid email or password.", 401));

  sendToken(user, 200, res);
});

// Logout => GET /api/v1/logout
export const logoutUser = catchAsyncErrors(async (req, res) => {
  res.cookie("token", null, { expires: new Date(Date.now()), httpOnly: true, sameSite: "none", secure: true });
  res.status(200).json({ success: true, message: "Logged out successfully." });
});

// Get profile => GET /api/v1/me
export const getUserProfile = catchAsyncErrors(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({ success: true, user });
});