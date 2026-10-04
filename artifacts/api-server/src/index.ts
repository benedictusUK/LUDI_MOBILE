import app from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./legacyRoutes";
import { notificationWS } from "./websocket";
import { storage } from "./storage";
import { processPaymentDeadlines } from "./payments/policyService";
import { startNotificationWorkers } from "./notifications/service";
import { apnsConfiguration } from "./notifications/apns";

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
  // Check the managed API process's environment, which can differ from a shell.
  // Never log the full configuration: it contains the private key and identifiers.
  const { configured, missing, bundleId } = apnsConfiguration();
  logger.info({ configured, missing, bundleId }, "Apple push configuration checked");
  startNotificationWorkers();
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
  let paymentMaintenanceRunning = false;
  const maintainPayments = async () => {
    if (paymentMaintenanceRunning) return;
    paymentMaintenanceRunning = true;
    try {
      await processPaymentDeadlines();
    } catch (error: any) {
      logger.error({ errorName: error.name }, "Payment deadline processing failed; will retry");
    } finally {
      paymentMaintenanceRunning = false;
    }
  };
  setTimeout(maintainPayments, 15000);
  setInterval(maintainPayments, 60 * 1000);
}

start().catch((err) => {
  logger.error({ err }, "Failed to start API server");
  process.exit(1);
});
