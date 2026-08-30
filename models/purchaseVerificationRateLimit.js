const mongoose = require('mongoose');

const PurchaseVerificationRateLimitSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

const PurchaseVerificationRateLimit = mongoose.model('purchaseverificationratelimit', PurchaseVerificationRateLimitSchema, 'purchaseverificationratelimit');

async function enforcePurchaseVerificationRateLimit(userId) {
    const now = new Date();
    const bucket = Math.floor(now.getTime() / 60_000);
    const record = await PurchaseVerificationRateLimit.findByIdAndUpdate(
        `${userId}:${bucket}`,
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + 2 * 60_000) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (record.count > 10) {
        const error = new Error('Too many purchase verification attempts. Please try again shortly.');
        error.statusCode = 429;
        throw error;
    }
}

module.exports = { enforcePurchaseVerificationRateLimit };
