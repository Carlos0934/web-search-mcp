// src/server.ts
import { Config } from "./config.js";
import { MCPHttpServer } from "./httpServer.js";

// Error handling for unhandled rejections
process.on("unhandledRejection", (reason: any, promise: any) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error: any) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start the server
async function main() {
  try {
    const config = new Config();
    const server = new MCPHttpServer(config);
    await server.start();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
