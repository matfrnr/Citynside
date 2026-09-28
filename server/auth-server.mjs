import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { createServer } from "node:http";
import { database, hashInvitation } from "./database.mjs";

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "127.0.0.1";
const sessionDurationSeconds = 60 * 60 * 24 * 7;
const attemptsByAddress = new Map();
const production = process.env.NODE_ENV === "production";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error("Requête trop volumineuse.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sessionCookie(token, maxAge = sessionDurationSeconds) {
  return `citynside_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${production ? "; Secure" : ""}`;
}

function getSession(request) {
  const token = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("citynside_session="))
    ?.slice("citynside_session=".length);
  if (!token) return null;

  const session = database
    .prepare(
      `
    SELECT users.id, users.name, users.email, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `,
    )
    .get(hashToken(token));

  if (!session || session.expires_at <= Math.floor(Date.now() / 1000)) {
    database
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(hashToken(token));
    return null;
  }
  return session;
}

function isRateLimited(request) {
  const address = request.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const current = attemptsByAddress.get(address);
  if (!current || now - current.startedAt > 15 * 60 * 1000) {
    attemptsByAddress.set(address, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 10;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(":");
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(
    scryptSync(password, salt, 64).toString("hex"),
    "hex",
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const dummyPasswordHash = hashPassword(
  "not-a-real-account-password",
  "citynside-login-salt",
);

function createSession(userId, response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;
  database
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    )
    .run(hashToken(token), userId, expiresAt);
  response.setHeader("Set-Cookie", sessionCookie(token));
}

async function handleRequest(request, response) {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );
  if (!url.pathname.startsWith("/api/auth/")) {
    sendJson(response, 404, { error: "Route inconnue." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const session = getSession(request);
    sendJson(response, 200, { user: session ? publicUser(session) : null });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("citynside_session="))
      ?.slice("citynside_session=".length);
    if (token)
      database
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .run(hashToken(token));
    sendJson(
      response,
      200,
      { ok: true },
      { "Set-Cookie": sessionCookie("", 0) },
    );
    return;
  }

  if (
    request.method !== "POST" ||
    !["/api/auth/login", "/api/auth/register"].includes(url.pathname)
  ) {
    sendJson(response, 404, { error: "Route inconnue." });
    return;
  }

  if (isRateLimited(request)) {
    sendJson(response, 429, {
      error: "Trop de tentatives. Réessayez dans 15 minutes.",
    });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    sendJson(response, 400, { error: "Requête invalide." });
    return;
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length > 256
  ) {
    sendJson(response, 400, {
      error: "Vérifiez votre adresse e-mail et votre mot de passe.",
    });
    return;
  }

  if (url.pathname === "/api/auth/register") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const invitation =
      typeof body.invitation === "string" ? body.invitation.trim() : "";
    if (
      name.length < 2 ||
      name.length > 80 ||
      password.length < 12 ||
      invitation.length < 20 ||
      invitation.length > 128
    ) {
      sendJson(response, 400, {
        error:
          "Nom invalide, mot de passe de 12 caractères minimum ou clé manquante.",
      });
      return;
    }

    const invitationHash = hashInvitation(invitation);
    const userId = randomUUID();
    const transaction = database.prepare(
      "SELECT code_hash FROM invitations WHERE code_hash = ? AND used_at IS NULL",
    );
    const existingUser = database.prepare(
      "SELECT id FROM users WHERE email = ?",
    );
    try {
      database.exec("BEGIN IMMEDIATE");
      if (!transaction.get(invitationHash)) {
        database.exec("ROLLBACK");
        sendJson(response, 400, {
          error: "Cette clé est invalide ou a déjà été utilisée.",
        });
        return;
      }
      if (existingUser.get(email)) {
        database.exec("ROLLBACK");
        sendJson(response, 409, {
          error: "Un compte existe déjà avec cette adresse e-mail.",
        });
        return;
      }
      database
        .prepare(
          "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(userId, name, email, hashPassword(password), Date.now());
      database
        .prepare("UPDATE invitations SET used_at = ? WHERE code_hash = ?")
        .run(Date.now(), invitationHash);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    createSession(userId, response);
    sendJson(response, 201, { user: { id: userId, name, email } });
    return;
  }

  const user = database
    .prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?")
    .get(email);
  const validPassword = user
    ? verifyPassword(password, user.password_hash)
    : verifyPassword(password, dummyPasswordHash);
  if (!user || !validPassword) {
    sendJson(response, 401, {
      error: "Adresse e-mail ou mot de passe incorrect.",
    });
    return;
  }

  createSession(user.id, response);
  sendJson(response, 200, { user: publicUser(user) });
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Erreur API d’authentification:", error);
    if (!response.headersSent)
      sendJson(response, 500, { error: "Une erreur est survenue." });
    else response.destroy();
  });
});

server.listen(port, host, () => {
  console.log(`API Citynside prête sur http://${host}:${port}`);
});

function closeServer() {
  server.close(() => database.close());
}

process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
