const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { readDb, updateDb } = require("./lib/store");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const DEMO_ACCOUNT_PASSWORD = "bridge123";
const DEMO_ACCOUNTS = [
  { userId: "u1", email: "selin@projectbridge.demo", phone: "+90 530 000 0001", firstName: "Selin", lastName: "Kaya" },
  { userId: "u2", email: "emre@projectbridge.demo", phone: "+90 530 000 0002", firstName: "Emre", lastName: "Demir" },
  { userId: "u3", email: "mert@projectbridge.demo", phone: "+90 530 000 0003", firstName: "Mert", lastName: "Aydin" },
  { userId: "u4", email: "leyla@projectbridge.demo", phone: "+90 530 000 0004", firstName: "Leyla", lastName: "Arslan" },
  { userId: "u5", email: "aylin@projectbridge.demo", phone: "+90 530 000 0005", firstName: "Aylin", lastName: "Cakir" },
];

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
}

function badRequest(res, message) {
  json(res, 400, { error: message });
}

function unauthorized(res, message) {
  json(res, 401, { error: message });
}

function getStats(db) {
  const totalConnections = db.users.reduce(
    (count, user) => count + (Array.isArray(user.friendIds) ? user.friendIds.length : 0),
    0
  );

  return {
    users: db.users.length,
    projects: db.projects.length,
    conversations: db.conversations.length,
    connections: Math.floor(totalConnections / 2),
  };
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalizePhone(value) {
  return cleanText(value).replace(/[^\d+\-\s()]/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return phone.replace(/\D/g, "").length >= 10;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = String(storedHash || "").split(":");
  if (!salt || !expectedHash) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const candidateBuffer = Buffer.from(crypto.scryptSync(password, salt, 64).toString("hex"), "hex");

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}

function getPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    specialty: user.specialty,
    city: user.city,
    status: user.status,
    bio: user.bio,
    interests: Array.isArray(user.interests) ? user.interests : [],
    availability: user.availability,
    friendIds: Array.isArray(user.friendIds) ? user.friendIds : [],
  };
}

function getSessionUserPayload(user, account) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    email: account.email,
  };
}

function ensureAccountsCollection(db) {
  db.accounts = Array.isArray(db.accounts) ? db.accounts : [];
  return db.accounts;
}

