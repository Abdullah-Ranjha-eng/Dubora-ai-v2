const sendToken = (user, statusCode, res) => {
  const token = user.getJwtToken();

  const options = {
    expires: new Date(Date.now() + process.env.COOKIE_EXPIRES_TIME * 24 * 60 * 60 * 1000),
    httpOnly: true,
    // Frontend and backend live on different Vercel domains (different
    // "sites" from the browser's perspective, since vercel.app itself is a
    // public suffix). A cross-site cookie is only stored/sent by the
    // browser at all when it's SameSite=None + Secure — without these, the
    // cookie from login is silently dropped, so every later request looks
    // logged-out even though login itself returned 200.
    sameSite: "none",
    secure: true,
  };

  res.status(statusCode).cookie("token", token, options).json({ success: true, token, user });
};

export default sendToken;