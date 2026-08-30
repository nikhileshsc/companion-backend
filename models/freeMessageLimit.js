const mongoose = require('mongoose')

const messageLimitSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    receiverId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    count: { type: Number, default: 1 },
    // lastSeenAt: { type: Date, default: Date.now }
});

messageLimitSchema.index({ senderId: 1, receiverId: 1 }, { unique: true});

module.exports = mongoose.model('MessageLimit', messageLimitSchema);