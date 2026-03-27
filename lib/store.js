const fs = require("fs/promises");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "db.json");
const EMPTY_DB = {
  users: [],
  accounts: [],
  projects: [],
  conversations: [],
};

let writeQueue = Promise.resolve();

async function ensureDbFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

function normalizeDb(db) {
  return {
    users: Array.isArray(db.users) ? db.users : [],
    accounts: Array.isArray(db.accounts) ? db.accounts : [],
    projects: Array.isArray(db.projects) ? db.projects : [],
    conversations: Array.isArray(db.conversations) ? db.conversations : [],
  };
}

async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return normalizeDb(raw ? JSON.parse(raw) : EMPTY_DB);
}

async function updateDb(mutator) {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
    return result === undefined ? db : result;
  });

  return writeQueue;
}

module.exports = {
  DATA_FILE,
  readDb,
  updateDb,
};
