const crypto = require('crypto');
const mongoose = require('mongoose');

const otpRateLimitSchema = new mongoose.Schema({
    _id: { type: String },
    count: { type: Number, default: 0 },
    lastRequestedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

const OtpRateLimit = mongoose.model('otp_rate_limits', otpRateLimitSchema, 'otp_rate_limits');

const WINDOW_MS = 15 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;

function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

async function enforceCooldown(destination, now) {
    const key = `cooldown:${hash(destination)}`;
    const cutoff = new Date(now.getTime() - COOLDOWN_MS);
    const update = { $set: { lastRequestedAt: now, expiresAt: new Date(now.getTime() + WINDOW_MS) } };
    const existing = await OtpRateLimit.findOneAndUpdate(
        { _id: key, lastRequestedAt: { $lte: cutoff } },
        update,
        { new: true }
    );
    if (existing) return;

    const current = await OtpRateLimit.findById(key);
    if (current) {
        const retryAfterSeconds = Math.max(1, Math.ceil((COOLDOWN_MS - (now - current.lastRequestedAt)) / 1000));
        const error = new Error(`Please wait ${retryAfterSeconds} seconds before requesting another OTP.`);
        error.statusCode = 429;
        error.retryAfterSeconds = retryAfterSeconds;
        throw error;
    }

    try {
        await OtpRateLimit.create({ _id: key, count: 0, lastRequestedAt: now, expiresAt: new Date(now.getTime() + WINDOW_MS) });
    } catch (error) {
        if (error && error.code === 11000) {
            const rateLimitError = new Error(`Please wait ${COOLDOWN_MS / 1000} seconds before requesting another OTP.`);
            rateLimitError.statusCode = 429;
            rateLimitError.retryAfterSeconds = COOLDOWN_MS / 1000;
            throw rateLimitError;
        }
        throw error;
    }
}

async function enforceWindowLimit(scope, identifier, maxRequests, now) {
    if (!identifier) return;
    const bucket = Math.floor(now.getTime() / WINDOW_MS);
    const key = `${scope}:${hash(identifier)}:${bucket}`;
    const previous = await OtpRateLimit.findOneAndUpdate(
        { _id: key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + (2 * WINDOW_MS)) } },
        { new: false, upsert: true, setDefaultsOnInsert: true }
    );
    if (!previous || previous.count < maxRequests) return;

    const error = new Error(`Too many OTP requests. Please try again in ${Math.ceil(WINDOW_MS / 60000)} minutes.`);
    error.statusCode = 429;
    error.retryAfterSeconds = Math.ceil(WINDOW_MS / 1000);
    throw error;
}

async function enforceOtpRequestLimits({ destination, ip, deviceId }) {
    const now = new Date();
    await enforceCooldown(destination, now);
    await enforceWindowLimit('destination', destination, 3, now);
    await enforceWindowLimit('ip', ip, 10, now);
    await enforceWindowLimit('device', deviceId, 5, now);
}

module.exports = { enforceOtpRequestLimits, OtpRateLimit };
