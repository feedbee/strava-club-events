import { config } from '../config/index.js';
import { MongoClient } from 'mongodb';
import { createMobileAuth, memoryMobileStore, mongoMobileStore } from './mobile-auth.js';

let ready;
let client;
export function initializeMobileAuth() {
  ready ??= (async () => {
    let store;
    if (config.session.driver === 'mongodb') {
      client = new MongoClient(config.session.mongodb.uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
      await client.connect();
      store = mongoMobileStore(client.db(config.session.mongodb.dbName).collection('mobile_auth'));
      await store.init();
    } else store = memoryMobileStore();
    return createMobileAuth({ store, sessionAge: config.session.maxAge });
  })();
  return ready;
}
export async function closeMobileAuth() { await client?.close(); }
export async function checkMobileAuth({ signal }) {
  if (client) await client.db(config.session.mongodb.dbName).command({ ping: 1 }, { signal, timeoutMS: 1000 });
}