function ensureDemoAccounts(db) {
  const accounts = ensureAccountsCollection(db);
  let changed = false;

  for (const demo of DEMO_ACCOUNTS) {
    const hasUser = db.users.some((user) => user.id === demo.userId);
    const exists = accounts.some(
      (account) => account.userId === demo.userId || normalizeEmail(account.email) === normalizeEmail(demo.email)
    );

    if (!hasUser || exists) {
      continue;
    }

    accounts.push({
      id: createId("acc"),
      userId: demo.userId,
      firstName: demo.firstName,
      lastName: demo.lastName,
      email: normalizeEmail(demo.email),
      phone: demo.phone,
      passwordHash: hashPassword(DEMO_ACCOUNT_PASSWORD),
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }

  return changed;
}

function createRegisteredUserProfile({ firstName, lastName, profession }) {
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    id: createId("u"),
    name: fullName,
    role: profession,
    specialty: "Newly joined collaboration member",
    city: "Remote",
    status: "New member exploring collaboration opportunities",
    bio: `${fullName} joined Project Bridge as ${profession} to discover meaningful partnerships and help promising ideas move forward.`,
    interests: ["co-creation", profession, "new opportunities"],
    availability: "Open to an introductory conversation",
    friendIds: [],
  };
}

async function seedDemoAccounts() {
  await updateDb((db) => {
    ensureDemoAccounts(db);
  });
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    notFound(res);
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      const html = await fs.readFile(indexPath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
      res.end(html);
      return;
    }

    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    res.end(file);
  } catch {
    if (path.extname(requestedPath)) {
      notFound(res);
      return;
    }

    try {
      const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
      res.end(fallback);
    } catch {
      notFound(res);
    }
  }
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/bootstrap") {
    await seedDemoAccounts();
    const db = await readDb();
    json(res, 200, {
      users: db.users.map(getPublicUser),
      projects: db.projects,
      conversations: db.conversations,
      stats: getStats(db),
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/register") {
    const body = await parseBody(req);
    const firstName = cleanText(body.firstName);
    const lastName = cleanText(body.lastName);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const profession = cleanText(body.profession);
    const password = cleanText(body.password);

    if (!firstName || !lastName || !email || !phone || !profession || !password) {
      badRequest(res, "firstName, lastName, email, phone, profession, and password are required");
      return;
    }

    if (!isValidEmail(email)) {
      badRequest(res, "Enter a valid email address");
      return;
    }

    if (!isValidPhone(phone)) {
      badRequest(res, "Enter a valid phone number");
      return;
    }

    if (password.length < 8) {
      badRequest(res, "Password must be at least 8 characters");
      return;
    }

    const createdUser = await updateDb((db) => {
      const accounts = ensureAccountsCollection(db);
      const duplicate = accounts.find((account) => normalizeEmail(account.email) === email);

      if (duplicate) {
        throw new Error("An account with this email already exists");
      }

      const user = createRegisteredUserProfile({ firstName, lastName, profession });
      const account = {
        id: createId("acc"),
        userId: user.id,
        firstName,
        lastName,
        email,
        phone,
        profession,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };

      db.users.unshift(user);
      accounts.unshift(account);
      return user;
    }).catch((error) => {
      badRequest(res, error.message);
      return null;
    });

    if (!createdUser) {
      return;
    }

    json(res, 201, {
      ok: true,
      user: getPublicUser(createdUser),
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/login") {
    await seedDemoAccounts();
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const password = cleanText(body.password);

    if (!email || !password) {
      badRequest(res, "email and password are required");
      return;
    }

    const db = await readDb();
    const accounts = ensureAccountsCollection(db);
    const account = accounts.find((entry) => normalizeEmail(entry.email) === email);

    if (!account || !verifyPassword(password, account.passwordHash)) {
      unauthorized(res, "Incorrect email or password");
      return;
    }

    const user = db.users.find((entry) => entry.id === account.userId);
    if (!user) {
      unauthorized(res, "This account is not linked to an active profile");
      return;
    }

    json(res, 200, {
      ok: true,
      session: {
        userId: user.id,
        email: account.email,
      },
      user: getSessionUserPayload(user, account),
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/projects") {
    const body = await parseBody(req);
    const title = cleanText(body.title);
    const domain = cleanText(body.domain);
    const summary = cleanText(body.summary);
    const collaborationGoal = cleanText(body.collaborationGoal);
    const lookingFor = cleanText(body.lookingFor);
    const ownerId = cleanText(body.ownerId);
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => cleanText(tag)).filter(Boolean)
      : cleanText(body.tags)
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

    if (!title || !domain || !summary || !collaborationGoal || !ownerId) {
      badRequest(res, "title, domain, summary, collaborationGoal, and ownerId are required");
      return;
    }

    const createdProject = await updateDb((db) => {
      const owner = db.users.find((user) => user.id === ownerId);
      if (!owner) {
        throw new Error("Owner not found");
      }

      const project = {
        id: createId("p"),
        title,
        domain,
        summary,
        collaborationGoal,
        ownerId,
        stage: cleanText(body.stage) || "Discovery",
        lookingFor: lookingFor || "Cross-functional collaborators",
        tags,
        createdAt: new Date().toISOString(),
      };

      db.projects.unshift(project);
      return project;
    }).catch((error) => {
      badRequest(res, error.message);
      return null;
    });

    if (!createdProject) {
      return;
    }

    json(res, 201, { project: createdProject });
    return;
  }

  if (req.method === "POST" && pathname === "/api/friends") {
    const body = await parseBody(req);
    const userId = cleanText(body.userId);
    const friendId = cleanText(body.friendId);

    if (!userId || !friendId || userId === friendId) {
      badRequest(res, "userId and friendId are required and must be different");
      return;
    }

    const result = await updateDb((db) => {
      const user = db.users.find((entry) => entry.id === userId);
      const friend = db.users.find((entry) => entry.id === friendId);

      if (!user || !friend) {
        throw new Error("User not found");
      }

      user.friendIds = Array.isArray(user.friendIds) ? user.friendIds : [];
      friend.friendIds = Array.isArray(friend.friendIds) ? friend.friendIds : [];

      if (!user.friendIds.includes(friendId)) {
        user.friendIds.push(friendId);
      }

      if (!friend.friendIds.includes(userId)) {
        friend.friendIds.push(userId);
      }

      return { user, friend };
    }).catch((error) => {
      badRequest(res, error.message);
      return null;
    });

    if (!result) {
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/conversations") {
    const body = await parseBody(req);
    const projectId = cleanText(body.projectId);
    const initiatorId = cleanText(body.initiatorId);
    const collaboratorId = cleanText(body.collaboratorId);
    const focus = cleanText(body.focus);

    if (!projectId || !initiatorId || !collaboratorId || initiatorId === collaboratorId) {
      badRequest(res, "projectId, initiatorId, and collaboratorId are required");
      return;
    }

    const conversation = await updateDb((db) => {
      const project = db.projects.find((entry) => entry.id === projectId);
      const initiator = db.users.find((entry) => entry.id === initiatorId);
      const collaborator = db.users.find((entry) => entry.id === collaboratorId);

      if (!project || !initiator || !collaborator) {
        throw new Error("Project or participant not found");
      }

      const pair = [initiatorId, collaboratorId].sort();
      const existing = db.conversations.find((entry) => {
        const participants = [...entry.participantIds].sort();
        return entry.projectId === projectId && participants.length === pair.length && participants.every((id, index) => id === pair[index]);
      });

      if (existing) {
        return existing;
      }

      const created = {
        id: createId("c"),
        title: `${project.title} Focus Room`,
        projectId,
        participantIds: pair,
        focus: focus || project.collaborationGoal,
        messages: [
          {
            id: createId("m"),
            senderId: initiatorId,
            body: `Started a focused room for "${project.title}" to plan the next collaboration step.`,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      db.conversations.unshift(created);
      return created;
    }).catch((error) => {
      badRequest(res, error.message);
      return null;
    });

    if (!conversation) {
      return;
    }

    json(res, 201, { conversation });
    return;
  }

  if (req.method === "POST" && pathname === "/api/messages") {
    const body = await parseBody(req);
    const conversationId = cleanText(body.conversationId);
    const senderId = cleanText(body.senderId);
    const text = cleanText(body.body);

    if (!conversationId || !senderId || !text) {
      badRequest(res, "conversationId, senderId, and body are required");
      return;
    }

    const message = await updateDb((db) => {
      const conversation = db.conversations.find((entry) => entry.id === conversationId);
      const sender = db.users.find((entry) => entry.id === senderId);

      if (!conversation || !sender) {
        throw new Error("Conversation or sender not found");
      }

      if (!conversation.participantIds.includes(senderId)) {
        throw new Error("Sender is not part of this room");
      }

      const created = {
        id: createId("m"),
        senderId,
        body: text,
        createdAt: new Date().toISOString(),
      };

      conversation.messages.push(created);
      return created;
    }).catch((error) => {
      badRequest(res, error.message);
      return null;
    });

    if (!message) {
      return;
    }

    json(res, 201, { message });
    return;
  }

  notFound(res);
}

seedDemoAccounts().catch((error) => {
  console.error("Unable to seed demo accounts", error);
});

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    json(res, 500, {
      error: "Server error",
      details: error.message,
    });
  }
}

if (require.main === module) {
  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`Project Bridge running at http://localhost:${PORT}`);
  });
}

module.exports = {
  handleRequest,
};
