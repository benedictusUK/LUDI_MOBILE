import app from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./legacyRoutes";
import { notificationWS } from "./websocket";
import { storage } from "./storage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  const server = await registerRoutes(app);
  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Server listening");
    notificationWS.initialize(server);
  });
  const checkExpiredRecurringEvents = async () => {
    try {
      await storage.checkExpiredRecurringEvents();
    } catch (err) {
      logger.error({ err }, "Recurring events maintenance failed");
    }
  };
  setTimeout(checkExpiredRecurringEvents, 10000);
  setInterval(checkExpiredRecurringEvents, 86400000);
}

start().catch((err) => {
  logger.error({ err }, "Failed to start API server");
  process.exit(1);
});
