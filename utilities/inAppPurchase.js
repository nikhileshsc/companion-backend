const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
let googleToken;

class PurchaseVerificationError extends Error {
    constructor(message, statusCode = 400, code = 'purchase_verification_failed') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

function base64Url(value) {
    return Buffer.from(value).toString('base64url');
}

function maskIdentifier(value) {
    if (!value) return '';
    return `${String(value).slice(0, 6)}…${String(value).slice(-4)}`;
}

function hashIdentifier(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function parseJson(value, field) {
    if (typeof value === 'object' && value) return value;
    if (typeof value !== 'string' || value.length > 32 * 1024) {
        throw new PurchaseVerificationError(`Invalid ${field}.`);
    }
    try {
        return JSON.parse(value);
    } catch {
        throw new PurchaseVerificationError(`Invalid ${field}.`);
    }
}

function parseAndroidPurchase(payload) {
    if (payload.purchaseToken && typeof payload.purchaseToken === 'string' && payload.purchaseToken.length >= 16 && payload.purchaseToken.length <= 4096) return { purchaseToken: payload.purchaseToken };
    const purchase = payload.androidInAppPurchaseRes;
    if (purchase && purchase.purchaseToken && typeof purchase.purchaseToken === 'string' && purchase.purchaseToken.length >= 16 && purchase.purchaseToken.length <= 4096) return { purchaseToken: purchase.purchaseToken };
    const raw = purchase && purchase.purchaseObject;
    if (typeof raw !== 'string' || raw.length > 32 * 1024) {
        throw new PurchaseVerificationError('A Google Play purchase token is required.');
    }
    const jsonStart = raw.indexOf('Json: ');
    if (jsonStart === -1) throw new PurchaseVerificationError('Invalid Google Play purchase payload.');
    const json = raw.slice(jsonStart + 6);
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < json.length; index += 1) {
        const character = json[index];
        if (quoted) {
            escaped = character === '\\' && !escaped;
            if (character === '"' && !escaped) quoted = false;
            continue;
        }
        if (character === '"') quoted = true;
        if (character === '{') depth += 1;
        if (character === '}') {
            depth -= 1;
            if (depth === 0) {
                const parsed = parseJson(json.slice(0, index + 1), 'Google Play purchase payload');
                if (typeof parsed.purchaseToken !== 'string' || parsed.purchaseToken.length < 16 || parsed.purchaseToken.length > 4096) break;
                return parsed;
            }
        }
    }
    throw new PurchaseVerificationError('Invalid Google Play purchase payload.');
}

function getAppleTransactionId(payload) {
    if (typeof payload.iosTransactionId === 'string') return payload.iosTransactionId;
    const purchase = parseJson(payload.iosInAppPurchaseRes, 'App Store purchase payload');
    return purchase.transactionId;
}

function readGoogleServiceAccount() {
    const encoded = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64;
    const raw = encoded ? Buffer.from(encoded, 'base64').toString('utf8') : process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!raw || !process.env.GOOGLE_PLAY_PACKAGE_NAME) {
        throw new PurchaseVerificationError('Google Play verification is not configured.', 503, 'provider_not_configured');
    }
    try {
        const account = JSON.parse(raw);
        if (!account.client_email || !account.private_key) throw new Error('missing service-account fields');
        return account;
    } catch {
        throw new PurchaseVerificationError('Google Play verification is not configured.', 503, 'provider_not_configured');
    }
}

