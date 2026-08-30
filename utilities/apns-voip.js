// apns-voip.js
const http2 = require('http2');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const TEAM_ID   = process.env.APPLE_TEAM_ID;     // e.g. 7X12345ABC
const KEY_ID    = process.env.APPLE_KEY_ID;      // e.g. ABCDE12345
const BUNDLE_ID = process.env.IOS_BUNDLE_ID;     // e.g. com.example.app
const P8 = process.env.APPLE_P8_BASE64
  ? Buffer.from(process.env.APPLE_P8_BASE64, 'base64').toString('utf8')
  : fs.readFileSync(process.env.APPLE_P8_PATH, 'utf8');


function apnsJwt() {
  console.log('Loaded .p8 length:', P8?.length);
  console.log('Loaded .p8 head:', P8?.slice(0, 30));
  return jwt.sign({}, P8, {
    algorithm: 'ES256',
    issuer: TEAM_ID,
    header: { alg: 'ES256', kid: KEY_ID }
  });
}

/** Send a VoIP push to a PushKit token */

async function sendVoipPush(voipToken, data = {}) {
    const host = process.env.APNS_USE_SANDBOX === 'true'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
  const client = http2.connect(host);
  console.log('APNs host =', host);

  const req = client.request({
    ':method': 'POST',
    ':path': `/3/device/${voipToken}`,
    'authorization': `bearer ${apnsJwt()}`,
    'apns-push-type': 'voip',
    'apns-topic': `${BUNDLE_ID}.voip`,   // CRITICAL: .voip suffix
    'apns-priority': '10'
  });

  const body = JSON.stringify(
    { 
      aps: { 
        alert: 'Incoming call', // data.body ||
        "sound": "default",
        "category": "INCOMING_CALL"
      }, 
      ...data 
});

  return new Promise((resolve, reject) => {
    let resp = '';
    req.setEncoding('utf8');
    req.on('data', c => resp += c);
    req.on('end', () => { client.close(); resolve(resp || 'OK'); });
    req.on('error', e => { client.close(); reject(e); });
    req.end(body);
  });


}

module.exports = { sendVoipPush };
