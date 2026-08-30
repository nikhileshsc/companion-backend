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
const SubscriptionSchema = new Schema({
    planName: {
        type: String,
        required: false,
    },
    duration: {
        type: String,
        required: false,
    },
    user: {
        type: mongoose.Types.ObjectId,
        required: false,
        ref: 'users',
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
    price: {
        type: Number,
        required: false,
        default: 0,
    },
    paymentGateway: { //paypal OR razorpay //promocode // offline (cheque)
        type: String,
        required: false
    },
    promoCode: {
        type: String,
        required: false
    },
    activeSubscriptionTransaction: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: 'subscriptionhistory'
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
    subscribedPlan: {
        type: mongoose.Types.ObjectId,
        required: false,
        default: 'planmaster',
    },
    subscriptionStartedOn: {
        type: Date,
        required: false,
    },
    benefits: {
        type: benefitsSchema,
        required: false,
        default: {},
    },
    provider: { type: String, required: false },
    providerTransactionId: { type: String, required: false },
    providerOwnershipId: { type: String, required: false },
    providerEnvironment: { type: String, required: false },
    providerStatus: { type: String, required: false },
    providerAcknowledgementStatus: { type: String, required: false, default: '' },
}, {timestamps: true})

const Subscriptions = mongoose.model('subscriptions', SubscriptionSchema, 'subscriptions')
module.exports.Subscriptions = Subscriptions;
