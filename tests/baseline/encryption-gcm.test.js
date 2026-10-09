import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import { backend, memoryStore } from '../helpers/runtime.js';
const env = {ENCRYPTION_KEY:'ab'.repeat(32)};
function legacy(text) {
  const iv = randomBytes(16); const cipher = createCipheriv('aes-256-cbc', Buffer.from(env.ENCRYPTION_KEY,'hex'),iv);
  return ':encrypted::'+iv.toString('hex')+':'+Buffer.concat([cipher.update(text,'utf8'),cipher.final()]).toString('hex');
}
test('New ciphertext is versioned GCM, authenticates context and rejects tampering', async () => {
  const { encrypt, decrypt } = await (await backend({env}))('src/utils/encryption.util.js');
  const encrypted = encrypt('secret', 'session:access_token');
  assert.match(encrypted, /^:encrypted::v2:/);
  assert.equal(decrypt(encrypted, 'session:access_token'), 'secret');
  assert.throws(() => decrypt(encrypted, 'other:access_token'));
  const parts = encrypted.split(':');
  for (const index of [4,5,6]) {
    const changed = [...parts]; changed[index] = (changed[index][0] === '0' ? '1' : '0')+changed[index].slice(1);
    assert.throws(() => decrypt(changed.join(':'), 'session:access_token'));
  }
});
test('Existing CBC data reads with the same key and saves as GCM without mutating tokens', async () => {
  const { encryptSessionStore } = await (await backend({env}))('src/utils/encryption.util.js');
  const raw = memoryStore(); raw.records.set('id',{tokens:{access_token:legacy('access'),refresh_token:legacy('refresh')}});
  const store = encryptSessionStore(raw);
  const data = await new Promise((resolve,reject)=>store.get('id',(err,value)=>err?reject(err):resolve(value)));
  assert.equal(data.tokens.access_token,'access');
  await new Promise((resolve,reject)=>store.set('id',data,err=>err?reject(err):resolve()));
  assert.match(raw.records.get('id').tokens.access_token,/^:encrypted::v2:/);
  assert.equal(data.tokens.refresh_token,'refresh');
});
test('Moving authenticated token ciphertext to another field invalidates the persisted identity',async()=>{
  const {encryptSessionStore}=await (await backend({env}))('src/utils/encryption.util.js');
  const raw=memoryStore();const store=encryptSessionStore(raw);
  await new Promise((resolve,reject)=>store.set('id',{user:{id:'user'},tokens:{access_token:'access',refresh_token:'refresh'}},error=>error?reject(error):resolve()));
  raw.records.get('id').tokens.refresh_token=raw.records.get('id').tokens.access_token;
  const result=await new Promise((resolve,reject)=>store.get('id',(error,value)=>error?reject(error):resolve(value)));
  assert.equal(result,null);assert.equal(raw.records.has('id'),false);
});
