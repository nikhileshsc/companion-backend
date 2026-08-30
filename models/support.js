const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const Schema = mongoose.Schema;
const timelineActionsSchema = new Schema({
    status: {
        type: String,
        required: true
    },
    comment: {
        type: String,
        required: false
    }
},
    { timestamps: true }
);
const supportSchema = new Schema({
    ticketId: {
        type: String,
        required: false
    },
    problemType: {
        type: String,
        required: false
    },
    description: {
        type: String,
        required: false
    },
    attachment: {
        type: String,
        required: false,
        default: ""
    },
    status: {
        type: String,
        required: false,
        default: 'Pending'
    },
    // user: {
    //     type: mongoose.Types.ObjectId,
    //     ref: 'users'
    // },
    // astrologer: {
    //     type: mongoose.Types.ObjectId,
    //     ref: 'astrologers'
    // },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'userType'
    },
    userType: {
        type: String,
        enum: ['users', 'astrologers']
    },
    timeLineActions: {
        type: [timelineActionsSchema],
        required: false,
        default: []
    },
    
},{ timestamps: true });

const Support = mongoose.model("supportticket", supportSchema, 'supportticket');
function validateCreateNewTicket(data) {
    const schema = Joi.object({
        problemType: Joi.string().required(),
        description: Joi.string().required().allow(""),
        reason: Joi.string().allow(""),
        attachment: Joi.string().uri().allow("")
    })
    return { error } = schema.validate(data);
}
module.exports.Support = Support;
module.exports.validateCreateNewTicket = validateCreateNewTicket;