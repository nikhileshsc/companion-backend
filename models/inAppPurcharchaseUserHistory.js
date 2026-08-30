const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const Schema = mongoose.Schema;
const InAppTransactionUserHistoryMasterSchema = new Schema({
    iOsSubscriptionIds: {
        type: [String],
        required: false,
        default: [],
    },
    appToken: {
        type: String,
        required: false,
        default: ''
    },
    originalTransactionIds: {
        type: [String],
        required: false,
        default: [],
    },
    iosGroupId: {
        type: Number,
        required: false,
        default: -1,
    },
    androidSubscriptionIds: {
        type: [String],
        required: false,
        default: [],
    },
    androidPurchaseTokens: {
        type: [String],
        required: false,
    },
    androidGroupId: {
        type: Number,
        required: false,
        default: -1,
    },
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'allusers',
        required: false,
    }
    
},{ timestamps: true });
const InAppTransactionUserHistoryMaster = mongoose.model("inapptransactionhistorymaster", InAppTransactionUserHistoryMasterSchema, 'inapptransactionhistorymaster');
module.exports.InAppTransactionUserHistoryMaster = InAppTransactionUserHistoryMaster;