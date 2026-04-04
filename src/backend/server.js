const http = require("http");
require("dotenv").config();

const { createApp } = require("./src/app");
const { setupAnonymousChat } = require("./src/socket/anonymousChat");
const { PORT } = require("./src/config/env");
const userRepository = require("./src/repositories");

async function startServer() {
  try {
    const { app, socketCorsOrigin } = await createApp();
    const server = http.createServer(app);

    setupAnonymousChat(server, { corsOrigin: socketCorsOrigin });

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        console.log("HTTP server closed.");
        if (typeof userRepository.close === "function") {
          await userRepository.close();
        }
        process.exit(0);
      });
      // Force exit after timeout
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled Rejection:", reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("Uncaught Exception:", err);
      process.exit(1);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