async function getGoogleAccessToken() {
    if (googleToken && googleToken.expiresAt > Date.now() + 60_000) return googleToken.value;
    const account = readGoogleServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64Url(JSON.stringify({ iss: account.client_email, scope: GOOGLE_SCOPE, aud: account.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${signer.sign(account.private_key, 'base64url')}`;
    try {
        const response = await axios.post(account.token_uri || 'https://oauth2.googleapis.com/token', new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(), {
            headers: { 'content-type': 'application/x-www-form-urlencoded' }, timeout: 10_000
        });
        googleToken = { value: response.data.access_token, expiresAt: Date.now() + (Number(response.data.expires_in) || 3600) * 1000 };
        return googleToken.value;
    } catch {
        throw new PurchaseVerificationError('Google Play is temporarily unavailable.', 503, 'provider_unavailable');
    }
}

function allowsSandbox() {
    return process.env.NODE_ENV !== 'prod' && process.env.IAP_ALLOW_TEST_PURCHASES === 'true';
}

function isActiveGoogleSubscription(data, lineItem, now = new Date()) {
    const expiry = lineItem && lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const validStates = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);
    return Boolean(lineItem && validStates.has(data.subscriptionState) && expiry && expiry > now);
}

async function verifyGooglePurchase(plan, payload) {
    const purchase = parseAndroidPurchase(payload);
    if (typeof purchase.purchaseToken !== 'string' || purchase.purchaseToken.length < 16 || purchase.purchaseToken.length > 4096) {
        throw new PurchaseVerificationError('Invalid Google Play purchase token.');
    }
    const accessToken = await getGoogleAccessToken();
    let data;
    try {
        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(process.env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchase.purchaseToken)}`;
        data = (await axios.get(url, { headers: { authorization: `Bearer ${accessToken}` }, timeout: 10_000 })).data;
    } catch (error) {
        if (error.response && error.response.status < 500) throw new PurchaseVerificationError('Google Play could not validate this purchase.');
        throw new PurchaseVerificationError('Google Play is temporarily unavailable.', 503, 'provider_unavailable');
    }
    const lineItem = (data.lineItems || []).find((item) => item.expiryTime);
    const expiry = lineItem && lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    if (data.subscriptionState === 'SUBSCRIPTION_STATE_REVOKED') {
        const error = new PurchaseVerificationError('Google Play reports that this purchase was revoked.', 409, 'purchase_revoked');
        error.ownershipId = hashIdentifier(purchase.purchaseToken);
        throw error;
    }
    if (!isActiveGoogleSubscription(data, lineItem)) {
        throw new PurchaseVerificationError('Google Play reports that this purchase is not active.');
    }
    if (data.testPurchase && !allowsSandbox()) {
        throw new PurchaseVerificationError('Test purchases are not accepted in this environment.');
    }
    return {
        provider: 'google_play', transactionId: data.latestOrderId || crypto.createHash('sha256').update(purchase.purchaseToken).digest('hex'),
        ownershipId: hashIdentifier(purchase.purchaseToken), productId: lineItem.productId, purchasedAt: new Date(data.startTime || Date.now()),
        expiresAt: expiry, status: data.subscriptionState, environment: data.testPurchase ? 'sandbox' : 'production',
        productId: lineItem.productId, basePlanId: lineItem.offerDetails && lineItem.offerDetails.basePlanId,
        acknowledgementState: data.acknowledgementState, purchaseToken: purchase.purchaseToken,
        linkedPurchaseToken: data.linkedPurchaseToken || '',
        linkedOwnershipId: data.linkedPurchaseToken ? hashIdentifier(data.linkedPurchaseToken) : '',
    };
}

function googlePlanMatches(plan, purchase) {
    const productId = plan.androidProductId || process.env.GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID || plan.androidGroupId;
    const basePlanId = plan.androidBasePlanId || plan.androidSubscriptionId;
    return Boolean(productId && basePlanId && purchase.productId === productId && purchase.basePlanId === basePlanId);
}

async function acknowledgeGooglePurchase(purchase) {
    if (purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') return;
    const accessToken = await getGoogleAccessToken();
    try {
        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(process.env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(purchase.productId)}/tokens/${encodeURIComponent(purchase.purchaseToken)}:acknowledge`;
        await axios.post(url, {}, { headers: { authorization: `Bearer ${accessToken}` }, timeout: 10_000 });
    } catch (error) {
        if (error.response && error.response.status === 409) return; // already acknowledged by a retry
        throw new PurchaseVerificationError('Google Play acknowledgement is temporarily unavailable.', 503, 'acknowledgement_unavailable');
    }
}

function readApplePrivateKey() {
    if (process.env.APPLE_IAP_PRIVATE_KEY_BASE64) return Buffer.from(process.env.APPLE_IAP_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
    if (process.env.APPLE_IAP_PRIVATE_KEY_PATH) return fs.readFileSync(process.env.APPLE_IAP_PRIVATE_KEY_PATH, 'utf8');
    throw new PurchaseVerificationError('App Store verification is not configured.', 503, 'provider_not_configured');
}

function appleJwt() {
    if (!process.env.APPLE_APP_STORE_ISSUER_ID || !process.env.APPLE_KEY_ID || !process.env.IOS_BUNDLE_ID) {
        throw new PurchaseVerificationError('App Store verification is not configured.', 503, 'provider_not_configured');
    }
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'ES256', kid: process.env.APPLE_KEY_ID, typ: 'JWT' }));
    const claims = base64Url(JSON.stringify({ iss: process.env.APPLE_APP_STORE_ISSUER_ID, iat: now, exp: now + 300, aud: 'appstoreconnect-v1', bid: process.env.IOS_BUNDLE_ID }));
    const signer = crypto.createSign('SHA256');
    signer.update(`${header}.${claims}`);
    return `${header}.${claims}.${signer.sign({ key: readApplePrivateKey(), dsaEncoding: 'ieee-p1363' }, 'base64url')}`;
}

function decodeJwsPayload(value) {
    const parts = String(value || '').split('.');
    if (parts.length !== 3) throw new PurchaseVerificationError('Invalid App Store response.');
    try {
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
        throw new PurchaseVerificationError('Invalid App Store response.');
    }
}

async function verifyApplePurchase(plan, payload) {
    const transactionId = getAppleTransactionId(payload);
    if (!/^[A-Za-z0-9-]{6,256}$/.test(transactionId || '')) throw new PurchaseVerificationError('Invalid App Store transaction ID.');
    if (!plan.iOsSubscriptionId) throw new PurchaseVerificationError('This plan is not available on iOS.');
    const sandbox = process.env.IAP_APPLE_SANDBOX === 'true';
    if (sandbox && !allowsSandbox()) throw new PurchaseVerificationError('Test purchases are not accepted in this environment.');
    const baseUrl = sandbox ? 'https://api.storekit-sandbox.itunes.apple.com' : 'https://api.storekit.itunes.apple.com';
    let response;
    try {
        response = await axios.get(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, { headers: { authorization: `Bearer ${appleJwt()}` }, timeout: 10_000 });
    } catch (error) {
        if (error.response && error.response.status < 500) throw new PurchaseVerificationError('App Store could not validate this purchase.');
        throw new PurchaseVerificationError('App Store is temporarily unavailable.', 503, 'provider_unavailable');
    }
    const transaction = decodeJwsPayload(response.data.signedTransactionInfo);
    const expiresAt = transaction.expiresDate ? new Date(Number(transaction.expiresDate)) : null;
    if (transaction.bundleId !== process.env.IOS_BUNDLE_ID || transaction.productId !== plan.iOsSubscriptionId || transaction.revocationDate || (expiresAt && expiresAt <= new Date())) {
        throw new PurchaseVerificationError('App Store reports that this purchase is not active.');
    }
    if ((transaction.environment === 'Sandbox' || transaction.environment === 'Xcode') && !allowsSandbox()) {
        throw new PurchaseVerificationError('Test purchases are not accepted in this environment.');
    }
    return {
        provider: 'app_store', transactionId: String(transaction.transactionId), ownershipId: hashIdentifier(transaction.originalTransactionId || transaction.transactionId),
        productId: transaction.productId, purchasedAt: new Date(Number(transaction.purchaseDate)), expiresAt,
        status: transaction.revocationDate ? 'REVOKED' : 'ACTIVE', environment: String(transaction.environment || 'Production').toLowerCase()
    };
}

async function verifyInAppPurchase(plan, payload, platform) {
    if (platform === 'android') return verifyGooglePurchase(plan, payload);
    if (platform === 'ios') return verifyApplePurchase(plan, payload);
    throw new PurchaseVerificationError('Unsupported purchase platform.');
}

module.exports = { PurchaseVerificationError, acknowledgeGooglePurchase, googlePlanMatches, isActiveGoogleSubscription, verifyInAppPurchase, parseAndroidPurchase, getAppleTransactionId, maskIdentifier };
