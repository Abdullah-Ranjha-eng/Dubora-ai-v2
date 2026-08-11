import dns from "dns";
import mongoose from "mongoose";

// Fixes "querySrv ECONNREFUSED" on some Windows/router/VPN DNS setups that
// can't resolve mongodb+srv SRV records even though the string itself is valid.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export const connectDatabase = () => {
  const DB_URI = process.env.NODE_ENV === "DEVELOPMENT" ? process.env.DB_LOCAL_URI : process.env.DB_URI;

  return mongoose.connect(DB_URI)
    .then((con) => {
      console.log(`MongoDB connected: ${con.connection.host}`);
      return true;
    })
    .catch((err) => {
      console.error(`MongoDB connection FAILED: ${err.message}`);
      return false;
    });
};

