import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { sql } from "./db";
import { HttpError } from "./http";

export type Role = "admin" | "barber";
export type Me = { id: string; name: string; role: Role };

export const SESSION_COOKIE = "barbearia_session";
const SESSION_DAYS = 180; // aparelho da barbearia fica logado
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 10;

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET não configurada");
  return new TextEncoder().encode("dev-only-secret-not-for-production");
}

export function newPassword(v: unknown): string {
  if (typeof v !== "string" || v.length < 4) throw new HttpError(400, "A senha precisa ter pelo menos 4 caracteres");
  if (v.length > 72) throw new HttpError(400, "Senha muito longa");
  return v;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize(), salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize(), Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Comparação em tempo constante para códigos/tokens de tamanhos diferentes. */
export function sameSecret(given: string, expected: string) {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function cookie(value: string, maxAge: number) {
  const parts = [`${SESSION_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function sessionCookie(user: { id: string; session_version: number }) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const token = await new SignJWT({ v: user.session_version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());
  return cookie(token, maxAge);
}

export const clearedSessionCookie = () => cookie("", 0);

/** Valida o JWT e confere no banco: acesso ainda ativo e senha não trocada desde o login. */
export async function userFromToken(token: string | undefined): Promise<Me | null> {
  if (!token) return null;
  let sub: string | undefined;
  let version: unknown;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    sub = payload.sub;
    version = payload.v;
  } catch {
    return null;
  }
  if (!sub) return null;
  const [user] = await sql<{ id: string; name: string; role: Role; session_version: number; has_access: boolean }>(
    `SELECT id, name, role, session_version, password_hash IS NOT NULL AS has_access FROM barbers WHERE id = $1`,
    [sub],
  );
  if (!user || !user.has_access || user.session_version !== version) return null;
  return { id: user.id, name: user.name, role: user.role };
}

function tokenFrom(req: Request) {
  for (const part of (req.headers.get("cookie") ?? "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === SESSION_COOKIE) return decodeURIComponent(part.slice(i + 1));
  }
}

/** Para Route Handlers: 401 sem sessão válida, 403 se a ação é só do administrador. */
export async function requireUser(req: Request, role?: "admin"): Promise<Me> {
  const me = await userFromToken(tokenFrom(req));
  if (!me) throw new HttpError(401, "Faça login de novo");
  if (role === "admin" && me.role !== "admin") throw new HttpError(403, "Só o administrador pode fazer isso");
  return me;
}
