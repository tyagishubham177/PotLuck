import Fastify from "fastify";

import { getServerEnv, type ServerEnv } from "@potluck/config/server";
import { healthResponseSchema } from "@potluck/contracts";
import { createEnginePlaceholder } from "@potluck/game-engine";

type BuildServerOptions = {
  env?: Partial<Record<keyof ServerEnv, string>>;
};

export function buildServer(options: BuildServerOptions = {}) {
  const env = getServerEnv(options.env);
  const app = Fastify({
    logger: env.NODE_ENV !== "test"
  });

  const engine = createEnginePlaceholder();

  app.decorate("env", env);

  app.get("/health", async () => {
    return healthResponseSchema.parse({
      status: "ok",
      service: "potluck-server",
      environment: env.NODE_ENV,
      appOrigin: env.APP_ORIGIN,
      engine: engine.name
    });
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    env: ServerEnv;
  }
}
