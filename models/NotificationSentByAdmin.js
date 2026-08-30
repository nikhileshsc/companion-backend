const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const Schema = mongoose.Schema;

const notificationSendByAdminSchema = new Schema({  
    notificationNo: {
        type: String,
        required: false
    },
    userType: {
        type: String,
        required: false
    },
    notificationType: {
        type: String,
        required: false
    },
    title: {
        type: String,
        required: false
    },
    body: {
        type: String,
        required: false
    },
    isGlobal: {
        type: Boolean,
        required: false,
        default: false
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'modelPath',
        required: false
    },
    modelPath: {
        type: String,
        enum: ['users', 'astrologers']
    },
    isActive: {
        type: Boolean,
        required: false,  
        default: true
    },
    imageUrl: {
        type: String,
        required: false,
        default: ''
    }
},
    { timestamps: true }
);
const NotificationSentByAdmin = mongoose.model("notificationssentbyadmin", notificationSendByAdminSchema, 'notificationssentbyadmin');
function validateSendPushNotificationByType(data) {
    const schema = Joi.object({
        title: Joi.string().allow(""),
        body: Joi.string().required(),
        notificationType: Joi.string().allow(""),
        imageUrl: Joi.string().uri().allow("")
    })
    return { error } = schema.validate(data);
}
module.exports.NotificationSentByAdmin = NotificationSentByAdmin;
module.exports.validateSendPushNotificationByType = validateSendPushNotificationByType;