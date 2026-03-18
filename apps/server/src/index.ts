import { buildServer } from "./server.js";

const start = async () => {
  const app = buildServer();

  try {
    await app.listen({
      host: "0.0.0.0",
      port: app.env.PORT
    });
    app.log.info(`server listening on ${app.env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
