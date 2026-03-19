import "dotenv/config";

import { buildServer } from "./server.js";

const isAddressInUseError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && error.code === "EADDRINUSE";

const canReuseExistingServer = async (port: number) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

const start = async () => {
  const app = buildServer();

  try {
    await app.listen({
      host: "0.0.0.0",
      port: app.env.PORT
    });
    app.log.info(`server listening on ${app.env.PORT}`);
  } catch (error) {
    if (isAddressInUseError(error)) {
      const canReuse = await canReuseExistingServer(app.env.PORT);

      if (canReuse) {
        app.log.warn(
          `Port ${app.env.PORT} is already serving a PotLuck health endpoint. Reusing the existing server process for local dev.`
        );
        await new Promise(() => {});
        return;
      }

      app.log.error(
        `Port ${app.env.PORT} is already in use. Stop the other process on that port or change PORT in apps/server/.env.`
      );
      process.exit(1);
    }

    app.log.error(error);
    process.exit(1);
  }
};

void start();
