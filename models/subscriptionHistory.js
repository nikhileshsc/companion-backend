const mongoose = require('mongoose')
const Schema = mongoose.Schema;
const SubscriptionActivityDatesSchema = new mongoose.Schema({
    updateOnDate: {
        type: Date,
        required: false
    },
    type: {
        type: String,
        required: false
    },
    subscribedPlan: {
        type: mongoose.Types.ObjectId,
        required: false,
        ref: 'planmaster',
    }
}, { timestamps: true });
const benefitsSchema = new Schema({
    matchMakingReport: {
        type: Number,
        required: false,
        default: 0,
    },
    chatProfiles: {
        type: Number,
        required: false,
        default: 0,
    },
})
const SubscriptionHistorySchema = new Schema({
    planName: {
        type: String,
        required: false,
    },
    duration: {
        type: String,
        required: false,
    },
    price: {
        type: Number,
        required: false,
        default: 0,
    },
    user: {
        type: mongoose.Types.ObjectId,
        required: false,
        ref: 'users'
    },
    subscriptionStatus: {
        type: String,
        required: false,
        default: 'Pending',
    },
    paymentStatus: {
        type: String,
        required: false,
        default: 'Pending',
    },
    planStartsOn: {
        type: Date,
        required: false,
        default: ""
    },
    planExpiredOn: {
        type: Date,
        required: false,
        default: ""
    },
    planDetails: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    activeSubscriptionId: {
        type: mongoose.Types.ObjectId,
        required: false,
        ref: 'subscriptions',
    },
    paymentGateway: { //paypal OR razorpay //promocode // offline (cheque)
        type: String,
        required: false
    },
    promoCode: {
        type: String,
        required: false
    },
    planPurchasedFrom: {
        type: String,
        required: false,
        default: '',
    },
    androidInAppPurchaseRes: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    iosInAppPurchaseRes: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    subscriptionActivityDates: {
        type: [SubscriptionActivityDatesSchema],
        required: false,
        default: []
    },
    appAccountToken: {
        type: String,
        required: false,
        default: ''
    },
    lastIosPurchasedSubscriptionId: {
        type: String,
        required: false,
        default: ''
    },
    lastIosPurchasedTransactionId: {
        type: String,
        required: false,
        default: ''
    },
    lastAndroidPurchasedSubscriptionId: {
        type: String,
        required: false,
        default: ''
    },
    lastAndroidPurchasedToken: {
        type: String,
        required: false,
        default: ''
    },
    subscribedPlan: {
        type: mongoose.Types.ObjectId,
        required: false,
        ref: 'planmaster',
    },
    benefits: {
        type: benefitsSchema,
        required: false
    },
    requestedAction: { type: String, required: false, default: 'newPurchase' },
    targetSubscriptionId: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'subscriptions' },
    verificationStatus: { type: String, required: false, default: 'Pending' },
    provider: { type: String, required: false },
    providerTransactionId: { type: String, required: false },
    providerOwnershipId: { type: String, required: false },
    providerEnvironment: { type: String, required: false },
    providerStatus: { type: String, required: false },
    providerAcknowledgementStatus: { type: String, required: false, default: '' },
}, {timestamps: true});

SubscriptionHistorySchema.index({ provider: 1, providerTransactionId: 1 }, { unique: true, sparse: true });
SubscriptionHistorySchema.index({ user: 1, verificationStatus: 1, createdAt: -1 });

const SubscriptionHistory = mongoose.model('subscriptionhistory', SubscriptionHistorySchema, 'subscriptionhistory')
module.exports.SubscriptionHistory = SubscriptionHistory;
