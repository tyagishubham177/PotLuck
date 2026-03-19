import type { FastifyReply, FastifyRequest } from "fastify";

export const ACCESS_COOKIE_NAME = "potluck_access_token";
export const REFRESH_COOKIE_NAME = "potluck_refresh_token";

type CookieOptions = {
  maxAgeSeconds: number;
};

function buildCookieValue(name: string, value: string, options: CookieOptions) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`
  ].join("; ");
}

export function parseCookies(request: FastifyRequest) {
  const rawCookieHeader = request.headers.cookie;

  if (!rawCookieHeader) {
    return new Map<string, string>();
  }

  return new Map(
    rawCookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        const key =
          separatorIndex === -1 ? entry : entry.slice(0, separatorIndex).trim();
        const value =
          separatorIndex === -1
            ? ""
            : decodeURIComponent(entry.slice(separatorIndex + 1).trim());

        return [key, value];
      })
  );
}

export function getAccessToken(request: FastifyRequest) {
  const authorizationHeader = request.headers.authorization;

  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  return parseCookies(request).get(ACCESS_COOKIE_NAME);
}

export function getRefreshToken(request: FastifyRequest) {
  return parseCookies(request).get(REFRESH_COOKIE_NAME);
}

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
  accessMaxAgeSeconds: number,
  refreshMaxAgeSeconds: number
) {
  reply.header("Set-Cookie", [
    buildCookieValue(ACCESS_COOKIE_NAME, accessToken, {
      maxAgeSeconds: accessMaxAgeSeconds
    }),
    buildCookieValue(REFRESH_COOKIE_NAME, refreshToken, {
      maxAgeSeconds: refreshMaxAgeSeconds
    })
  ]);
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.header("Set-Cookie", [
    buildCookieValue(ACCESS_COOKIE_NAME, "", { maxAgeSeconds: 0 }),
    buildCookieValue(REFRESH_COOKIE_NAME, "", { maxAgeSeconds: 0 })
  ]);
}
