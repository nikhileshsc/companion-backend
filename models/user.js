const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const _ = require('lodash')
const Schema = mongoose.Schema;
const gallerySchema = new Schema({
    galleryUrl: {
        type: String,
        required: false,
    },
    status: {
        type: String,
        required: false,
        default: 'In Review'
    },
    isActionTaken: {
        type: Boolean,
        required: false,
        default: false
    }
},
    { timestamps: true }
);
const kycDocumentSchema = new Schema({
    documentUrl: {
        type: String,
        required: false,
    },
    documentKey: {
        type: String,
        required: false
    },
    status: {
        type: String,
        required: false,
        default: 'Pending'
    },
},
    { timestamps: true }
);
const UserSchema = new Schema({
    userId: {
        type: String,
        required: false,
    },
    userIdSeries: {
        type: Number,
        required: false,
    },
    fullName: {
        type: String,
        required: false,
        default: '',
    },
    profileUrl: {
        type: String,
        required: false,
        default: ''
    },
    gallery: {
        type: [gallerySchema],
        require: false,
        default: []
    },
    maxGalleryCount: {
        type: Number,
        required: false,
        default: 10,
    },
    gender: {
        type: String,
        required: false,  
    },
    birthDate: {
        type: Date,
        required: false,
    },
    zodiacSignInEng: {
        type: String,
        required: false,
        default: '',
    },
    zodiacSignInMarathi: {
        type: String,
        required: false,
        default: '',
    },
    zodiacPngUrl: {
        type: String,
        required: false,
        default: '',
    },
    zodiacSvgUrl: {
        type: String,
        required: false,
        default: '',
    },
    timeOfBirth: {
        type: String,
        required: false,
    },
    cityOfBirth: {
        type: String,
        required: false,
        default: '',
    },
    latitudeOfCityOfBirth: {
        type: String,
        required: false,
    },
    longitudeOfCityOfBirth: {
        type: String,
        required: false,
    },
    community: {
        type: String,
        required: false,
    },
    currentCity: {
        type: String,
        required: false,
    },
    latitudeOfCurrentCity: {
        type: String,
        required: false,
    },
    longitudeOfCurrentCity: {
        type: String,
        required: false,
    },
    mobile: {
        type: String,
        required: false,
        default: '',
    },
    countryCode: {
        type: String,
        required: false,
        default: '',
    },
    email: {
        type: String,
        required: false,
        default: '',
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
        voipToken: {
            type: String,
            default: ""
        },
        arn: { // arn used for aws-push-notification
            type: String,
            required: false,
        },
        isSandboxmode: {
            type: Boolean,
            required: false,
        },
        createdAt: {
            type: Date,
            default: new Date()
        }
    },
    isRegistrationCompleted: {
        type: Boolean,
        required: false,
        default: false,
    },
    role: {
        type: [String],
        required: false,
        default: [],
    },
    otp: {
        type: String,
        required: false,
        default: '',
    },
    otpDeliveryMethod: {
        type: String,
        enum: ['email', 'mobile'],
        required: false,
    },
    otpRequestedAt: {
        type: Date,
        required: false,
    },
    agoraChatUid: {
        type: String,
        required: false,
        default: ''
    },
    age: {
        type: Number,
        required: false,
        default: 0,
    },
    isVerifiedAccount: {
        type: Boolean,
        required: false,
        default: false,
    },
    agoraChatLoginDetails: {
        userName: {
            type: String,
            require: false,
            default: ''
        },
        chatToken: {
            type: String,
            required: false,
            default: ''
        }
    },
    aboutYourself: {
        type: String,
        required: false,
        default: ''
    },
    interest : {
        type: String,
        required: false,
        default: ''
    },
    expectations: {
        type: String,
        required: false,
        default: ''
    },
    status: {
        type: String,
        required: false,
        default: ''
    },
    lookingFor: {
        type: String,
        required: false,
        default: ''
    },
    height: {
        type: Number,
        required: false,
        default: 0
    },
    religion: {
        type: String,
        required: false,
        default: ''
    },
    profession: {
        type: String,
        required: false,
        default: ''
    },
    education: {
        type: String,
        required: false,
        default: ''
    },
    unlockChatUsers: {
        type: [mongoose.Types.ObjectId],
        ref: 'users',
        required: false,
        default: [],
    },
    shortListedUsers: {
        type: [mongoose.Types.ObjectId],
        ref: 'users',
        required: false,
        default: []
    },
    sentInterestUsers: {
        type: [mongoose.Types.ObjectId],
        ref: 'users',
        required: false,
        default: []
    },
    receivedInterestUsers: {
        type: [mongoose.Types.ObjectId],
        ref: 'users',
        required: false,
        default: []
    },
    declinedUserInterests: {
        type: [mongoose.Types.ObjectId],
        ref: 'users',
        required: false,
        default: []
    },
    blockedUsers: {
        type: [mongoose.Types.ObjectId],
        ref: 'users',
        required: false,
        default: []
    },
    isLead: {
        type: Boolean,
        required: false,
        default: true,
    },
    // kyc documents object
    aadharCardDetails: {
        front: {
            type: kycDocumentSchema,
            default: null
        },
        back: {
            type: kycDocumentSchema,
            default: null
        },
        combineStatus: {
            type: String,
            required: false,
            default: 'Pending'
        },
    },
    panCardDetails: {
        front: {
            type: kycDocumentSchema,
            default: null
        },
        combineStatus: {
            type: String,
            required: false,
            default: 'Pending'
        },
    },
    drivingLicense: {
        front: {
            type: kycDocumentSchema,
            default: null
        },
        combineStatus: {
            type: String,
            required: false,
            default: 'Pending'
        },
    },
    subscriptionId: {
        type: mongoose.Types.ObjectId,
        required: false,
        ref: 'subscriptions',
    },
    country: {
        type: String,
        required: false,
    },
    subscriptionStatus: {
        type: String,
        require: false,
    },
    isGallarySentForApproval: {
        type: Boolean,
        required: false,
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],   // ensures it’s a valid GeoJSON Point
            default: 'Point'
        },
        coordinates: {
            type: [Number],    // an array: [longitude, latitude]
            required: true,
            default: [0, 0]
        }
    },
    lastSeenAt: {
        type: Date,
        default: null,
    },
    lastProfilePhotoReminder: {
        type: Date,
        default: null,
    },
    needsUpdateProfile: {
        type: Boolean,
        required: true,
        default: true,
    },

},
{ timestamps: true }
);
const User = mongoose.model("users", UserSchema, 'users');


