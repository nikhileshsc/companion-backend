const mongoose = require('mongoose');

const InAppPurchaseOwnershipSchema = new mongoose.Schema({
    provider: { type: String, required: true, enum: ['app_store', 'google_play'] },
    ownershipId: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'users' },
}, { timestamps: true });

InAppPurchaseOwnershipSchema.index({ provider: 1, ownershipId: 1 }, { unique: true });

module.exports.InAppPurchaseOwnership = mongoose.model('inapppurchaseownership', InAppPurchaseOwnershipSchema, 'inapppurchaseownership');
