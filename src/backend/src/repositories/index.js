/**
 * Repository factory - Selects between in-memory and PostgreSQL stores
 * Based on USE_POSTGRES environment variable
 */

const { USE_POSTGRES } = require("../config/env");
const memoryStore = require("./memoryStore");
const postgresStore = require("./postgresStore");

let store = null;
let initialized = false;

/**
 * Initialize the repository (setup database if using PostgreSQL)
 */
async function initialize() {
  if (initialized) {
    return;
  }

  if (USE_POSTGRES) {
    console.log("Initializing PostgreSQL repository...");
    await postgresStore.initializeDatabase();
    store = postgresStore;
  } else {
    console.log("Using in-memory repository (development mode)");
    store = memoryStore;
  }

  initialized = true;
}

/**
 * Get current store instance
 */
function getStore() {
  if (!store) {
    throw new Error("Repository not initialized. Call initialize() first.");
  }
  return store;
}

const repositoryApi = {
  initialize,
  getStore,
  isPostgresEnabled: () => USE_POSTGRES,
};

module.exports = new Proxy(repositoryApi, {
  get(target, prop, receiver) {
    if (Reflect.has(target, prop)) {
      return Reflect.get(target, prop, receiver);
    }

    const activeStore = getStore();
    const value = activeStore[prop];

    return typeof value === "function" ? value.bind(activeStore) : value;
  },
});