function validateRequestOtp(data) {
    let typeObject = _.pick(data, ['type'])
    let typeSchema = Joi.object({
        type: Joi.string().required().valid('email', 'mobile')
    })
    let schema = {}
    var {error} = typeSchema.validate(typeObject);
    if(error){
        return {error} = typeSchema.validate(typeObject);
    }else if(data.type === 'mobile'){
        schema = Joi.object({
            type: Joi.string().required().valid('email', 'mobile'),
            email: Joi.string().allow(""),
            countryCode: Joi.string().required(),
            mobile: Joi.string().required(),
            country: Joi.string().allow(""),
        })
    }else{
        schema = Joi.object({
            type: Joi.string().required().valid('email', 'mobile'),
            email: Joi.string().email().trim().lowercase().required().messages({'string.email': `Please enter a valid email address.`}),
            countryCode: Joi.string().allow(""),
            mobile: Joi.string().allow(""),
            country: Joi.string().allow(""),
        })
    }
    return { error } = schema.validate(data);
}

function validateVerifyOtpBody(data) {
    let typeObject = _.pick(data, ['type'])
    let typeSchema = Joi.object({
        type: Joi.string().required().valid('email', 'mobile')
    })
    let schema = {}
    var {error} = typeSchema.validate(typeObject);
    if(error){
        return {error} = typeSchema.validate(typeObject);
    }else if(data.type === 'mobile'){
        schema = Joi.object({
            type: Joi.string().required().valid('email', 'mobile'),
            email: Joi.string().allow(""),
            countryCode: Joi.string().required(),
            mobile: Joi.string().required(),
            otp: Joi.string().required(),
            deviceType: Joi.string().required().valid("android", "ios", "web", 'android watch'),
            deviceToken: Joi.string().required().allow(""),
            isSandboxmode: Joi.boolean(),
        })
    }else{
        schema = Joi.object({
            type: Joi.string().required().valid('email', 'mobile'),
            email: Joi.string().email().trim().lowercase().required().messages({'string.email': `Please enter a valid email address.`}),
            countryCode: Joi.string().allow(""),
            mobile: Joi.string().allow(""),
            otp: Joi.string().required(),
            deviceType: Joi.string().required().valid("android", "ios", "web", 'android watch'),
            deviceToken: Joi.string().required().allow(""),
            isSandboxmode: Joi.boolean(),
        })
    }
    return { error } = schema.validate(data);
}

