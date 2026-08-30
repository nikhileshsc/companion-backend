const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const Schema = mongoose.Schema;
const appMasterSchema = new Schema({
    type: {
        type: String,
        required: false
    },
    min: {
        type: Number,
        required: false,
        default: 0,
    },
    max: {
        type: Number,
        required: false,
        default: 0,
    },
    values: {
        type: [String],
        required: false
    },
    isActive: {
        type: Boolean,
        required: false,
        default: false,
    },
    whichKindOfData: {
        type: String,
        required: false,
    }

}, { timestamps: true });

const AppMaster = mongoose.model('appmaster', appMasterSchema, 'appmaster');

module.exports.AppMaster = AppMaster;