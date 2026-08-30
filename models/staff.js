const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const Schema = mongoose.Schema;
const staffSchema = new Schema({
    firstName: {
        type: String,
        required: false,
        default: ''
    },
    lastName: {
        type: String,
        required: false,
        default: ''
    },
    email: {
        type: String,
        required: false,
        default: ''
    },
    password: {
        type: String,
        required: false,
        default: ''
    },
    
    profileUrl: {
        type: String,
        required: false,
        default: ""
    },
    role: {
        type: [String],
        required: true
    },
    loginTime: {
        type: Date,
        required: false
    },
    isActive: {
        type: Boolean,
        required: false,
        default: true
    },
    loginToken: {
        token: {  //jwt-token
            type: String,
            default: ""
        },
        deviceType: {
            type: String,
            required: false,
            default: "",
        }, // ios | android
        deviceToken: {
            type: String,
            default: ""
        }, // FCM  | APN
        arn: { // arn used for aws-push-notification
            type: String,
            required: false,
        },
        createdAt: {
            type: Date,
            default: new Date()
        }
    },
},
    { timestamps: true }
);
const Staff = mongoose.model("staffs", staffSchema, 'staffs');
module.exports.Staff = Staff;