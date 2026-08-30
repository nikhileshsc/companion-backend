const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAndroidPurchase, getAppleTransactionId, googlePlanMatches, isActiveGoogleSubscription, verifyInAppPurchase, PurchaseVerificationError } = require('../utilities/inAppPurchase');
const { validateCreateInAppSubscriptionBody, validateVerifyInAppPurchaseSubscription } = require('../models/user');

const id = '507f1f77bcf86cd799439011';

test('accepts the legacy Android Purchase.toString payload without trusting its product details', () => {
    const result = parseAndroidPurchase({ androidInAppPurchaseRes: { purchaseObject: 'Purchase. Json: {"productId":"forged","purchaseToken":"token-1234567890123456"}, Signature: ignored' } });
    assert.equal(result.purchaseToken, 'token-1234567890123456');
});

test('requires a bounded, well-formed Android purchase payload', () => {
    assert.throws(() => parseAndroidPurchase({ androidInAppPurchaseRes: { purchaseObject: 'not a purchase' } }), PurchaseVerificationError);
    assert.throws(() => parseAndroidPurchase({ purchaseToken: 'short' }), PurchaseVerificationError);
});

test('extracts an iOS transaction ID only from JSON and rejects forged syntax', () => {
    assert.equal(getAppleTransactionId({ iosInAppPurchaseRes: '{"transactionId":"123456789"}' }), '123456789');
    assert.throws(() => getAppleTransactionId({ iosInAppPurchaseRes: 'not-json' }), PurchaseVerificationError);
});

test('accepts current client fields but rejects unexpected receipt or price fields', () => {
    const currentIosPayload = { subscribedPlan: id, subscriptionId: id, iosInAppPurchaseRes: '{"transactionId":"123456789"}', iosInAppVerifyReceiptRes: ' ', androidInAppPurchaseRes: { purchaseObject: '' }, type: 'newPurchase' };
    assert.equal(validateVerifyInAppPurchaseSubscription(currentIosPayload).error, undefined);
    assert.ok(validateVerifyInAppPurchaseSubscription({ ...currentIosPayload, price: 1 }).error);
});

test('requires an owned target subscription for upgrades while preserving new-purchase compatibility', () => {
    assert.equal(validateCreateInAppSubscriptionBody({ subscribedPlan: id, planPurchasedFrom: 'ios', type: 'newPurchase', subscriptionId: '' }).error, undefined);
    assert.ok(validateCreateInAppSubscriptionBody({ subscribedPlan: id, planPurchasedFrom: 'ios', type: 'upgrade', subscriptionId: '' }).error);
});

test('fails closed when Google Play credentials are not configured', async () => {
    const savedAccount = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    const savedAccountBase64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64;
    const savedPackage = process.env.GOOGLE_PLAY_PACKAGE_NAME;
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64;
    delete process.env.GOOGLE_PLAY_PACKAGE_NAME;
    await assert.rejects(
        verifyInAppPurchase({ androidSubscriptionId: 'monthly' }, { purchaseToken: 'token-1234567890123456' }, 'android'),
        (error) => error instanceof PurchaseVerificationError && error.statusCode === 503
    );
    if (savedAccount !== undefined) process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = savedAccount;
    if (savedAccountBase64 !== undefined) process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64 = savedAccountBase64;
    if (savedPackage !== undefined) process.env.GOOGLE_PLAY_PACKAGE_NAME = savedPackage;
});

test('maps a Google Play product and base plan to exactly the configured internal plan', () => {
    const plan = { androidProductId: 'companion_subscriptions', androidBasePlanId: 'monthly' };
    assert.equal(googlePlanMatches(plan, { productId: 'companion_subscriptions', basePlanId: 'monthly' }), true);
    assert.equal(googlePlanMatches(plan, { productId: 'companion_subscriptions', basePlanId: 'yearly' }), false);
    assert.equal(googlePlanMatches(plan, { productId: 'forged_product', basePlanId: 'monthly' }), false);
});

test('only grants entitlement for an unexpired active, grace-period, or canceled Google subscription', () => {
    const lineItem = { expiryTime: new Date(Date.now() + 60_000).toISOString() };
    assert.equal(isActiveGoogleSubscription({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' }, lineItem), true);
    assert.equal(isActiveGoogleSubscription({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }, lineItem), true);
    assert.equal(isActiveGoogleSubscription({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }, lineItem), false);
    assert.equal(isActiveGoogleSubscription({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' }, { expiryTime: new Date(Date.now() - 1).toISOString() }), false);
    assert.equal(isActiveGoogleSubscription({ subscriptionState: 'SUBSCRIPTION_STATE_REVOKED' }, lineItem), false);
});
