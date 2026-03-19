import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { sessionRoleSchema, type SessionRole } from "@potluck/contracts";

type TokenRole = SessionRole;
type TokenKind = "access" | "refresh";

type RawTokenPayload = {
  sessionId: string;
  tokenId: string;
  role: TokenRole;
  kind: TokenKind;
  iat: number;
  exp: number;
};

type SignedTokenOptions = {
  sessionId: string;
  tokenId?: string;
  role: TokenRole;
  kind: TokenKind;
  expiresAt: Date;
  issuedAt?: Date;
  secret: string;
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSignedToken(options: SignedTokenOptions) {
  const issuedAt = options.issuedAt ?? new Date();
  const payload: RawTokenPayload = {
    sessionId: options.sessionId,
    tokenId: options.tokenId ?? randomUUID(),
    role: options.role,
    kind: options.kind,
    iat: Math.floor(issuedAt.getTime() / 1000),
    exp: Math.floor(options.expiresAt.getTime() / 1000)
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, options.secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySignedToken(
  token: string,
  adminSecret: string,
  guestSecret: string
) {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  let payload: RawTokenPayload;

  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as RawTokenPayload;
  } catch {
    return null;
  }

  const parsedRole = sessionRoleSchema.safeParse(payload.role);

  if (!parsedRole.success) {
    return null;
  }

  const secret = payload.role === "ADMIN" ? adminSecret : guestSecret;
  const expectedSignature = signPayload(encodedPayload, secret);

  if (
    Buffer.byteLength(providedSignature) !== Buffer.byteLength(expectedSignature) ||
    !timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    )
  ) {
    return null;
  }

  return payload;
}
