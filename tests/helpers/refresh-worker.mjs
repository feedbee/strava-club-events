import MongoStore from 'connect-mongo';
import { coordinateSessionStore } from '../../src/utils/session-coordination.js';
import { encryptSessionStore } from '../../src/utils/encryption.util.js';
import { refreshSession } from '../../src/services/session-refresh.js';
const store = encryptSessionStore(coordinateSessionStore(MongoStore.create({
  mongoUrl:process.env.TEST_MONGODB_URI,dbName:process.env.MONGODB_DB,stringify:false,ttl:86400,
  mongoOptions:{serverSelectionTimeoutMS:5000}
})));
let release;
process.on('message', async message => {
  if (message.type === 'release') return release?.();
  if (message.type !== 'start') return;
  process.send({type:'started'});
  try {
    const session = await refreshSession(store,message.id,async () => {
      const gate = new Promise(resolve => {release=resolve;});
      process.send({type:'exchange'}); await gate;
      return {access_token:'rotated-access',refresh_token:'rotated-refresh',expires_in:3600};
    });
    process.send({type:'done',valid:session.tokens.access_token==='rotated-access'});
  } catch(error) {process.send({type:'failed',status:error.status,message:error.message});}
});
process.once('disconnect', async () => {await store.close();process.exit(0);});
await store.collectionP;
process.send({type:'ready'});
