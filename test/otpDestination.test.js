const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sendMessage } = require('../utilities/aws_sns_service');
const { enforceOtpRequestLimits, OtpRateLimit } = require('../models/otpRateLimit');
const {
    normalizeIndianSmsDestination,
    normalizePhoneNumber,
} = require('../utilities/otpDestination');

test('permits only a normalized valid Indian +91 mobile destination', () => {
    assert.equal(normalizeIndianSmsDestination('+919876543210'), '+919876543210');
    assert.equal(normalizeIndianSmsDestination('+91 98765 43210'), '+919876543210');
    assert.equal(normalizeIndianSmsDestination('+911234567890'), null);
});

test('does not infer India from a number without an explicit + prefix', () => {
    assert.equal(normalizePhoneNumber('919876543210'), null);
    assert.equal(normalizeIndianSmsDestination('919876543210'), null);
    assert.equal(normalizeIndianSmsDestination('9876543210'), null);
});

test('recognizes international destinations but never permits them for SMS', () => {
    for (const destination of ['+93701234567', '+37477123456', '+244923123456', '+994501234567']) {
        assert.ok(normalizePhoneNumber(destination), `${destination} should parse as an E.164 number`);
        assert.equal(normalizeIndianSmsDestination(destination), null);
    }
});

test('the shared AWS SMS sender rejects a direct international invocation before any AWS request', async () => {
    await assert.rejects(
        sendMessage({ to: '+994501234567', sms: 'test', templateId: 'test' }),
        { code: 'SMS_DESTINATION_NOT_ALLOWED' }
    );
});

test('a repeated request for the same destination is blocked by the persistent resend cooldown', async () => {
    const original = {
        create: OtpRateLimit.create,
        findById: OtpRateLimit.findById,
        findOneAndUpdate: OtpRateLimit.findOneAndUpdate,
    };
    const documents = new Map();

    OtpRateLimit.findOneAndUpdate = async (filter, update) => {
        const document = documents.get(filter._id);
        if (!document || !filter.lastRequestedAt) return null;
        if (document.lastRequestedAt <= filter.lastRequestedAt.$lte) {
            Object.assign(document, update.$set);
            return document;
        }
        return null;
    };
    OtpRateLimit.findById = async (key) => documents.get(key) || null;
    OtpRateLimit.create = async (document) => {
        documents.set(document._id, document);
        return document;
    };

    try {
        await enforceOtpRequestLimits({ destination: '+919876543210', ip: '127.0.0.1', deviceId: 'device-1' });
        await assert.rejects(
            enforceOtpRequestLimits({ destination: '+919876543210', ip: '127.0.0.1', deviceId: 'device-1' }),
            (error) => error.statusCode === 429 && /Please wait \d+ seconds/.test(error.message)
        );
    } finally {
        Object.assign(OtpRateLimit, original);
    }
});

test('public OTP routes are independent of OTP_API_TOKEN', () => {
    const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'user.js'), 'utf8');
    assert.match(routes, /router\.get\('\/getCountryCodesAndFlags', userController\.getCountryCodesAndFlags\)/);
    assert.doesNotMatch(routes, /router\.get\('\/getCountryCodesAndFlags', getOtpAuth/);
    assert.match(routes, /router\.post\('\/requestOtp', userController\.requestOtp\)/);
    assert.match(routes, /router\.post\('\/verifyOtp', userController\.verifyOtp\)/);
    assert.doesNotMatch(routes, /router\.post\('\/requestOtp', getOtpAuth/);
    assert.doesNotMatch(routes, /router\.post\('\/verifyOtp', getOtpAuth/);
});

test('uses the fixed OTP for the designated mobile while keeping SMS content tied to the OTP', () => {
    const controller = fs.readFileSync(path.join(__dirname, '..', 'controller', 'user.js'), 'utf8');
    assert.match(controller, /const mobileOtp = req\.body\.mobile === '\+917709665633' \? '0756' : universal\.generateRandom\(4, false\);/);
    assert.match(controller, /sms: `\$\{mobileOtp\} is your OTP for Companion AstroDating Apps`/);
});
