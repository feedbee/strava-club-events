import crypto from 'crypto';
import { config } from '../config/index.js';

// Encryption configuration
const ENCRYPTION_KEY = config.encryptionKey;
const ENCRYPTION_PREFIX = ':encrypted::';

// v2 authenticates the ciphertext and its session/field context. Legacy CBC is read-only.
export const encrypt = (text, context = '') => {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `${ENCRYPTION_PREFIX}v2:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
  } catch { throw new Error('Failed to encrypt data'); }
};

export const decrypt = (text, context = '') => {
  if (!text) return text;
  if (typeof text !== 'string') throw new Error('Invalid encrypted data');
  if (!text.startsWith(ENCRYPTION_PREFIX)) return text;
  try {
    const parts = text.slice(ENCRYPTION_PREFIX.length).split(':');
    let decipher; let payload;
    if (parts[0] === 'v2') {
      if (parts.length !== 4 || !/^[a-f0-9]{24}$/.test(parts[1]) ||
          !/^[a-f0-9]{32}$/.test(parts[2]) || !/^(?:[a-f0-9]{2})+$/.test(parts[3])) throw new Error();
      decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(parts[1], 'hex'));
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
      payload = parts[3];
    } else {
      if (parts.length !== 2 || !/^[a-f0-9]{32}$/.test(parts[0]) ||
          !/^(?:[a-f0-9]{32})+$/.test(parts[1])) throw new Error();
      decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(parts[0], 'hex'));
      payload = parts[1];
    }
    return Buffer.concat([decipher.update(Buffer.from(payload, 'hex')), decipher.final()]).toString('utf8');
  } catch { throw new Error('Failed to decrypt data'); }
};

/** Encrypt only at the persistence boundary; request sessions remain plaintext. */
export function encryptSessionStore(store) {
  const originalSet = store.set;
  const originalGet = store.get;
  function transform(id, session, operation) {
    if (!session?.tokens) return session;
    const copy = { ...session, tokens: { ...session.tokens } };
    for (const field of ['access_token', 'refresh_token']) {
      if (copy.tokens[field]) {
        copy.tokens[field] = operation(copy.tokens[field], `${id}:${field}`);
        if (operation === decrypt && copy.tokens[field].startsWith(ENCRYPTION_PREFIX)) {
          throw new Error('Invalid nested session encryption');
        }
      }
    }
    return copy;
  }
  store.decodeSession = (id, data) => transform(id, data, decrypt);
  store.requiresEncryptionUpgrade = data => ['access_token', 'refresh_token'].some(field =>
    data?.tokens?.[field] && !data.tokens[field].startsWith(`${ENCRYPTION_PREFIX}v2:`));
  store.set = function (id, session, callback = () => {}) {
    let encrypted;
    try { encrypted = transform(id, session, encrypt); }
    catch (error) { return callback(error); }
    return originalSet.call(this, id, encrypted, error => {
      if (!error && encrypted?._revision) session._revision = encrypted._revision;
      callback(error);
    });
  };
  store.get = function (id, callback) {
    return originalGet.call(this, id, (error, session) => {
      if (error || !session) return callback(error, session);
      let decrypted;
      try { decrypted = transform(id, session, decrypt); }
      catch {
        return this.destroy(id, error => callback(error, null));
      }
      callback(null, decrypted);
    });
  };
  if (store.commitRefresh) {
    const commit = store.commitRefresh;
    store.commitRefresh = function (id, revision, owner, tokens) {
      return commit.call(this, id, revision, owner, transform(id, { tokens }, encrypt).tokens);
    };
  }
  return store;
}