function validateAddUpdateMandatorDetails(data) {
    
    const schema = Joi.object({
        userid: Joi.objectId().allow(""),
        fullName: Joi.string().required(),
        gender: Joi.string().required().valid('Male', 'Female', 'Other'),
        birthDate: Joi.string().required(),
        timeOfBirth: Joi.string().required(),
        cityOfBirth: Joi.string().required(),
        latitudeOfCityOfBirth: Joi.string(),
        longitudeOfCityOfBirth: Joi.string(),
        cityOfBirth: Joi.string(),
        community: Joi.string().required(),
        currentCity: Joi.string().required(),
        latitudeOfCurrentCity: Joi.string(),
        longitudeOfCurrentCity: Joi.string(),
        age: Joi.number().required()
    })
    return { error } = schema.validate(data);
}
function validateUpdateAboutDetails(data) {
    
    const schema = Joi.object({
        userid: Joi.objectId().allow(""),
        aboutYourself: Joi.string().allow(""),
        interest: Joi.string().allow(""),
        expectations: Joi.string().allow(""),
        needsUpdateProfile: Joi.boolean()
    }).or('aboutYourself', 'interest', 'expectations', 'needsUpdateProfile')
    return { error } = schema.validate(data);
}
function validateUpdateBasicDetails(data) {
    const schema = Joi.object({
        userid: Joi.objectId().allow(""),
        status: Joi.string().allow(""),
        lookingFor: Joi.string().allow(""),
        height: Joi.number().allow(0),
        religion: Joi.string().allow(""),
        community: Joi.string().allow(""),
        currentCity: Joi.string().allow(""),
        latitudeOfCurrentCity: Joi.string(),
        longitudeOfCurrentCity: Joi.string(),
        profession: Joi.string().allow(""),
        education: Joi.string().allow(""),
    }).or('status', 'lookingFor', 'height', 'religion', 'community', 'currentCity', 'profession', 'education')
    return { error } = schema.validate(data);
}
function validateUpdateInyerestByType(data) {
    const schema = Joi.object({
        type: Joi.string().required().valid('shortlist', 'unshortlist', "sendInterest", 'unsendInterest', 'block', 'unblock', 'declineInterest'),
        userId: Joi.objectId().required()
    })
    return { error } = schema.validate(data);
}
function validateGetInyerestByType(data) {
    const schema = Joi.object({
        type: Joi.string().required().valid('shortlist', "sendInterest", 'block', 'declineInterest', 'receivedInterest'),
    })
    return { error } = schema.validate(data);
}
function validateGetNotificationsBody(data) {
    const schema = Joi.object({
        pageNumber: Joi.number().required(),
        perPage: Joi.number().required(),

    })
    return { error } = schema.validate(data);
}
function validateGetHomeUsersBody(data) {
    try {
        console.log(JSON.parse(JSON.stringify(data)))
        const schema = Joi.object({
            pageNumber: Joi.number().required(),
            perPage: Joi.number().required(),
            searchText: Joi.string().allow(""),
            city: Joi.array().items(Joi.string()),
            minHeight: Joi.number(),
            //.when('maxHeight', {is: Joi.exist(), then: Joi.required(), otherwise: Joi.optional()}),
            maxHeight: Joi.number().when("minHeight", {
                is: Joi.exist(),
                then: Joi.required(),
                otherwise: Joi.optional()
             }),
            minAge: Joi.number(),
            maxAge: Joi.number().when("minAge", {
                is: Joi.exist(),
                then: Joi.required()
            }),
            profession: Joi.array().items(Joi.string().optional()),
            religion: Joi.array().items(Joi.string().optional()),
            status: Joi.array().items(Joi.string().optional()),
            education: Joi.array().items(Joi.string().optional()),
            community: Joi.array().items(Joi.string().optional()),
            country: Joi.array().items(Joi.string().optional()),
        })
        return { error } = schema.validate(data);
    } catch (error) {
        console.log('error ')
        return {error}
    }
    
    
}

function validateUploadFileByTypeBody(data) {
    const schema = Joi.object({
        fileType: Joi.string().required().valid('gallery'),
        userId: Joi.objectId(),
    })
    return { error } = schema.validate(data);
}

function validateUploadKycDocumentsByTypeBody(data) {
    const schema = Joi.object({
        fileType: Joi.string().required().valid('frontSideAadharCard', 'backSideAadharCard', 'frontSidePanCard', 'frontSideDrivingLicense')
    })
    return { error } = schema.validate(data);
}
function validateSetProfileFromGallerBody(data) {
    const schema = Joi.object({
        galleryId: Joi.objectId().required(),
        userId: Joi.objectId(),
    })
    return { error } = schema.validate(data);
}
function validateGetUserDetailsById(data) {
    const schema = Joi.object({
        userId: Joi.objectId().required(),
    })
    return { error } = schema.validate(data);
}
function validateApproveGalleryImageByIdBody(data) {
    const schema = Joi.object({
        userId: Joi.objectId().required(),
        galleryId: Joi.objectId().required(),
        status: Joi.string().valid('Approved', 'Rejected', 'In Review').required()
        
    })
    return { error } = schema.validate(data);
}

