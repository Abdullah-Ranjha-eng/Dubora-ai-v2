import ErrorHandler from "../utils/errorHandler.js";

export default (err, req, res, next) => {
  let error = {
    statusCode: err?.statusCode || 500,
    message: err?.message || "Internal Server Error",
  };

  if (err.name === "CastError")
    error = new ErrorHandler(`Invalid: ${err.path}`, 404);

  if (err.name === "ValidationError")
    error = new ErrorHandler(Object.values(err.errors).map(e => e.message), 400);

  if (err.code === 11000)
    error = new ErrorHandler(`Duplicate field: ${Object.keys(err.keyValue)}`, 400);

  if (err.name === "JsonWebTokenError")
    error = new ErrorHandler("Invalid token. Login again.", 401);

  if (err.name === "TokenExpiredError")
    error = new ErrorHandler("Token expired. Login again.", 401);

  if (process.env.NODE_ENV === "DEVELOPMENT") {
    return res.status(error.statusCode).json({ message: error.message, error: err, stack: err?.stack });
  }

  // In production, only ever show messages we explicitly created above via
  // ErrorHandler (safe, user-facing). Anything else (raw driver/internal
  // errors, e.g. Mongoose buffering timeouts) gets a generic message instead
  // of leaking internals to the client.
  const safeMessage = error instanceof ErrorHandler
    ? error.message
    : "Something went wrong. Please try again.";

  res.status(error.statusCode).json({ message: safeMessage });
};