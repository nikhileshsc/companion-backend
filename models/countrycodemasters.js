const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const Schema = mongoose.Schema;
const countryCodeMasterSchema = new Schema({
    country: {
        type: String,
        required: false
    },
    iso: {
        type: String,
        required: false,
        default: 0
    },
    phone: {
        type: String,
        required: false,
        default: 0
    },
    iconUrl: {
        type: String,
        required: false,
        default: ''
    }

}, { timestamps: true });

const countryCodeMaster = mongoose.model('countrycodemasters', countryCodeMasterSchema, 'countrycodemasters');

module.exports.countryCodeMaster = countryCodeMaster;