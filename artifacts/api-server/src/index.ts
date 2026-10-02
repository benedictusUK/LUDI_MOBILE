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
  let maintenanceRunning = false;
  const checkExpiredRecurringEvents = async () => {
    if (maintenanceRunning) return;
    maintenanceRunning = true;
    try {
      await storage.checkExpiredRecurringEvents();
    } catch (err) {
      logger.error({ err }, "Recurring events maintenance failed");
    } finally {
      maintenanceRunning = false;
    }
  };
  setTimeout(checkExpiredRecurringEvents, 10000);
  setInterval(checkExpiredRecurringEvents, 5 * 60 * 1000);
}

start().catch((err) => {
  logger.error({ err }, "Failed to start API server");
  process.exit(1);
});
