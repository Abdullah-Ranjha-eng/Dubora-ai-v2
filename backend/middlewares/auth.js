import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import User from "../models/user.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "./catchAsyncErrors.js";

export const isAuthenticatedUser = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;
  if (!token) return next(new ErrorHandler("Login first to access this resource.", 401));

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id);
  next();
});

// Same cross-site requirements as the "token" cookie in utils/jwtToken.js —
// frontend and backend are different Vercel domains, so this only survives
// as SameSite=None + Secure.
const GUEST_COOKIE_OPTIONS = {
  expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  httpOnly: true,
  sameSite: "none",
  secure: true,
};

// Guest-friendly version of isAuthenticatedUser, used on every video/caption/
// translate route EXCEPT the dashboard list (GET /videos) — that one stays
// behind isAuthenticatedUser above, since the dashboard is the one thing
// that's registered-users-only. Everywhere this runs: a logged-in user gets
// req.user exactly as before; anyone else gets req.user = null plus a
// stable req.guestId (persisted in its own cookie on first hit), so their
// uploads/captions/translations stay theirs across requests without ever
// creating an account. Controllers use utils/ownership.js's ownerFields()/
// isOwner() to work with whichever of the two is actually set.
export const identifyUser = catchAsyncErrors(async (req, res, next) => {
  const { token, guestId } = req.cookies;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
        return next();
      }
    } catch {
      // Expired/invalid token — fall through to guest handling instead of
      // rejecting outright, so a stale cookie doesn't lock someone out of
      // work they were doing as a guest before it expired.
    }
  }

  req.user = null;
  req.guestId = guestId || randomUUID();
  if (!guestId) res.cookie("guestId", req.guestId, GUEST_COOKIE_OPTIONS);
  next();
});

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return next(new ErrorHandler(`Role (${req.user.role}) is not allowed.`, 403));
  next();
};