function validateCreateInAppSubscriptionBody(data) {
    const schema = Joi.object({
        subscribedPlan: Joi.objectId().required(),
        promoCode: Joi.string().max(128).allow('').default(''),
        promocodeDiscount: Joi.number().min(0).default(0),
        planPurchasedFrom: Joi.string().required().valid('android', 'ios'),
        type: Joi.string().required().valid('newPurchase', 'upgrade', 'drowngrade', 'downgrade', 'resubscribe'),
        subscriptionId: Joi.alternatives().conditional('type', { is: 'newPurchase', then: Joi.string().allow('').default(''), otherwise: Joi.objectId().required() }),
    }).unknown(false);
    return schema.validate(data);
}
function validateVerifyInAppPurchaseSubscription(body) {
    const schema = Joi.object({
        // Android restores may not have a locally-created pending record. The
        // server derives the plan from Google Play in that case.
        subscribedPlan: Joi.objectId(),
        subscriptionId: Joi.objectId(),
        iosTransactionId: Joi.string().max(256),
        iosInAppPurchaseRes: Joi.string().max(32 * 1024).allow(''),
        iosInAppVerifyReceiptRes: Joi.string().max(32 * 1024).allow(''),
        androidInAppPurchaseRes: Joi.object({ purchaseToken: Joi.string().max(4096), purchaseObject: Joi.string().max(32 * 1024).allow('') }).unknown(false),
        purchaseToken: Joi.string().max(4096),
        productId: Joi.string().max(256),
        type: Joi.string().valid('newPurchase', 'upgrade', 'drowngrade', 'downgrade', 'resubscribe'),
    }).unknown(false);
    return schema.validate(body);
}
function validateUpdateBenefites(body) {
    const schema = Joi.object({
        benefit: Joi.string().valid('matchMakingReport', 'chatProfiles').required(),
        unlockChatUserId: Joi.string().required().allow(""),
    })
    return { error } = schema.validate(body);
}
function validateLoginDetails(data) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    })
    return { error } = schema.validate(data);
}
function validatesendNotiByType(data) {
    const schema = Joi.object({
        type: Joi.string().required().valid("sendInterest", 'declineInterest', 'delete-my-account', 'approve-photo', 'reject-photo'),
    })
    return { error } = schema.validate(data);
}
function validateGalleryPhotoById(data) {
    const schema = Joi.object({
        userId: Joi.objectId(),
    })
    return { error } = schema.validate(data);
}
function validateVerifyAccountsById(data) {
    const schema = Joi.object({
        userId: Joi.objectId().required(),
        isVerifiedAccount: Joi.boolean().required(),
    })
    return { error } = schema.validate(data);
}
function validateDeleteAccountsById(data) {
    const schema = Joi.object({
        userId: Joi.string().required(),
    })
    return { error } = schema.validate(data);
}
function validateAllUsersBody(data) {
    const schema = Joi.object({
        pageNumber: Joi.number().required(),
        perPage: Joi.number().required(),
        searchText: Joi.string().allow(""),
        userType: Joi.string().valid('All', 'verified', 'unverified').allow("").required()
    })
    return { error } = schema.validate(data);
}
module.exports.User = User;
module.exports.validateRequestOtp = validateRequestOtp;
module.exports.validateVerifyOtpBody = validateVerifyOtpBody;
module.exports.validateAddUpdateMandatorDetails = validateAddUpdateMandatorDetails;
module.exports.validateUpdateAboutDetails = validateUpdateAboutDetails;
module.exports.validateUpdateBasicDetails = validateUpdateBasicDetails;
module.exports.validateUpdateInyerestByType = validateUpdateInyerestByType;
module.exports.validateGetNotificationsBody = validateGetNotificationsBody;
module.exports.validateUploadFileByTypeBody = validateUploadFileByTypeBody;
module.exports.validateSetProfileFromGallerBody = validateSetProfileFromGallerBody;
module.exports.validateGetInyerestByType = validateGetInyerestByType;
module.exports.validateGetUserDetailsById = validateGetUserDetailsById;
module.exports.validateApproveGalleryImageByIdBody = validateApproveGalleryImageByIdBody;
module.exports.validateUploadKycDocumentsByTypeBody = validateUploadKycDocumentsByTypeBody;
module.exports.validateGetHomeUsersBody = validateGetHomeUsersBody;
module.exports.validateCreateInAppSubscriptionBody = validateCreateInAppSubscriptionBody;
module.exports.validateVerifyInAppPurchaseSubscription = validateVerifyInAppPurchaseSubscription;
module.exports.validateUpdateBenefites = validateUpdateBenefites;
module.exports.validateLoginDetails = validateLoginDetails;
module.exports.validatesendNotiByType = validatesendNotiByType;
module.exports.validateGalleryPhotoById = validateGalleryPhotoById;
module.exports.validateVerifyAccountsById = validateVerifyAccountsById;
module.exports.validateDeleteAccountsById = validateDeleteAccountsById;
module.exports.validateAllUsersBody = validateAllUsersBody;
