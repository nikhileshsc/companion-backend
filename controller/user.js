const { countryCodeMaster } = require('../models/countrycodemasters');
const Message = require('../utilities/message')
const { validateRequestOtp, User, validateVerifyOtpBody, validateAddUpdateMandatorDetails, validateUpdateAboutDetails, validateUpdateBasicDetails, validateUpdateInyerestByType, validateGetNotificationsBody, validateUploadFileByTypeBody, validateSetProfileFromGallerBody, validateGetInyerestByType, validateGetUserDetailsById, validateApproveGalleryImageByIdBody, validateUploadKycDocumentsByTypeBody, validateGetHomeUsersBody, validateCreateInAppSubscriptionBody, validateVerifyInAppPurchaseSubscription, validateUpdateBenefites, validateLoginDetails, validatesendNotiByType, validateGalleryPhotoById, validateVerifyAccountsById, validateDeleteAccountsById, validateAllUsersBody } = require('../models/user')
const universal = require('../utilities/universal');
const { registerChatUserWithMetaData, generateChatTokenByUserId, updateRegisterMetaData, generateMeetingToken } = require('../utilities/agora');
const { findZodiacSign } = require('../functions/findZodiac');
const { Support, validateCreateNewTicket } = require('../models/support')
const _ = require('lodash');
const { NotificationSentByAdmin, validateSendPushNotificationByType } = require('../models/NotificationSentByAdmin');
const publicFileUpload = require('../utilities/public-bucket-file-upload');
const { deleteFileFromS3, getKeyFromUrl, getSignedUrl } = require('../utilities/signed');
const singlePublicMediaUpload = publicFileUpload.single("file");
const privateFileUpload = require('../utilities/private-bucket-file-upload');
const { AppMaster } = require('../models/appMasters');
const singleAadharMediaUpload = privateFileUpload.single("file");
const { sendMessage } = require('../utilities/aws_sns_service');
const { normalizeEmail, normalizeIndianSmsDestination, normalizePhoneNumber, maskDestination } = require('../utilities/otpDestination');
const { enforceOtpRequestLimits } = require('../models/otpRateLimit');
const { PlanMaster } = require('../models/planMasterjs');
const { SubscriptionHistory } = require('../models/subscriptionHistory');
const { InAppTransactionUserHistoryMaster } = require('../models/inAppPurcharchaseUserHistory');
const { Subscriptions } = require('../models/subscription');
const { InAppPurchaseOwnership } = require('../models/inAppPurchaseOwnership');
const { enforcePurchaseVerificationRateLimit } = require('../models/purchaseVerificationRateLimit');
const { PurchaseVerificationError, acknowledgeGooglePurchase, googlePlanMatches, verifyInAppPurchase, maskIdentifier } = require('../utilities/inAppPurchase');
const emailService = require('../utilities/aws_ses')
const PushNotification = require('../utilities/push_notification')
const AWS = require('aws-sdk');
const { Staff } = require('../models/staff');
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose');
const message = require('../utilities/message');
const MessageLimit = require('../models/freeMessageLimit');
const Reports = require('../models/reportSchema')


// get country codes and flags
const getCountryCodesAndFlags = async (req, res) => {
    try {
        // validate req.body
        // const { error } = validateGetCountryCodesAndFlags(req.body);
        // if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        // const queryParams = { ...req.body };
        // let searchQuery = {}
        // if (queryParams.searchText) searchQuery.$or = [
        //     { "country": { "$regex": queryParams.searchText, '$options': 'i' } },
        //     { "iso": { "$regex": queryParams.searchText, '$options': 'i' } },
        //     { "phone": { "$regex": queryParams.searchText, '$options': 'i' } }
        // ]
        // console.log('searchQuery is ', searchQuery)
        let order = ["India", "United States(USA)", "United Kingdom", "Canada",]
        let firstFour = await countryCodeMaster.aggregate([
            {
                $match: { country: { $in: order } }
            },
            { $addFields: { "__order": { $indexOfArray: [order, "$country"] } } },
            { $sort: { "__order": 1 } },
            {
                $project: {
                    _id: 1, country: 1, iso: 1, phone: 1, iconUrl: 1

                }
            }
        ])
        let countryCodes = await countryCodeMaster.aggregate([
            {
                $match: {}
            },
            { $sort: { "country": 1 } },
            {
                $project: {
                    _id: 1, country: 1, iso: 1, phone: 1, iconUrl: 1

                }
            }
        ])
        countryCodes = firstFour.concat(countryCodes)
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: { countryCodes: countryCodes } });

    } catch (error) {
        console.error('country_codes_failed', { code: error.code || error.name });
        return res.status(503).json({ statusCode: 503, error: 'Service Unavailable', message: 'Country codes are temporarily unavailable.' });
    }
}
// request Otp
const requestOtp = async (req, res) => {
    try {
        const { error } = validateRequestOtp(req.body);
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });

        let user = null;
        let deliveryMethod = req.body.type;
        let deliveryDestination;
        let normalizedPhone;

        if (req.body.type === 'mobile') {
            normalizedPhone = normalizePhoneNumber(req.body.mobile);
            if (!normalizedPhone) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.invalidMobileNumber });

            req.body.mobile = normalizedPhone.e164;
            user = await User.findOne({ mobile: req.body.mobile }, 'mobile otp email countryCode role')

            const indianSmsDestination = normalizeIndianSmsDestination(req.body.mobile);
            if (indianSmsDestination) {
                deliveryMethod = 'mobile';
                deliveryDestination = indianSmsDestination;
                req.body.countryCode = '+91';
            } else {
                deliveryMethod = 'email';
                deliveryDestination = normalizeEmail(user && user.email) || normalizeEmail(req.body.email);
                if (!deliveryDestination) {
                    return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'A valid email address is required for OTP delivery outside India.' });
                }
                req.body.email = deliveryDestination;
                req.body.countryCode = `+${normalizedPhone.countryCallingCode}`;
            }
        } else {
            req.body.email = normalizeEmail(req.body.email);
            if (!req.body.email) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Please enter a valid email address.' });
            user = await User.findOne({ email: req.body.email }, 'mobile otp email countryCode role')
            deliveryDestination = req.body.email;
        }

        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        const deviceId = req.get('x-device-id') || req.body.deviceToken;
        try {
            await enforceOtpRequestLimits({ destination: deliveryDestination, ip: clientIp, deviceId });
        } catch (rateLimitError) {
            if (rateLimitError.statusCode === 429) {
                res.set('Retry-After', String(rateLimitError.retryAfterSeconds));
                return res.status(429).send({ statusCode: 429, error: 'Too Many Requests', message: rateLimitError.message });
            }
            throw rateLimitError;
        }

        if (!user) {
            user = new User({
                mobile: req.body.mobile,
                email: req.body.email,
                countryCode: req.body.countryCode,
                role: 'ROLE_USER'
            })
        } else if (deliveryMethod === 'email' && !normalizeEmail(user.email)) {
            user.email = deliveryDestination;
        }

        const mobileOtp = req.body.mobile === '+917709665633' ? '0756' : universal.generateRandom(4, false);
        user.otp = mobileOtp
        user.otpDeliveryMethod = deliveryMethod;
        user.otpRequestedAt = new Date();
        await user.save();

        if (deliveryMethod === 'mobile') {
            const messageData = await sendMessage({
                to: deliveryDestination,
                sms: `${mobileOtp} is your OTP for Companion AstroDating Apps`,
                templateId: '1207173738177354497'
            });
            if (messageData.err) {
                return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: 'Unable to send OTP. Please try again later.' });
            }
        }
        if (deliveryMethod === 'email') {
            let emailTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Email</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        .logo {
            margin-bottom: 20px;
        }
        h2 {
            color: #333;
            margin-bottom: 20px;
        }
        .otp-box {
            background-color: #fc427b;
            padding: 20px;
            border-radius: 8px;
            display: inline-block;
            margin-bottom: 20px;
        }
        .otp {
            font-size: 2em;
            font-weight: bold;
            color: #000;
            margin: 0;
        }
        .fine-text {
            font-size: 0.9em;
            color: #777;
            margin-bottom: 20px;
        }
        .unsubscribe {
            font-size: 0.9em;
            color: #007BFF;
            text-decoration: none;
        }
        .unsubscribe:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <img src='https://companion-public.s3.ap-south-1.amazonaws.com/static/logo-text.png' alt="Logo" style="max-width: 100px;">
            </div
        <h2>Your Astro Companion OTP is:</h2>
        <div class="otp-box">
            <p class="otp">${mobileOtp}</p>
        </div>
        <p class="fine-text">*Use the above 4 Digit OTP Code to login into the Astro Companion App</p>
        <a href="UNSUBSCRIBE_URL" class="unsubscribe"><u>Unsubscribe / Not My Account</u></a>
    </div>
</body>
</html>`
            let emailSubject = `Companion AstroDating Email OTP is ${mobileOtp}`
            console.info('otp_email_dispatch', { channel: 'email', destination: maskDestination(deliveryDestination) });
            await emailService.sendEmailWithTemplateInvoice(emailSubject, process.env.SENDER_EMAIL_ADDRESS, [], deliveryDestination, emailTemplate, [])
        }
        return res.status(201).send({ statusCode: 201, message: Message.otpSentOnMobileSuccess, data: { type: deliveryMethod } });
    } catch (error) {
        console.error('otp_request_failed', { code: error.code || error.name });
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: 'Unable to send OTP. Please try again later.' });


    }
};
// verify Otp
const verifyOtp = async (req, res, next) => {
    let payload = req.body;
    try {
        const { error } = validateVerifyOtpBody(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        // verify parent otp
        let startDate = new Date();
        let endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() - 5);
        let query = { $and: [{ otp: req.body.otp }, { otpRequestedAt: { $gte: endDate, $lte: startDate } }, { otpDeliveryMethod: req.body.type }], }
        if (req.body.type === 'mobile') {
            const mobile = normalizeIndianSmsDestination(req.body.mobile);
            if (!mobile) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.invalidMobileNumber });
            query['$and'].push({ mobile })
        } else {
            req.body.email = normalizeEmail(req.body.email)
            if (!req.body.email) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Please enter a valid email address.' });
            query['$and'].push({ email: req.body.email })
        }
        // Atomically claim the OTP: find the matching, unconsumed OTP and
        // immediately clear it in the same DB operation. This closes a race
        // where two rapid/duplicate verifyOtp calls (double-tap, client
        // retry) both matched the same still-valid OTP, each generated and
        // saved its own loginToken, and the second save silently overwrote
        // the first token — leaving the app holding a stale token that
        // immediately 401'd on every subsequent authenticated call.
        // With findOneAndUpdate, only the first request can match and clear
        // the OTP; a concurrent duplicate will find no matching document
        // (since otp is already cleared) and correctly get "Invalid OTP"
        // instead of silently minting a second, overwriting token.
        let user = await User.findOneAndUpdate(
            query,
            { $set: { otp: '', otpDeliveryMethod: null, otpRequestedAt: null } },
            { new: false, fields: 'needsUpdateProfile isRegistrationCompleted loginToken agoraChatUid agoraChatLoginDetails shortListedUsers sentInterestUsers receivedInterestUsers blockedUsers declinedUserInterests profileUrl userId userIdSeries isLead subscriptionId unlockChatUsers otp otpDeliveryMethod' }
        );
        //check otp valid or not
        if (!user) return res.status(400).json({ statusCode: 400, error: 'Bad Request', "message": Message.invalidOtp });


        // below function to get ARN from AWS for the deviceToken and store in DB
        // AWS.config.update({
        //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        //     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        //     region: process.env.AWS_REGION
        // });

        // let sns = new AWS.SNS();

        let aws_application_arn = '';
        //generate login token
        let loginToken = universal.generateToken({
            deviceType: req.body.deviceType,
            role: "ROLE_USER",//user role
            _id: user._id
        });

        user.loginToken.token = loginToken;
        //save device details for push notifications
        user.loginToken.deviceType = req.body.deviceType;
        user.loginToken.deviceToken = req.body.deviceToken;
        user.loginToken.isSandboxmode = req.body.isSandboxmode;
        user.otp = '';
        user.otpDeliveryMethod = undefined;
        user.otpRequestedAt = undefined;
        user.isLead = false
        if (!user.userId) {
            let lastUser = await User.findOne({ userId: { $exists: true }, userId: /CMP/i }, 'userId userIdSeries').sort({ userIdSeries: -1 })
            let sno = 1
            if (lastUser) {
                sno = lastUser.userIdSeries + 1
            }
            let prefix = 'CMP'
            if (String(sno).length < 5) {
                sno = '0'.repeat(5 - String(sno).length) + sno
            }
            user.userId = `${prefix}${sno}`
            user.userIdSeries = sno
        }
        let subscription = null
        if (user.subscriptionId) {
            subscription = await Subscriptions.findOne({ _id: user.subscriptionId }, 'benefits subscriptionStatus')
        }
        let chatData = {}
        AWS.config.update({
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            region: process.env.AWS_REGION
        });

        let sns = new AWS.SNS();
        // for agora chat registration
        if (!user.agoraChatUid) {
            chatData = await registerChatUserWithMetaData(user)
            user.agoraChatLoginDetails = {
                userName: user._id,
                chatToken: chatData.chatToken
            }
            user.agoraChatUid = chatData.agoraChatUid
        } else {
            user.agoraChatLoginDetails.chatToken = await generateChatTokenByUserId(String(user._id))
        }
        // if (req.body.deviceType === 'ios' && req.body.deviceToken && req.body.deviceToken.length > 10) {
        //     aws_application_arn = process.env.AWS_SNS_PUSH_IOS_PLATFORM_ARN_COMPANION
        //     if (req.body.isSandboxmode) {
        //         aws_application_arn = process.env.AWS_SNS_PUSH_IOS_PLATFORM_ARN_COMPANION_SANDBOX
        //     }
        //     const params = {
        //         PlatformApplicationArn: aws_application_arn, //  Platform(android/ios) Application ARN 
        //         Token: user.loginToken.deviceToken,
        //         Attributes: {} //optional
        //     }
        //     sns.createPlatformEndpoint(params, async function (err, data) {
        //         if (err) return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: err.message });
        //         //set arn
        //         user.loginToken.arn = data.EndpointArn;
        //         //save arn into DB
        //         // console.log("parent.loginToken.token ", parent.loginToken.token)
        //         user = await user.save();
        //         return res.status(200).send({ statusCode: 200, message: 'Login Successful.', data : { token: loginToken, user: _.pick(user, ['isRegistrationCompleted', 'token', 'agoraChatLoginDetails', 'shortListedUsers', 'sentInterestUsers', 'receivedInterestUsers', 'blockedUsers', 'declinedUserInterests', 'profileUrl'])}});

        //     });
        //     // return res.status(200).send({ statusCode: 200, message: 'Login Successful.', data : { token: loginToken, user: _.pick(user, ['isRegistrationCompleted', 'token', 'agoraChatLoginDetails', 'shortListedUsers', 'sentInterestUsers', 'receivedInterestUsers', 'blockedUsers', 'declinedUserInterests', 'profileUrl'])}});
        // }else{
        user = await user.save();
        return res.status(200).send({ statusCode: 200, message: 'Login Successful.', data: { token: loginToken, user: _.pick(user, ['needsUpdateProfile', 'isRegistrationCompleted', 'token', 'agoraChatLoginDetails', 'shortListedUsers', 'sentInterestUsers', 'receivedInterestUsers', 'blockedUsers', 'declinedUserInterests', 'profileUrl', 'unlockChatUsers']), subscription } });

        // }
        // }else{
        //     user = await user.save();
        //     return res.status(200).send({ statusCode: 200, message: 'Login Successful.', data : {token: loginToken, // country: user.country, 
        //         isRegistrationCompleted: user.isRegistrationCompleted}});


        // }


    } catch (error) {
        console.log('error ', error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// addUpdateMandatoryDetails
const addUpdateMandatoryDetails = async (req, res) => {
    try {

        // validate req.body
        const { error } = validateAddUpdateMandatorDetails(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let userId = req.user.id
        if (req.body.userid) {
            userId = req.body.userid
        }
        let user = await User.findOne({ _id: userId }, 'fullName gender birthDate timeOfBirth cityOfBirth latitudeOfCityOfBirth longitudeOfCityOfBirth community currentCity latitudeOfCurrentCity longitudeOfCurrentCity isRegistrationCompleted age zodiacSignInEng  zodiacSignInMarathi agoraChatUid profileUrl zodiacPngUrl zodiacSvgUrl')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound });
        }
        if (req.body.birthDate) {
            req.body.birthDate = new Date(req.body.birthDate)
            req.body.birthDate.setHours(0, 0, 0, 0)
            let zodiacData = findZodiacSign(req.body.birthDate.getMonth() + 1, req.body.birthDate.getDate())
            req.body.zodiacSignInEng = zodiacData.zodiacSignInEng
            req.body.zodiacSignInMarathi = zodiacData.zodiacSignInMarathi
            req.body.zodiacPngUrl = zodiacData.zodiacPngUrl
            req.body.zodiacSvgUrl = zodiacData.zodiacSvgUrl
        }
        for (key of Object.keys(req.body)) {
            user[key] = req.body[key]
        }
        if (user.agoraChatUid) {
            await updateRegisterMetaData(user)
        }
        user.isRegistrationCompleted = true
        user = await user.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });


    }
};
// getMandatoryDetails
const getMandatoryDetails = async (req, res) => {
    var payload = req.body
    try {
        let user = await User.findOne({ _id: req.user.id }, 'fullName gender birthDate timeOfBirth cityOfBirth latitudeOfCityOfBirth longitudeOfCityOfBirth community currentCity latitudeOfCurrentCity longitudeOfCurrentCity isRegistrationCompleted age profileUrl subscriptionId gallery')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.myTeam.userNotFound });
        }
        let community = await AppMaster.findOne({ type: 'community' }, 'values')
        if (!community) {
            community = []
        } else {
            community = community.values
        }
        let subscription = null
        if (user.subscriptionId) {
            subscription = await Subscriptions.findOne({ _id: user.subscriptionId }, 'benefits subscriptionStatus planStartsOn planExpiredOn planName duration')
        }
        let isPhotoUploaded = false
        for (let photo of user.gallery) {
            if (photo.status === 'In Review' || photo.status === 'Approved' || photo.status === 'Profile Photo') {
                isPhotoUploaded = true
                break
            }
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user, community: community, subscription, isPhotoUploaded } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });


    }
};
// getAboutDetails
const getAboutDetails = async (req, res) => {
    try {
        let user = await User.findOne({ _id: req.user.id }, 'aboutYourself interest expectations')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.myTeam.userNotFound });
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });


    }
};
// updateAboutDetails
const updateAboutDetails = async (req, res) => {
    try {

        // validate req.body
        const { error } = validateUpdateAboutDetails(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let userId = req.user.id
        if (req.body.userid) {
            userId = req.body.userid
        }
        let user = await User.findOne({ _id: userId }, 'aboutYourself interest expectations needsUpdateProfile')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.myTeam.userNotFound });
        }
        for (key of Object.keys(req.body)) {
            user[key] = req.body[key]
        }
        user = await user.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });


    }
};
// getBasicDetails
const getBasicDetails = async (req, res) => {
    try {
        let user = await User.findOne({ _id: req.user.id }, 'status lookingFor height religion community currentCity profession education')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.myTeam.userNotFound });
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// updateBasicDetails
const updateBasicDetails = async (req, res) => {
    try {

        // validate req.body
        const { error } = validateUpdateBasicDetails(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let userId = req.user.id
        if (req.body.userid) {
            userId = req.body.userid
        }
        let user = await User.findOne({ _id: userId }, 'status lookingFor height religion community currentCity profession educationm latitudeOfCurrentCity longitudeOfCurrentCity')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.myTeam.userNotFound });
        }
        for (key of Object.keys(req.body)) {
            user[key] = req.body[key]
        }
        user = await user.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
async function cretaeNotification(params) {
    console.log('cretaeNotification ', params)
    let notificationParams = {
        title: params.body,
        body: params.body,
        userType: 'users',
        notificationType: params.type,
        modelPath: 'users',
        user: params.user
    }
    let lastUser = await NotificationSentByAdmin.findOne({ notificationNo: { $exists: true } }, 'notificationNo').sort({ createdAt: -1 })
    let sno = 1
    if (lastUser) {
        lastUser = lastUser.notificationNo.split('PN')
        lastUser = Number(lastUser[1])
        sno = lastUser + 1
    } else {
        sno = 1
    }
    let prefix = 'PN'
    if (String(sno).length < 3) {
        sno = '0'.repeat(3 - String(sno).length) + sno
    }
    notificationParams.notificationNo = `${prefix}${sno}`
    await NotificationSentByAdmin.create(notificationParams)
}
// updateInterestsByType
const updateInterestsByType = async (req, res) => {
    try {

        // validate req.body
        const { error } = validateUpdateInyerestByType(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let user = await User.findOne({ _id: req.user.id }, 'shortListedUsers sentInterestUsers receivedInterestUsers blockedUsers declinedUserInterests fullName')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.myTeam.userNotFound });
        }
        let index = -1
        let otherUser = null
        if (req.body.userId) {
            otherUser = await User.findOne({ _id: req.body.userId }, 'loginToken')
        }
        let notificationParams = {
            title: 'You have recieved an Interest.',
            body: `${user.fullName} has sent you Interest on Companion.`,
            type: 'received-interest',
            showNotification: "true"
        }
        if (req.body.type === 'shortlist') {
            if (user.shortListedUsers.indexOf(req.body.userId) == -1) {
                user.shortListedUsers.push(req.body.userId)
            }
        } else if (req.body.type === 'unshortlist') {
            index = user.shortListedUsers.indexOf(req.body.userId)
            console.log('index ', index)
            if (index > -1) {
                user.shortListedUsers.splice(index, 1)
            }
        } else if (req.body.type === "sendInterest") {
            if (user.sentInterestUsers.indexOf(req.body.userId) == -1) {
                await User.updateOne({ _id: req.body.userId }, { $push: { receivedInterestUsers: req.user.id } })
                user.sentInterestUsers.push(req.body.userId)
                if (otherUser) {
                    notificationParams.user = String(otherUser._id)
                }
                await cretaeNotification(notificationParams)
                if (otherUser && otherUser.loginToken.deviceToken.length > 10) {
                    PushNotification.sendPushNotification(otherUser.loginToken, notificationParams.title, notificationParams.body, notificationParams)
                }
            }
        } else if (req.body.type === 'unsendInterest') {
            index = user.sentInterestUsers.indexOf(req.body.userId)
            console.log('index ', index)
            if (index > -1) {
                await User.updateOne({ _id: req.body.userId }, { $pull: { receivedInterestUsers: req.body.userId } })
                user.sentInterestUsers.splice(index, 1)
            }
        } else if (req.body.type === 'block') {
            if (user.blockedUsers.indexOf(req.body.userId) == -1) {
                user.blockedUsers.push(req.body.userId)
            }
        } else if (req.body.type === 'unblock') {
            index = user.blockedUsers.indexOf(req.body.userId)
            console.log('index ', index)
            if (index > -1) {
                user.blockedUsers.splice(index, 1)
            }
        } else if (req.body.type === 'declineInterest') {
            index = user.receivedInterestUsers.indexOf(req.body.userId)
            console.log('index ', index)
            if (index > -1) {
                user.receivedInterestUsers.splice(index, 1)
                user.declinedUserInterests.push(req.body.userId)
                notificationParams = {
                    title: 'Your interest has been declined.',
                    body: `${user.fullName} has Declined your Interest.`,
                    type: 'decline-interest',
                    showNotification: "true"
                }
                if (otherUser) {
                    notificationParams.user = String(otherUser._id)
                }
                await cretaeNotification(notificationParams)
                if (otherUser && otherUser.loginToken.deviceToken.length > 10) {
                    PushNotification.sendPushNotification(otherUser.loginToken, notificationParams.title, notificationParams.body, notificationParams)
                }
            }
        }
        user = await user.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// getInterestsByType
const getInterestsByType = async (req, res) => {
    try {

        // validate req.body
        const { error } = validateGetInyerestByType(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let user = await User.findOne({ _id: req.user.id }, 'shortListedUsers sentInterestUsers receivedInterestUsers blockedUsers declinedUserInterests')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.myTeam.userNotFound });
        }
        console.log('user ', user)
        let query = { _id: { $in: user.declinedUserInterests } }
        console.log('query ', query, 'req.query.type ', req.query.type)
        if (req.query.type === 'shortlist') {
            query = { _id: { $in: user.shortListedUsers } }
        } else if (req.query.type === "sendInterest") {
            query = { _id: { $in: user.sentInterestUsers } }
        } else if (req.query.type === 'block') {
            query = { _id: { $in: user.blockedUsers } }
        } else if (req.query.type === 'receivedInterest') {
            query = { _id: { $in: user.receivedInterestUsers } }
        }
        console.log('query ', query)
        let users = await User.find(query, 'fullName profileUrl age status height religion community profession education currentCity isVerifiedAccount zodiacSignInEng zodiacSignInMarathi zodiacPngUrl zodiacSvgUrl')
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { users } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
const createNewTicket = async (req, res) => {
    try {

        const { error } = validateCreateNewTicket(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        // generate uniq id
        let lastUser = await Support.findOne({ ticketId: { $exists: true } }, 'ticketId').sort({ createdAt: -1 })
        let sno = 1
        if (lastUser) {
            lastUser = lastUser.ticketId.split('ST_')
            lastUser = Number(lastUser[1])
            sno = lastUser + 1
        } else {
            sno = 1
        }
        let prefix = 'ST_'
        if (String(sno).length < 3) {
            sno = '0'.repeat(3 - String(sno).length) + sno
        }
        req.body.ticketId = `${prefix}${sno}`
        req.body.user = req.user.id
        req.body.userType = 'users'
        let notificationParams = {
            title: 'Your Support Request has been Recieved.',
            body: 'We have recieved your support request, we will keep you updated.',
            type: 'new-support-ticket',
            showNotification: "true"
        }
        let newTicket = await Support.create(req.body)
        let user = await User.findOne({ _id: req.user.id }, 'loginToken')
        if (req.body.problemType === 'Delete Account & Complete Data') {
            let title = 'Account & Data Deletion Request in Progress'
            let body = 'Your submission to delete your account and data will be processed within next 36 hours.'
            let type = 'general'
            let data = {}

            notificationParams = {
                title: 'Your Request to Delete Data Recieved.',
                body: 'Your request to delete data has been recieved, we will contact you within 24 hours.',
                type: 'delete-my-account',
                showNotification: "true"
            }
        }

        if (user && user.loginToken.deviceToken.length > 10) {
            PushNotification.sendPushNotification(user.loginToken, notificationParams.title, notificationParams.body, notificationParams)
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordAdded, data: { newTicket } });

    } catch (error) {
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
}
// getNotifications
const getNotifications = async (req, res, next) => {
    try {
        // validate req.body
        const { error } = validateGetNotificationsBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.query.pageNumber = Number(req.query.pageNumber)
        req.query.perPage = Number(req.query.perPage)
        let query = { isActive: true, userType: 'users', $or: [{ isGlobal: true }, { user: new mongoose.Types.ObjectId(req.user.id) }] }
        let totalCount = await NotificationSentByAdmin.countDocuments(query)
        let notifications = await NotificationSentByAdmin.find(query).sort({ createdAt: -1 }).limit(req.query.perPage).skip((req.query.perPage * req.query.pageNumber) - req.query.perPage)
        totalCount = Math.ceil(totalCount / req.query.perPage)

        return res.status(200).send({ statusCode: 200, data: { notifications: notifications, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (error) {
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// addAllNotifications
const addAllNotifications = async (req, res, next) => {
    try {
        let modelPath = 'users'
        let notifications = [
            {
                title: 'Please Update your app',
                body: 'Please Update your app',
                userType: 'users',
                notificationType: 'app-update',
                modelPath: 'users',
                user: '6729e083d82dba155c39877e'
            },
            {
                title: 'Your photo was approved.',
                body: 'Your photo was approved.',
                userType: 'users',
                notificationType: 'gallery',
                modelPath: 'users',
                user: '6729e083d82dba155c39877e'
            },
            {
                title: 'Your membership is upgraded.',
                body: 'Your membership is upgraded.',
                userType: 'users',
                notificationType: 'subscription',
                modelPath: 'users',
                user: '6729e083d82dba155c39877e'
            },
            {
                title: 'Servers will be down for maintence at 2am.',
                body: 'Servers will be down for maintence at 2am.',
                userType: 'users',
                notificationType: 'server',
                modelPath: 'users',
                user: '6729e083d82dba155c39877e'
            },
            {
                title: 'Your issue #137 is resolved.',
                body: 'Your issue #137 is resolved.',
                userType: 'users',
                notificationType: 'support',
                modelPath: 'users',
                user: '6729e083d82dba155c39877e'
            },
            {
                title: 'Sakshi sent you interest.',
                body: 'Sakshi sent you interest.',
                userType: 'users',
                notificationType: 'interest',
                modelPath: 'users',
                user: '6729e083d82dba155c39877e'
            },
        ]
        for (let user of notifications) {

            let notificationParams = {
                title: user.title,
                body: user.body,
                userType: user.userType,
                notificationType: user.type,
                modelPath: user.modelPath,
                user: user.user
            }
            let lastUser = await NotificationSentByAdmin.findOne({ notificationNo: { $exists: true } }, 'notificationNo').sort({ createdAt: -1 })
            let sno = 1
            if (lastUser) {
                lastUser = lastUser.notificationNo.split('PN')
                lastUser = Number(lastUser[1])
                sno = lastUser + 1
            } else {
                sno = 1
            }
            let prefix = 'PN'
            if (String(sno).length < 3) {
                sno = '0'.repeat(3 - String(sno).length) + sno
            }
            notificationParams.notificationNo = `${prefix}${sno}`
            await NotificationSentByAdmin.create(notificationParams)
        }
        return res.status(200).send({ statusCode: 200, message: Message.fileUpload, data: {} });
    } catch (error) {
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
}
// uploadFileByType
const uploadFileByType = async (req, res, next) => {
    try {
        const { error } = validateUploadFileByTypeBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message })
        }
        await singlePublicMediaUpload(req, res, async function (err) {
            if (err) {
                // if error in upload file return 422 with message
                console.log('err in controller ', err);
                return res.status(422).send({ statusCode: 422, error: 'Something went wrong', message: err.message });
            } else {
                if (!req.file) {
                    return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Please select a file.' })
                } else {
                    let userId = req.user.id
                    if (req.query.userId) {
                        userId = req.query.userId
                    }
                    let user = await User.findOne({ _id: userId }, 'gallery isGallarySentForApproval')
                    if (!user) {
                        return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound });
                    }
                    if (req.query.fileType === 'gallery') {
                        user.gallery.push({ galleryUrl: req.file.location, status: 'In Review' })
                        user.isGallarySentForApproval = true
                    }
                    await user.save()
                    return res.status(200).send({ statusCode: 200, message: Message.fileUpload, data: { url: req.file.location } });
                }
            }
        });
    } catch (e) {
        console.log('error in uploadFileByType', e)
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// getMyPhotos
const getMyPhotos = async (req, res) => {
    try {
        const { error } = validateGalleryPhotoById(req.query)
        if (error) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message })
        }
        let userId = req.user.id
        if (req.query.userId) {
            userId = req.query.userId
        }
        let user = await User.findOne({ _id: userId }, 'gallery maxGalleryCount')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound });
        }
        let isPhotoUploaded = false
        for (let photo of user.gallery) {
            if (photo.status === 'In Review' || photo.status === 'Approved' || photo.status === 'Profile Photo') {
                isPhotoUploaded = true
                break
            }
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user, isPhotoUploaded } });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// setProfileFromGallery
const setProfileFromGallery = async (req, res, next) => {
    try {
        const { error } = validateSetProfileFromGallerBody(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let user = await User.findOne({ _id: req.user.id, "gallery._id": req.body.galleryId }, 'profileUrl gallery agoraChatUid fullName')
        if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        let selectedImage = user.gallery.id(req.body.galleryId)
        if (selectedImage.status !== 'Approved') return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageIsNotApproved });
        let currentProfileGalleryIndex = _.findIndex(user.gallery, { status: 'Profile Photo' })
        console.log('currentProfileGalleryIndex ', currentProfileGalleryIndex)
        user.profileUrl = selectedImage.galleryUrl
        // selectedImage.status = 'Display Photo'
        selectedImage.status = 'Profile Photo'
        // unset other image from profile
        console.log('currentProfileGalleryIndex ', currentProfileGalleryIndex)
        if (currentProfileGalleryIndex > -1) {
            user.gallery[currentProfileGalleryIndex].status = 'Approved'
        }
        await user.save()
        if (user.agoraChatUid) {
            await updateRegisterMetaData(user)
        }
        return res.status(200).send({ statusCode: 200, message: Message.fileUpload, data: { user: user } });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// deletePhotoFromGallery
const deletePhotoFromGallery = async (req, res, next) => {
    try {
        const { error } = validateSetProfileFromGallerBody(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let userId = req.user.id
        if (req.body.userId) {
            userId = req.body.userId
        }
        let user = await User.findOne({ _id: userId, "gallery._id": req.body.galleryId }, 'profileUrl gallery isGallarySentForApproval')
        if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        let selectedImage = user.gallery.id(req.body.galleryId)
        if (!selectedImage) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        }
        if (selectedImage.status === 'Profile Photo') return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.canNotDeleteProfileImage });
        let key = getKeyFromUrl(selectedImage.galleryUrl)
        deleteFileFromS3(process.env.AWS_S3_PUBLIC_BUCKET, key)
        user.gallery.pull({ _id: req.body.galleryId })
        let pendingGalleyImage = _.find(user.gallery, { isActionTaken: false })
        console.log('pendingGalleyImage ', pendingGalleyImage)
        if (!pendingGalleyImage) {
            user.isGallarySentForApproval = false
        }
        await user.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordRemoved, data: { user: user } });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// getHomeUsers
const getHomeUsers = async (req, res, next) => {
    try {
        let payload = req.query
        const { error } = validateGetHomeUsersBody(req.query);
        console.log('error ', error)
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.query.pageNumber = Number(req.query.pageNumber)
        req.query.perPage = Number(req.query.perPage)
        let user = await User.findOne({ _id: req.user.id }, 'shortListedUsers sentInterestUsers receivedInterestUsers blockedUsers declinedUserInterests gender')
        if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        // let users = await User.find({isRegistrationCompleted: true, _id: {$ne: req.user.id}}, 'fullName profileUrl age status height religion community profession education currentCity isVerifiedAccount zodiacSignInEng zodiacSignInMarathi').limit(req.query.perPage)
        // let users = await User.aggregate([{ $sample: { size: 1 } }])
        let blockedUsers = user.blockedUsers
        blockedUsers.push(req.user.id)
        let searchQuery = {
            isRegistrationCompleted: true,
            profileUrl: { $ne: "" },
            _id: { $nin: blockedUsers },
            gender: { $ne: user.gender },
        }
        if (payload.searchText) {
            searchQuery.userId = { $regex: payload.searchText, '$options': 'i' }
        }
        if (payload.minHeight) {
            searchQuery.height = { $gte: Number(payload.minHeight), $lte: Number(payload.maxHeight) }
        }
        if (payload.minAge) {
            searchQuery.age = { $gte: Number(payload.minAge), $lte: Number(payload.maxAge) }
        }
        if (payload.city && payload.city.length > 0) {
            searchQuery.currentCity = { $in: payload.city }
        }
        console.log('payload.profession ', payload.profession)
        if (payload.profession && payload.profession.length > 0) {
            searchQuery.profession = { $in: payload.profession }
        }
        if (payload.religion && payload.religion.length > 0) {
            searchQuery.religion = { $in: payload.religion }
        }
        if (payload.status && payload.status.length > 0) {
            searchQuery.status = { $in: payload.status }
        }
        if (payload.education && payload.education.length > 0) {
            searchQuery.education = { $in: payload.education }
        }
        if (payload.community && payload.community.length > 0) {
            searchQuery.community = { $in: payload.community }
        }
        if (payload.country && payload.country.length > 0) {
            searchQuery.country = { $in: payload.country }
        }

        // console.log('user.gender ', user.gender)
        let users = await User.aggregate([
            {
                $match: searchQuery
            },
            // { $sample: { size: req.query.perPage } },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: (req.query.perPage * req.query.pageNumber) - req.query.perPage },
            { $limit: req.query.perPage },
            {
                $project: {
                    userId: 1, fullName: 1, profileUrl: 1, age: 1, status: 1,
                    height: 1, religion: 1, community: 1, profession: 1,
                    education: 1, currentCity: 1, isVerifiedAccount: 1,
                    zodiacSignInEng: 1, zodiacSignInMarathi: 1,
                    latitudeOfCurrentCity: 1, longitudeOfCurrentCity: 1,
                    latitudeOfCityOfBirth: 1, longitudeOfCityOfBirth: 1,
                    birthDate: 1, timeOfBirth: 1, cityOfBirth: 1,
                    gender: 1, zodiacPngUrl: 1, zodiacSvgUrl: 1,
                    latitude: 1, longitude: 1
                },
            },
        ]);
        let totalDocuments = await User.countDocuments(searchQuery)
        console.log('totalDocuments ', totalDocuments)
        let totalCount = Math.ceil(totalDocuments / req.query.perPage)
        return res.status(200).send({ statusCode: 200, data: { users: users, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (e) {
        console.log('error in getHomeUsers', e.message)
        console.log('error in getHomeUsers', e)
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// getHomeUsersPost
const getHomeUsersPost = async (req, res, next) => {
    try {
        let payload = req.body
        const { error } = validateGetHomeUsersBody(req.body);
        console.log('error ', error)
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.body.pageNumber = Number(req.body.pageNumber)
        req.body.perPage = Number(req.body.perPage)
        let user = await User.findOne({ _id: req.user.id }, 'shortListedUsers sentInterestUsers receivedInterestUsers blockedUsers declinedUserInterests gender')
        if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        // let users = await User.find({isRegistrationCompleted: true, _id: {$ne: req.user.id}}, 'fullName profileUrl age status height religion community profession education currentCity isVerifiedAccount zodiacSignInEng zodiacSignInMarathi').limit(req.query.perPage)
        // let users = await User.aggregate([{ $sample: { size: 1 } }])
        let blockedUsers = user.blockedUsers
        blockedUsers.push(req.user.id)
        let searchQuery = {
            isRegistrationCompleted: true,
            _id: { $nin: blockedUsers },
            gender: { $ne: user.gender },
        }
        if (payload.searchText) {
            searchQuery.userId = { $regex: payload.searchText }
        }
        if (payload.minHeight) {
            searchQuery.height = { $gte: Number(payload.minHeight), $lte: Number(payload.maxHeight) }
        }
        if (payload.minAge) {
            searchQuery.age = { $gte: Number(payload.minAge), $lte: Number(payload.maxAge) }
        }
        if (payload.city && payload.city.length > 0) {
            searchQuery.currentCity = { $in: payload.city }
        }
        if (payload.profession && payload.profession.length > 0) {
            searchQuery.profession = { $in: payload.profession }
        }
        if (payload.religion && payload.religion.length > 0) {
            searchQuery.religion = { $in: payload.religion }
        }
        if (payload.status && payload.status.length > 0) {
            searchQuery.status = { $in: payload.status }
        }

        // console.log('user.gender ', user.gender)
        let users = await User.aggregate([
            {
                $match: searchQuery
            },
            // { $sample: { size: req.query.perPage } },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: (req.query.perPage * req.query.pageNumber) - req.query.perPage },
            { $limit: req.query.perPage },
            {
                $project: {
                    userId: 1, fullName: 1, profileUrl: 1, age: 1, status: 1,
                    height: 1, religion: 1, community: 1, profession: 1,
                    education: 1, currentCity: 1, isVerifiedAccount: 1,
                    zodiacSignInEng: 1, zodiacSignInMarathi: 1,
                    latitudeOfCurrentCity: 1, longitudeOfCurrentCity: 1,
                    latitudeOfCityOfBirth: 1, longitudeOfCityOfBirth: 1,
                    birthDate: 1, timeOfBirth: 1, cityOfBirth: 1,
                    gender: 1, zodiacPngUrl: 1, zodiacSvgUrl: 1,
                },
            },
        ]);
        let totalDocuments = await User.countDocuments(searchQuery)
        console.log('totalDocuments ', totalDocuments)
        let totalCount = Math.ceil(totalDocuments / req.query.perPage)
        return res.status(200).send({ statusCode: 200, data: { users: users, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (e) {
        console.log('error in getHomeUsers', e.message)
        console.log('error in getHomeUsers', e)
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// getTopUsers
const getTopUsers = async (req, res, next) => {
    try {
        const { error } = validateGetNotificationsBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.query.pageNumber = Number(req.query.pageNumber)
        req.query.perPage = Number(req.query.perPage)
        let user = await User.findOne({ _id: req.user.id }, 'shortListedUsers sentInterestUsers receivedInterestUsers blockedUsers declinedUserInterests gender')
        if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        // let users = await User.find({isRegistrationCompleted: true, _id: {$ne: req.user.id}}, 'fullName profileUrl age status height religion community profession education currentCity isVerifiedAccount zodiacSignInEng zodiacSignInMarathi').limit(req.query.perPage)
        // let users = await User.aggregate([{ $sample: { size: 1 } }])
        let blockedUsers = user.blockedUsers
        blockedUsers.push(req.user.id)
        let searchQuery = {
            isRegistrationCompleted: true,
            profileUrl: { $ne: "" },
            _id: { $nin: blockedUsers },
            gender: { $ne: user.gender },
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        let users = await User.aggregate([
            {
                $match: searchQuery
            },
            // { $sample: { size: req.query.perPage } },
            {
                $sort: { createdAt: 1 }
            },
            { $skip: (req.query.perPage * req.query.pageNumber) - req.query.perPage },
            { $limit: req.query.perPage },

            {
                $project: {
                    fullName: 1, profileUrl: 1, age: 1, status: 1,
                    height: 1, religion: 1, community: 1, profession: 1,
                    education: 1, currentCity: 1, isVerifiedAccount: 1,
                    zodiacSignInEng: 1, zodiacSignInMarathi: 1,
                    latitudeOfCurrentCity: 1, longitudeOfCurrentCity: 1,
                    latitudeOfCityOfBirth: 1, longitudeOfCityOfBirth: 1,
                    birthDate: 1, timeOfBirth: 1, cityOfBirth: 1,
                    gender: 1, zodiacPngUrl: 1, zodiacSvgUrl: 1,
                    // isOnline:1

                    isOnline: {
                        $and: [
                            // { $eq: ["$isOnline", true] },
                            // { $gte: ["$lastSeenAt", new Date(Date.now() - 5 * 60 * 1000)] }
                            { $gte: ["$lastSeenAt", new Date(Date.now() - 70 * 1000)] }
                        ]
                    }
                },

            },

        ]);

        let totalDocuments = await User.countDocuments(searchQuery)
        // console.log('totalDocuments ', totalDocuments)
        let totalCount = Math.ceil(totalDocuments / req.query.perPage)
        return res.status(200).send({ statusCode: 200, data: { users: users, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// logout
const logout = async (req, res, next) => {
    try {
        let user = await User.findOne({ _id: req.user.id }, 'loginToken')
        user.loginToken.token = ""
        // user.loginToken.deviceType = ""
        user.loginToken.deviceToken = ""
        user.loginToken.arn = ""
        user.loginToken.voipToken = ""
        await user.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated });
    } catch (error) {
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// getUserDetailsById
const getUserDetailsById = async (req, res, next) => {
    try {
        const { error } = validateGetUserDetailsById(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', msg: error.message });
        let user = await User.findOne({ _id: req.query.userId }, 'fullName profileUrl age status height religion community profession education currentCity isVerifiedAccount zodiacSignInEng zodiacSignInMarathi profileUrl gallery aboutYourself interest expectations gender birthDate timeOfBirth cityOfBirth latitudeOfCityOfBirth longitudeOfCityOfBirth latitudeOfCurrentCity longitudeOfCurrentCity userId zodiacPngUrl zodiacSvgUrl religion community userStatus')
        if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', msg: Message.imageNotFoundInGallery });
        user = JSON.parse(JSON.stringify(user))
        let approvedPhotosCount = 0
        let finalGallery = []
        for (let i of user.gallery) {
            if (i.status === 'Approved' || i.status === 'Profile Photo') {
                finalGallery.push(i)
                approvedPhotosCount = approvedPhotosCount + 1
            }
        }
        user.gallery = finalGallery
        user.approvedPhotosCount = approvedPhotosCount
        let userStatus = ""
        if (req.user.blockedUsers.indexOf(user._id) > -1) {
            userStatus = "Blocked"
        }
        user = JSON.parse(JSON.stringify(user))
        user.userStatus = userStatus

        return res.status(200).send({ statusCode: 200, msg: Message.recordFetched, data: { user: user } });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
const approveGalleryImageById = async (req, res, next) => {
    try {
        const { error } = validateApproveGalleryImageByIdBody(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let astrologer = await User.findOne({ _id: req.body.userId, "gallery._id": req.body.galleryId }, 'gallery isGallarySentForApproval profileUrl loginToken')
        if (!astrologer) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        let pendingGalleyImage = _.find(astrologer.gallery, { isActionTaken: false })

        let selectedImage = astrologer.gallery.id(req.body.galleryId)
        if (!selectedImage) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        }
        selectedImage.status = req.body.status
        selectedImage.isActionTaken = true
        // if any pending images is there in gallery

        pendingGalleyImage = _.find(astrologer.gallery, { isActionTaken: false })
        console.log('pendingGalleyImage ', pendingGalleyImage)
        if (!pendingGalleyImage) {
            astrologer.isGallarySentForApproval = false
        }
        let notificationParams = {
        }
        if (req.body.status === 'Approved') {
            notificationParams = {
                title: 'Your Photo has been Approved.',
                body: 'Your uploaded photo has been Approved.',
                type: 'photo-approved',
                showNotification: "true"
            }
            if (!astrologer.profileUrl) {
                astrologer.profileUrl = selectedImage.galleryUrl
                selectedImage.status = 'Profile Photo'
            }
            if (astrologer.loginToken.deviceToken.length > 10) {
                PushNotification.sendPushNotification(astrologer.loginToken, notificationParams.title, notificationParams.body, notificationParams)
            }
        }
        if (req.body.status === 'Rejected') {
            notificationParams = {
                title: 'Your Photo has been Rejected.',
                body: 'Your uploaded photo has been Rejected.',
                type: 'photo-rejected',
                showNotification: "true"
            }
            if (astrologer.loginToken.deviceToken.length > 10) {
                PushNotification.sendPushNotification(astrologer.loginToken, notificationParams.title, notificationParams.body, notificationParams)
            }
        }
        await astrologer.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordAdded, data: { selectedImage } });
    } catch (error) {
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// getKycDetails
const getKycDetails = async (req, res, next) => {
    try {
        const { error } = validateGalleryPhotoById(req.query)
        if (error) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message })
        }
        let userId = req.user.id
        if (req.query.userId) {
            userId = req.query.userId
        }
        let user = await User.findOne({ _id: userId }, 'aadharCardDetails.front aadharCardDetails.back panCardDetails.front drivingLicense.front')
        if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
        if (user.aadharCardDetails) {
            if (user.aadharCardDetails.front) {
                user.aadharCardDetails.front.documentUrl = getSignedUrl(user.aadharCardDetails.front.documentKey)
            }
            if (user.aadharCardDetails.back) {
                user.aadharCardDetails.back.documentUrl = getSignedUrl(user.aadharCardDetails.back.documentKey)
            }
        }
        if (user.panCardDetails) {
            if (user.panCardDetails.front) {
                user.panCardDetails.front.documentUrl = getSignedUrl(user.panCardDetails.front.documentKey)
            }
        }
        if (user.drivingLicense) {
            if (user.drivingLicense.front) {
                user.drivingLicense.front.documentUrl = getSignedUrl(user.drivingLicense.front.documentKey)
            }
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: { user: user } });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// uploadKycDocumentsByType
const uploadKycDocumentsByType = async (req, res, next) => {
    try {
        const { error } = validateUploadKycDocumentsByTypeBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message })
        }
        await singleAadharMediaUpload(req, res, async function (err) {
            if (err) {
                // if error in upload file return 422 with message
                console.log('err in controller ', err);
                return res.status(422).send({ statusCode: 422, error: 'Something went wrong', message: err.message });
            } else {
                if (!req.file) {
                    return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Please select a file.' })
                } else {
                    const url = getSignedUrl(req.file.key);
                    console.log('req.file.key ', req.file.key)
                    let user = await User.findOne({ _id: req.user.id }, 'aadharCardDetails.front aadharCardDetails.back panCardDetails.front drivingLicense.front')
                    if (!user) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.imageNotFoundInGallery });
                    if (req.query.fileType === 'frontSideAadharCard') {
                        if (user.aadharCardDetails.front) {
                            deleteFileFromS3(process.env.AWS_S3_PRIVATE_BUCKET, user.aadharCardDetails.front.documentKey)
                        }
                        user.aadharCardDetails.front = {
                            documentKey: req.file.key,
                            documentUrl: url,
                            status: "Pending",
                        }

                    } else if (req.query.fileType === 'backSideAadharCard') {
                        if (user.aadharCardDetails.back) {
                            deleteFileFromS3(process.env.AWS_S3_PRIVATE_BUCKET, user.aadharCardDetails.back.documentKey)
                        }
                        user.aadharCardDetails.back = {
                            documentKey: req.file.key,
                            documentUrl: url,
                            status: "Pending",
                        }

                    } else if (req.query.fileType === 'frontSidePanCard') {
                        if (user.panCardDetails.front) {
                            deleteFileFromS3(process.env.AWS_S3_PRIVATE_BUCKET, user.panCardDetails.front.documentKey)
                        }
                        user.panCardDetails.front = {
                            documentKey: req.file.key,
                            documentUrl: url,
                            status: "Pending",
                        }

                    } else if (req.query.fileType === 'frontSideDrivingLicense') {
                        if (user.drivingLicense.front) {
                            deleteFileFromS3(process.env.AWS_S3_PRIVATE_BUCKET, user.drivingLicense.front.documentKey)
                        }
                        user.drivingLicense.front = {
                            documentKey: req.file.key,
                            documentUrl: url,
                            status: "Pending",
                        }

                    }
                    await user.save()
                    return res.status(200).send({ statusCode: 200, message: Message.fileUpload, data: { url: url } });
                }
            }
        });
    } catch (e) {
        console.log('error in uploadFileByType', e)
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// getCommunity
const getCommunity = async (req, res, next) => {
    try {

        let community = await AppMaster.findOne({ type: 'community' }, 'values')
        if (!community) {
            community = []
        } else {
            community = community.values
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: { community } });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// setUserId
const setUserId = async (req, res, next) => {
    try {

        // let users = await User.find({country: {$exists: false}}, 'country countryCode').sort({createdAt: 1})
        // let count = 1
        // for(let user of users){
        //     if(user.countryCode){
        //         console.log(user.countryCode)
        //         let checkCountry = await countryCodeMaster.findOne({phone: user.countryCode}, 'country')
        //         if(checkCountry){
        //             console.log(checkCountry)
        //             user.country = checkCountry.country
        //             console.log('user.country ', user.country)
        //             await user.save()
        //         }
        //     }
        //     // let prefix = 'CMP'
        //     // let sno = count
        //     // if (String(sno).length < 5) {
        //     //     sno = '0'.repeat(5 - String(sno).length) + sno
        //     // }
        //     // user.userId = `${prefix}${sno}`
        //     // user.userIdSeries = count
        //     // // if(user.height){
        //     // //     user.height = Number(user.height)
        //     // // }
        //     // await user.save()
        //     // count = count + 1


        //     // if(user.birthDate){
        //     //     user.birthDate = new Date(user.birthDate)
        //     //     user.birthDate.setHours(0, 0, 0, 0)
        //     //     let zodiacData = findZodiacSign(user.birthDate.getMonth() + 1, user.birthDate.getDate())
        //     //     user.zodiacPngUrl = zodiacData.zodiacPngUrl
        //     //     user.zodiacSvgUrl = zodiacData.zodiacSvgUrl
        //     // }
        //     // await user.save()
        // }
        // let yes = await PlanMaster.findOne({_id: new mongoose.Types.ObjectId('6769adb525ac797318183491')})
        // yes.benefits = [
        //     {
        //       "title": "Unlimited Match Making Report",
        //       "count": Math.pow(10, 1000),
        //       "updateKey": "matchMakingReport"
        //     },
        //     {
        //       "title": "Unlimited Chats Unlock",
        //       "count": Math.pow(10, 1000),
        //       "updateKey": "chatProfiles"
        //     }
        //   ]
        // await yes.save()
        await Subscriptions.updateMany({ planName: 'Yearly' }, { "benefits.chatProfiles": Math.pow(10, 1000) })
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: {} });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// getLoginOtp
const getLoginOtp = async (req, res, next) => {
    return res.status(404).send({ statusCode: 404, error: 'Not Found', message: 'This endpoint is no longer available.' });
};
// getMaster
const getMaster = async (req, res, next) => {
    try {
        let masterData = await AppMaster.find({ whichKindOfData: 'master', isActive: true })
        // distinct city
        // let disCityOfBirth = await User.distinct('cityOfBirth')
        // let discurrentCity = await User.distinct('currentCity')
        // let union = _.union(disCityOfBirth, discurrentCity);
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: { masterData } });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
const isActiveEntitlement = (subscription, now = new Date()) => subscription && subscription.subscriptionStatus === 'Active' && (!subscription.planExpiredOn || new Date(subscription.planExpiredOn) > now);

const planBenefits = (plan) => (plan.benefits || []).reduce((benefits, benefit) => {
    if (benefit.updateKey && Number.isFinite(benefit.count)) benefits[benefit.updateKey] = benefit.count;
    return benefits;
}, {});

const safePlanSnapshot = (plan) => ({
    _id: plan._id, planName: plan.planName, planDescription: plan.planDescription, duration: plan.duration,
    price: plan.price, benefits: plan.benefits, benefitsDescriptions: plan.benefitsDescriptions, order: plan.order,
    androidSubscriptionId: plan.androidSubscriptionId, androidProductId: plan.androidProductId,
    androidBasePlanId: plan.androidBasePlanId, iOsSubscriptionId: plan.iOsSubscriptionId,
});

const entitlementResponse = (subscription) => ({
    subscriptionId: subscription._id,
    entitlement: {
        status: isActiveEntitlement(subscription) ? 'Active' : 'Expired',
        planId: subscription.subscribedPlan,
        expiresAt: subscription.planExpiredOn || null,
        benefits: subscription.benefits || {},
    },
});

// Creates a server-owned pending purchase. It does not grant an entitlement.
const createInAppSubscription = async (req, res, next) => {
    try {
        const { error } = validateCreateInAppSubscriptionBody(req.body);
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        const planDetail = await PlanMaster.findOne({ _id: req.body.subscribedPlan, isActive: true, type: 'plan' });
        if (!planDetail) {
            return res.status(404).send({ statusCode: 404, error: 'Not Found', message: Message.planNotFound });
        }
        const androidConfigured = (planDetail.androidProductId || process.env.GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID || planDetail.androidGroupId) && (planDetail.androidBasePlanId || planDetail.androidSubscriptionId);
        if (!(req.body.planPurchasedFrom === 'android' ? androidConfigured : planDetail.iOsSubscriptionId)) {
            return res.status(409).send({ statusCode: 409, error: 'Conflict', message: 'This plan is not available on the selected platform.' });
        }
        let targetSubscriptionId;
        if (req.body.type !== 'newPurchase') {
            const target = await Subscriptions.findOne({ _id: req.body.subscriptionId, user: req.user.id }, '_id');
            if (!target) return res.status(404).send({ statusCode: 404, error: 'Not Found', message: Message.subsriptionNotFound });
            targetSubscriptionId = target._id;
        }
        const pending = await SubscriptionHistory.create({
            user: req.user.id, subscribedPlan: planDetail._id, planName: planDetail.planName, duration: planDetail.duration,
            planDetails: safePlanSnapshot(planDetail), price: planDetail.price, paymentGateway: 'InAppPurchase',
            subscriptionStatus: 'Inactive', paymentStatus: 'Pending', verificationStatus: 'Pending',
            planPurchasedFrom: req.body.planPurchasedFrom, requestedAction: req.body.type, targetSubscriptionId,
        });
        console.info('purchase_verification_requested', { userId: String(req.user.id), purchaseId: String(pending._id), platform: req.body.planPurchasedFrom });
        return res.status(201).send({ statusCode: 201, message: Message.subscriptionCreated, data: { subscription: { _id: pending._id, subscribedPlan: pending.subscribedPlan } } });
    } catch (error) {
        console.error('purchase_creation_failed', { code: error.code || error.name });
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: 'Unable to create purchase verification.' });
    }
};
// verifyInAppSubscription
const verifyInAppSubscription = async (req, res, next) => {
    try {
        const { error } = validateVerifyInAppPurchaseSubscription(req.body);
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        await enforcePurchaseVerificationRateLimit(req.user.id);
        const isAndroid = Boolean(req.body.purchaseToken || req.body.androidInAppPurchaseRes);
        let pending = req.body.subscriptionId
            ? await SubscriptionHistory.findOneAndUpdate({ _id: req.body.subscriptionId, user: req.user.id, paymentStatus: 'Pending', verificationStatus: 'Pending' }, { $set: { verificationStatus: 'Verifying' } }, { new: true })
            : null;
        if (req.body.subscriptionId && !pending) {
            const existing = await SubscriptionHistory.findOne({ _id: req.body.subscriptionId, user: req.user.id }, 'paymentStatus activeSubscriptionId');
            if (!existing || existing.paymentStatus !== 'PAYMENT_CAPTURED') return res.status(409).send({ statusCode: 409, error: 'Conflict', message: 'This purchase is already being verified.' });
            const subscription = await Subscriptions.findOne({ _id: existing.activeSubscriptionId, user: req.user.id });
            if (subscription) return res.status(200).send({ statusCode: 200, message: Message.subscriptionCreated, data: entitlementResponse(subscription) });
        }
        let planDetail = pending ? await PlanMaster.findOne({ _id: pending.subscribedPlan, isActive: true, type: 'plan' }) : null;
        if (!isAndroid && !planDetail && req.body.subscribedPlan) {
            planDetail = await PlanMaster.findOne({ _id: req.body.subscribedPlan, isActive: true, type: 'plan' });
        }
        if (!isAndroid && !planDetail) throw new PurchaseVerificationError('An App Store plan is required.', 400, 'plan_required');
        const verified = await verifyInAppPurchase(planDetail, req.body, isAndroid ? 'android' : 'ios');
        if (isAndroid) {
            const plans = await PlanMaster.find({ isActive: true, type: 'plan' });
            const matches = plans.filter((plan) => googlePlanMatches(plan, verified));
            if (matches.length !== 1) throw new PurchaseVerificationError('Google Play product and base plan are not mapped to exactly one internal plan.', 409, 'plan_mapping_invalid');
            planDetail = matches[0];
        }
        if (!planDetail) throw new PurchaseVerificationError('This plan is no longer available.', 409, 'plan_not_found');
        if (pending && String(pending.subscribedPlan) !== String(planDetail._id)) throw new PurchaseVerificationError('Purchase plan does not match Google Play.', 409, 'plan_mismatch');
        if (req.body.subscribedPlan && String(req.body.subscribedPlan) !== String(planDetail._id)) throw new PurchaseVerificationError('Purchase plan does not match Google Play.', 409, 'plan_mismatch');
        if (!pending) {
            pending = await SubscriptionHistory.create({
                user: req.user.id, subscribedPlan: planDetail._id, planName: planDetail.planName, duration: planDetail.duration,
                planDetails: safePlanSnapshot(planDetail), price: planDetail.price, paymentGateway: 'InAppPurchase',
                subscriptionStatus: 'Inactive', paymentStatus: 'Pending', verificationStatus: 'Verifying',
                planPurchasedFrom: isAndroid ? 'android' : 'ios', requestedAction: 'restore',
            });
        }
        const duplicate = await SubscriptionHistory.findOne({ provider: verified.provider, providerTransactionId: verified.transactionId, paymentStatus: 'PAYMENT_CAPTURED' }, 'activeSubscriptionId');
        if (duplicate && String(duplicate.activeSubscriptionId)) {
            const subscription = await Subscriptions.findOne({ _id: duplicate.activeSubscriptionId, user: req.user.id });
            if (!subscription) throw new PurchaseVerificationError('This purchase belongs to another account.', 409, 'purchase_owned');
            Object.assign(subscription, {
                subscriptionStatus: 'Active', paymentStatus: 'PAYMENT_CAPTURED', planStartsOn: verified.purchasedAt,
                planExpiredOn: verified.expiresAt, providerTransactionId: verified.transactionId,
                providerEnvironment: verified.environment, providerStatus: verified.status,
            });
            await subscription.save();
            await User.updateOne({ _id: req.user.id }, { $set: { subscriptionId: subscription._id, subscriptionStatus: 'Active' } });
            if (isAndroid) await acknowledgeGooglePurchase(verified);
            return res.status(200).send({ statusCode: 200, message: Message.subscriptionCreated, data: entitlementResponse(subscription) });
        }
        const session = await mongoose.startSession();
        let activeSubscription;
        try {
            await session.withTransaction(async () => {
                const ownershipIds = [verified.ownershipId, verified.linkedOwnershipId].filter(Boolean);
                const owners = await InAppPurchaseOwnership.find({ provider: verified.provider, ownershipId: { $in: ownershipIds } }).session(session);
                if (owners.some((owner) => String(owner.user) !== String(req.user.id))) throw new PurchaseVerificationError('This purchase belongs to another account.', 409, 'purchase_owned');
                for (const ownershipId of ownershipIds) {
                    if (!owners.some((owner) => owner.ownershipId === ownershipId)) await InAppPurchaseOwnership.create([{ provider: verified.provider, ownershipId, user: req.user.id }], { session });
                }
                const history = await SubscriptionHistory.findOneAndUpdate(
                    { _id: pending._id, user: req.user.id, verificationStatus: 'Verifying' },
                    { $set: { paymentStatus: 'PAYMENT_CAPTURED', subscriptionStatus: 'Active', verificationStatus: 'Verified', provider: verified.provider, providerTransactionId: verified.transactionId, providerOwnershipId: verified.ownershipId, providerEnvironment: verified.environment, providerStatus: verified.status, providerAcknowledgementStatus: isAndroid ? 'Pending' : 'Acknowledged', planStartsOn: verified.purchasedAt, planExpiredOn: verified.expiresAt || undefined } },
                    { new: true, session }
                );
                if (!history) throw new PurchaseVerificationError('Purchase verification is already in progress.', 409, 'purchase_in_progress');
                activeSubscription = pending.targetSubscriptionId
                    ? await Subscriptions.findOne({ _id: pending.targetSubscriptionId, user: req.user.id }).session(session)
                    : await Subscriptions.findOne({ _id: req.user.subscriptionId, user: req.user.id }).session(session);
                if (!activeSubscription) {
                    const user = await User.findById(req.user.id).session(session);
                    if (!user) throw new PurchaseVerificationError('User not found.', 404, 'user_not_found');
                    if (user.subscriptionId) await Subscriptions.updateOne({ _id: user.subscriptionId, user: req.user.id, subscriptionStatus: 'Active' }, { $set: { subscriptionStatus: 'Replaced' } }, { session });
                    activeSubscription = new Subscriptions({ user: req.user.id });
                }
                Object.assign(activeSubscription, {
                    user: req.user.id, subscribedPlan: planDetail._id, planName: planDetail.planName, duration: planDetail.duration,
                    planDetails: safePlanSnapshot(planDetail), price: planDetail.price, paymentGateway: 'InAppPurchase', subscriptionStatus: 'Active', paymentStatus: 'PAYMENT_CAPTURED',
                    planPurchasedFrom: pending.planPurchasedFrom, planStartsOn: verified.purchasedAt, planExpiredOn: verified.expiresAt || undefined,
                    benefits: planBenefits(planDetail), activeSubscriptionTransaction: history._id, provider: verified.provider,
                    providerTransactionId: verified.transactionId, providerOwnershipId: verified.ownershipId, providerEnvironment: verified.environment, providerStatus: verified.status,
                    providerAcknowledgementStatus: isAndroid ? 'Pending' : 'Acknowledged',
                });
                await activeSubscription.save({ session });
                history.activeSubscriptionId = activeSubscription._id;
                await history.save({ session });
                await User.updateOne({ _id: req.user.id }, { $set: { subscriptionId: activeSubscription._id, subscriptionStatus: 'Active' } }, { session });
            });
        } finally {
            await session.endSession();
        }
        if (isAndroid) {
            try {
                await acknowledgeGooglePurchase(verified);
                await Promise.all([
                    SubscriptionHistory.updateOne({ _id: pending._id }, { $set: { providerAcknowledgementStatus: 'Acknowledged' } }),
                    Subscriptions.updateOne({ _id: activeSubscription._id }, { $set: { providerAcknowledgementStatus: 'Acknowledged' } }),
                ]);
            } catch (acknowledgementError) {
                console.warn('purchase_acknowledgement_failed', { userId: String(req.user.id), purchaseId: String(pending._id), code: acknowledgementError.code || acknowledgementError.name });
                throw acknowledgementError;
            }
        }
        console.info('purchase_verification_succeeded', { userId: String(req.user.id), purchaseId: String(pending._id), provider: verified.provider, transaction: maskIdentifier(verified.transactionId) });
        return res.status(200).send({ statusCode: 200, message: Message.subscriptionCreated, data: entitlementResponse(activeSubscription) });
    } catch (error) {
        if (error.code === 'purchase_revoked' && error.ownershipId) {
            const revoked = await Subscriptions.findOneAndUpdate(
                { user: req.user.id, provider: 'google_play', providerOwnershipId: error.ownershipId },
                { $set: { subscriptionStatus: 'Expired', providerStatus: 'SUBSCRIPTION_STATE_REVOKED' } },
                { new: true }
            );
            if (revoked) await User.updateOne({ _id: req.user.id, subscriptionId: revoked._id }, { $set: { subscriptionStatus: 'Expired' } });
        }
        if (req.body && req.body.subscriptionId) await SubscriptionHistory.updateOne({ _id: req.body.subscriptionId, user: req.user.id, verificationStatus: 'Verifying' }, { $set: { verificationStatus: 'Pending' } });
        const statusCode = error.statusCode || (error.code === 11000 ? 409 : 500);
        console.warn('purchase_verification_failed', { userId: String(req.user.id), code: error.code || error.name, statusCode });
        return res.status(statusCode).json({ statusCode, error: statusCode >= 500 ? 'Service Unavailable' : 'Bad Request', message: statusCode >= 500 ? 'Purchase verification is temporarily unavailable.' : error.message });
    }
};
// getPlanDetails
const getPlanDetails = async (req, res, next) => {
    try {
        const susbscription = await Subscriptions.findOne({ _id: req.user.subscriptionId }, 'planName subscribedPlan subscriptionStatus planExpiredOn');
        const currentSubcription = {};
        if (susbscription) {
            currentSubcription._id = susbscription._id
            currentSubcription.planName = susbscription.planName
            currentSubcription.subscribedPlan = susbscription.subscribedPlan
            currentSubcription.subscriptionStatus = isActiveEntitlement(susbscription) ? susbscription.subscriptionStatus : 'Expired'
        }
        let plans = await PlanMaster.find({ isActive: true, type: 'plan' }).sort({ order: 1, _id: 1 })

        if (currentSubcription) {
            plans = JSON.parse(JSON.stringify(plans))
            for (let plan of plans) {
                if (currentSubcription && String(plan._id) === String(currentSubcription.subscribedPlan)) {
                    plan.subscriptionStatus = currentSubcription.subscriptionStatus
                }
            }
        }
        return res.status(200).send({ statusCode: 200, message: Message.subscriptionCreated, data: { currentSubcription, plans } });
    } catch (error) {
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// regenerateChatToken
const regenerateChatToken = async (req, res) => {

    try {

        let myTeam = await User.findOne({ _id: req.user.id }, 'agoraChatLoginDetails')
        if (!myTeam) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound })
        }
        myTeam.agoraChatLoginDetails.chatToken = await generateChatTokenByUserId(String(myTeam._id))
        await myTeam.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: { user: myTeam } })
    } catch (error) {

        return res.status(500).json({ statusCode: 500, error: Message.somethingWentWrong, message: error.message });
    }
}
const updateBenefitByType = async (req, res) => {
    //!!!!
    try {

        const { error } = validateUpdateBenefites(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let user = await User.findOne({ _id: req.user.id }, 'subscriptionId unlockChatUsers')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound })
        }
        if (!user.subscriptionId && req.body.benefit == 'chatProfiles') {
            return res.status(403).send({
                statusCode: 403,
                message: "You are currently on a free plan."
            });
        }

        let subscription = await Subscriptions.findOne({ _id: user.subscriptionId }, 'benefits subscriptionStatus planExpiredOn')
        if (!subscription) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.subsriptionNotFound })
        }
        if (!isActiveEntitlement(subscription)) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.subscriptionExpired })
        }
        if (subscription.benefits[req.body.benefit] <= 0) {
            return res.status(402).send({ statusCode: 402, error: 'Benefits Exhausted', message: Message.benefitsLess })
        }
        let decrement = true
        if (req.body.unlockChatUserId && req.body.benefit === 'chatProfiles') {
            if (user.unlockChatUsers.indexOf(req.body.unlockChatUserId) === -1) {
                user.unlockChatUsers.push(req.body.unlockChatUserId)
                await user.save()
            } else {
                decrement = false
            }
        }
        console.log('decrement ', decrement)
        if (decrement) {
            subscription.benefits[req.body.benefit] = subscription.benefits[req.body.benefit] - 1
        }
        await subscription.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: { subscription, unlockChatUsers: user.unlockChatUsers } })
    } catch (error) {

        return res.status(500).json({ statusCode: 500, error: Message.somethingWentWrong, message: error.message });
    }
}
// login
const login = async (req, res, next) => {
    let payload = req.body;
    try {
        const { error } = validateLoginDetails(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let staff = await Staff.findOne({
            $or: [
                { email: req.body.email.toLowerCase() }
            ]
        });
        // if staff not found return with 400 error
        if (!staff) return res.status(400).send({ statusCode: 400, error: 'Invalid Credentials', message: 'The username or password you have entered is invalid.' });
        // if (!staff.role.length == 0) return res.status(403).send({ statusCode: 403, error: 'Unauthorised', message: 'This role is not found on the platform. Please contact platform support.' });
        // check password is valid or not 
        const validPassword = await bcrypt.compare(req.body.password, staff.password);
        // if password is not valid return with 400 error 
        if (!validPassword) return res.status(400).send({ statusCode: 400, error: 'Invalid Credentials', message: 'The username or password you have entered is invalid.' });
        // if staff is disbled return 400 'Unauthorized' with message
        if (!staff.isActive) return res.status(400).send({ statusCode: 401, error: 'Unauthorized', message: 'This user is banned from this platform.' });

        let loginToken = universal.generateToken({
            firstName: staff.firstName,
            lastName: staff.lastName,
            profileUrl: staff.profileUrl,
            email: staff.email,
            role: staff.role,
            _id: staff._id,
            userType: 'Admin'
        });
        staff.loginTime = new Date().getTime() // user login time
        staff.loginToken.token = loginToken; // jwt token
        staff.loginToken.deviceType = "web";
        await staff.save()
        return res.status(200).send({ statusCode: 200, message: 'Login Successful.', data: { token: loginToken } });

    } catch (error) {
        console.log('error ', error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// sendPushNotificatioByType
const sendPushNotificatioByType = async (req, res) => {

    try {

        const { error } = validatesendNotiByType(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let otherUser = await User.findOne({ _id: req.user.id }, 'loginToken')
        if (!otherUser) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound })
        }

        let notificationParams = {
            title: 'You have recieved an Interest.',
            body: `${otherUser.fullName} has sent you Interest on Companion.`,
            type: 'received-interest',
            showNotification: "true"
        }
        if (req.body.type === 'shortlist') {

        } else if (req.body.type === 'unshortlist') {

        } else if (req.body.type === "sendInterest") {



        } else if (req.body.type === 'unsendInterest') {

        } else if (req.body.type === 'block') {

        } else if (req.body.type === 'unblock') {

        } else if (req.body.type === 'declineInterest') {
            notificationParams = {
                title: 'Your interest has been declined.',
                body: `${otherUser.fullName} has Declined your Interest.`,
                type: 'decline-interest',
                showNotification: "true"
            }


        } else if (req.body.type === 'delete-my-account') {

            notificationParams = {
                title: 'Your Request to Delete Data Recieved.',
                body: 'Your request to delete data has been recieved, we will contact you within 24 hours.',
                type: 'delete-my-account',
                showNotification: "true"
            }
        } else if (req.body.type === 'approve-photo') {
            notificationParams = {
                title: 'Your Photo has been Approved.',
                body: 'Your uploaded photo has been Approved.',
                type: 'photo-approved',
                showNotification: "true"
            }
        } else if (req.body.type === 'reject-photo') {
            notificationParams = {
                title: 'Your Photo has been Rejected.',
                body: 'Your uploaded photo has been Rejected.',
                type: 'photo-rejected',
                showNotification: "true"
            }
        }
        if (otherUser && otherUser.loginToken.deviceToken.length > 10) {
            PushNotification.sendPushNotification(otherUser.loginToken, notificationParams.title, notificationParams.body, notificationParams)
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordFetched, data: {} })
    } catch (error) {

        return res.status(500).json({ statusCode: 500, error: Message.somethingWentWrong, message: error.message });
    }
}
// getGalleryPendingRequest
const getGalleryPendingRequest = async (req, res, next) => {
    let payload = req.query;
    try {
        const { error } = validateGetNotificationsBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.query.pageNumber = Number(req.query.pageNumber)
        req.query.perPage = Number(req.query.perPage)
        let total = 0
        let searchQuery = {}
        searchQuery.$and = [{ isGallarySentForApproval: true, isRegistrationCompleted: true }]
        let dashboardAstrologers = await User.aggregate([
            {
                $match: searchQuery
            },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    userId: 1, fullName: 1, email: 1, mobile: 1, "loginToken.deviceType": 1, createdAt: 1,
                }
            },
            {
                $facet: { //get totalcount instead of limited count
                    data: [{ $skip: (req.query.perPage * req.query.pageNumber) - req.query.perPage }, { $limit: req.query.perPage }],
                    total: [{ $count: 'count' }]
                }
            }
        ])
        if (dashboardAstrologers[0].data.length > 0) {
            total = dashboardAstrologers[0].total[0].count
            dashboardAstrologers = dashboardAstrologers[0].data

        } else {
            dashboardAstrologers = []
            total = 0
        }
        console.log('total ', total)
        let totalCount = Math.ceil(total / req.query.perPage)
        return res.status(200).send({ statusCode: 200, data: { user: dashboardAstrologers, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (error) {
        console.log('error ', error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// verifyAccount
const verifyAccount = async (req, res, next) => {
    try {
        const { error } = validateVerifyAccountsById(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let user = await User.findOne({ _id: req.body.userId }, 'isVerifiedAccount')
        if (!user) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound });
        }
        delete req.body.userId
        for (key of Object.keys(req.body)) {
            user[key] = req.body[key]
        }
        user = await user.save()
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: { user: user } });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// approveAllPhotos
const approveAllPhotos = async (req, res, next) => {
    let payload = req.body;
    try {
        let searchQuery = {}
        searchQuery.$and = [{ isGallarySentForApproval: true, isRegistrationCompleted: true }]
        let dashboardAstrologers = await User.find(searchQuery, 'loginToken gallery isGallarySentForApproval profileUrl')
        console.log('dashboardAstrologers ', dashboardAstrologers.length)
        req.body.status = 'Approved'
        let notificationParams = {
        }
        for (let astrologer of dashboardAstrologers) {
            console.log('astrologer ', astrologer._id)
            for (let selectedImage of astrologer.gallery) {
                console.log('selectedImage.isActionTaken ', selectedImage.isActionTaken, selectedImage)
                if (!selectedImage.isActionTaken) {
                    console.log('insidde ')
                    selectedImage.status = req.body.status
                    selectedImage.isActionTaken = true
                    if (req.body.status === 'Approved') {
                        notificationParams = {
                            title: 'Your Photo has been Approved.',
                            body: 'Your uploaded photo has been Approved.',
                            type: 'photo-approved',
                            showNotification: "true"
                        }
                        if (!astrologer.profileUrl) {
                            astrologer.profileUrl = selectedImage.galleryUrl
                            selectedImage.status = 'Profile Photo'
                        }
                        if (astrologer.loginToken.deviceToken.length > 10) {
                            PushNotification.sendPushNotification(astrologer.loginToken, notificationParams.title, notificationParams.body, notificationParams)
                        }
                    }
                }
            }
            let pendingGalleyImage = _.find(astrologer.gallery, { isActionTaken: false })
            if (!pendingGalleyImage) {
                astrologer.isGallarySentForApproval = false
            }
            await astrologer.save()
        }
        return res.status(200).send({ statusCode: 200, data: {}, message: Message.recordFetched });
    } catch (error) {
        console.log('error ', error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// deleteUser
const deleteUser = async (req, res, next) => {
    try {
        const { error } = validateDeleteAccountsById(req.body);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        let users = []
        if (mongoose.Types.ObjectId.isValid(req.body.userId)) {
            users = await User.find({ _id: req.body.userId }, '_id')
        } else {
            users = await User.find({ $or: [{ mobile: req.body.userId }, { email: req.body.userId }, { userId: req.body.userId }] }, '_id')
        }
        if (!users.length === 0) {
            return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: Message.userNotFound });
        }
        for (let user of users) {
            await SubscriptionHistory.deleteMany({ user: user._id })
            await Subscriptions.deleteMany({ user: user._id })
            await User.deleteMany({ _id: user._id })
        }
        return res.status(200).send({ statusCode: 200, message: Message.recordUpdated, data: {} });
    } catch (e) {
        // send 500 error if something goes wrong
        return res.status(500).send({ statusCode: 500, message: "Oops! Something went wrong here...", error: e.message });
    }
};
// getUnverifiedUsers
const getUnverifiedUsers = async (req, res, next) => {
    let payload = req.body;
    try {
        const { error } = validateGetNotificationsBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.query.pageNumber = Number(req.query.pageNumber)
        req.query.perPage = Number(req.query.perPage)
        let total = 0
        let searchQuery = {}
        searchQuery.$and = [{ isVerifiedAccount: false, isRegistrationCompleted: true }]
        let dashboardAstrologers = await User.aggregate([
            {
                $match: searchQuery
            },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    userId: 1, fullName: 1, email: 1, mobile: 1, "loginToken.deviceType": 1, createdAt: 1, isVerifiedAccount: 1
                }
            },
            {
                $facet: { //get totalcount instead of limited count
                    data: [{ $skip: (req.query.perPage * req.query.pageNumber) - req.query.perPage }, { $limit: req.query.perPage }],
                    total: [{ $count: 'count' }]
                }
            }
        ])
        if (dashboardAstrologers[0].data.length > 0) {
            total = dashboardAstrologers[0].total[0].count
            dashboardAstrologers = dashboardAstrologers[0].data

        } else {
            dashboardAstrologers = []
            total = 0
        }
        console.log('total ', total)
        let totalCount = Math.ceil(total / req.query.perPage)
        return res.status(200).send({ statusCode: 200, data: { user: dashboardAstrologers, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (error) {
        console.log('error ', error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// appleSubscription
const appleSubscription = async (req, res, next) => {
    console.warn('purchase_webhook_rejected', { provider: 'app_store', reason: 'not_configured' });
    return res.status(410).json({ statusCode: 410, error: 'Gone', message: 'This webhook endpoint is not configured.' });
};
// androidSubscription
const androidSubscription = async (req, res, next) => {
    console.warn('purchase_webhook_rejected', { provider: 'google_play', reason: 'not_configured' });
    return res.status(410).json({ statusCode: 410, error: 'Gone', message: 'This webhook endpoint is not configured.' });
};
// getAllUsers
const getAllUsers = async (req, res, next) => {
    let payload = req.query;
    try {
        const { error } = validateAllUsersBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.query.pageNumber = Number(req.query.pageNumber)
        req.query.perPage = Number(req.query.perPage)
        let total = 0
        let searchQuery = {}
        searchQuery.$and = [{ isRegistrationCompleted: true }]
        if (payload.searchText) {
            searchQuery['$and'].push({ $or: [{ userId: { $regex: payload.searchText, '$options': 'i' } }, { fullName: { $regex: payload.searchText, '$options': 'i' } }, { email: { $regex: payload.searchText, '$options': 'i' } }] })
            // searchQuery.userId = {$regex: payload.searchText}
        }
        if (payload.userType && payload.userType === 'verified') {
            searchQuery['$and'].push({ isVerifiedAccount: true })
        } else if (payload.userType && payload.userType === 'unverified') {
            searchQuery['$and'].push({ isVerifiedAccount: false })
        }
        let dashboardAstrologers = await User.aggregate([
            {
                $match: searchQuery
            },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    userId: 1, fullName: 1, email: 1, mobile: 1, "loginToken.deviceType": 1, createdAt: 1, isVerifiedAccount: 1
                }
            },
            {
                $facet: { //get totalcount instead of limited count
                    data: [{ $skip: (req.query.perPage * req.query.pageNumber) - req.query.perPage }, { $limit: req.query.perPage }],
                    total: [{ $count: 'count' }]
                }
            }
        ])
        if (dashboardAstrologers[0].data.length > 0) {
            total = dashboardAstrologers[0].total[0].count
            dashboardAstrologers = dashboardAstrologers[0].data

        } else {
            dashboardAstrologers = []
            total = 0
        }
        console.log('total ', total)
        let totalCount = Math.ceil(total / req.query.perPage)
        return res.status(200).send({ statusCode: 200, data: { user: dashboardAstrologers, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (error) {
        console.log('error ', error)
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};
// sendPushNotificationToAll
const sendPushNotificationToAll = async (req, res, next) => {
    try {
        const { error } = validateSendPushNotificationByType(req.body);
        if (error) {
            return res
                .status(400)
                .send({ statusCode: 400, error: 'Bad Request', message: error.message });
        }

        // ----- Build notificationNo (PNxxx) -----
        let last = await NotificationSentByAdmin
            .findOne({ notificationNo: { $exists: true } }, 'notificationNo')
            .sort({ createdAt: -1 });

        let seq = 1;
        if (last?.notificationNo) {
            const n = Number(String(last.notificationNo).split('PN')[1]);
            seq = Number.isFinite(n) ? n + 1 : 1;
        }
        const suffix = String(seq).padStart(3, '0');
        const notificationNo = `PN${suffix}`;

        // ----- Normalize/Defaults from request -----
        const imageUrl = (req.body.imageUrl || '').trim();
        const title = (req.body.title || 'Alert!').trim();
        const body = String(req.body.body ?? '').trim();

        // Accept both "notificationType" (backend) and "type" (panel)
        const notificationType =
            (req.body.notificationType || req.body.type || 'general').trim();

        // Optional flags you may already use in your push util:
        // const showNotification =
        //   typeof req.body.showNotification === 'boolean'
        //     ? req.body.showNotification
        //     : true; // visible alert by default
        const showNotification =
            (req.body.showNotification === '0' ||
                req.body.showNotification === 0 ||
                req.body.showNotification === false)
                ? '0'
                : '1';

        // ----- Persist admin notification cleanly (no req.body mutation) -----
        await NotificationSentByAdmin.create({
            notificationNo,
            isGlobal: true,
            userType: 'users',
            title : body,
            body,
            imageUrl,
            notificationType
        });

        // ----- Fetch ALL eligible users with non-empty tokens -----
        const users = await User.find(
            {
                isRegistrationCompleted: true,
                'loginToken.deviceToken': { $exists: true, $ne: '' }
                // add additional filters if you have inactive/disabled tokens:
                // 'loginToken.isActive': true
            },
            { loginToken: 1 } // projection
        ).lean();

        if (!users.length) {
            // Avoid calling FCM at all -> prevents "token:''" path
            return res.status(400).send({
                statusCode: 400,
                error: 'NoRecipients',
                message:
                    'No eligible device tokens found (isRegistrationCompleted=true with non-empty loginToken.deviceToken).'
            });
        }

        // ----- Prepare push payload for the util -----
        const pushData = {
            imageUrl,
            type: notificationType,
            showNotification
        };

        // If your util returns a promise, await it to catch errors here:
        await PushNotification.sendPushNotificationToMultipleUsers(
            users,
            title,
            body,
            pushData
        );

        return res
            .status(200)
            .send({ statusCode: 200, data: {}, message: Message.recordFetched });
    } catch (error) {
        console.log('error ', error);
        return res
            .status(500)
            .json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};

const getAdminPushNotifications = async (req, res, next) => {
    try {
        // validate req.body
        const { error } = validateGetNotificationsBody(req.query);
        // if client send invalid data return 400 'Bad Request' 
        if (error) return res.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
        req.query.pageNumber = Number(req.query.pageNumber)
        req.query.perPage = Number(req.query.perPage)
        let query = { isActive: true, isGlobal: true }
        let totalCount = await NotificationSentByAdmin.countDocuments(query)
        let notifications = await NotificationSentByAdmin.find(query).sort({ createdAt: -1 }).limit(req.query.perPage).skip((req.query.perPage * req.query.pageNumber) - req.query.perPage)
        totalCount = Math.ceil(totalCount / req.query.perPage)

        return res.status(200).send({ statusCode: 200, data: { notifications: notifications, totalCount, pageNumber: req.query.pageNumber, perPage: req.query.perPage }, message: Message.recordFetched });
    } catch (error) {
        return res.status(500).json({ statusCode: 500, error: 'Oops! Something went wrong here...', message: error.message });
    }
};

const updateLocation = async (req, res) => {
    console.log("Latitude: ", req.body.a);
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
            statusCode: 400,
            message: "Latitude and longitude are required",
            data: null,
            error: "Missing coordinates"
        });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                },
                lastSeenAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                statusCode: 404,
                message: "User not found",
                data: null,
                error: "Invalid user ID"
            });
        }

        return res.status(200).json({
            statusCode: 200,
            message: "Location updated successfully",
            data: {
                latitude: updatedUser.latitude,
                longitude: updatedUser.longitude
            },
            error: null
        });

    } catch (error) {
        console.error("Location update failed:", error);
        return res.status(500).json({
            statusCode: 500,
            message: "Server error",
            error: error.message
        });
    }
};

const updateOnlineStatus = async (req, res) => {
    // const { isOnline } = req.body; //optional
    const userId = req.user.id;

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                // isOnline, //optional
                lastSeenAt: new Date()
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                statusCode: 404,
                message: "User not found",
                error: "Invalid user ID"
            });
        }

        return res.status(200).json({
            statusCode: 200,
            message: `User is now marked as 'online'`,
            data: {
                isOnline: true
            },
            error: null
        });

    } catch (error) {
        console.error("Online status update failed:", error);
        return res.status(500).json({
            statusCode: 500,
            message: "Server error",
            error: error.message
        });
    }
};





const getCoordinates = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ message: "User not foound" });

        res.status(200).json({
            latitude: user.latitude,
            longitude: user.longitude,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

const getOnlineUsersSorted = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Fetch current user's location and blocked users
        const currentUser = await User.findById(userId).select('location gender blockedUsers');

        if (!currentUser?.location?.coordinates) {
            return res.status(400).json({
                statusCode: 400,
                message: "Location not found. Please enable location services.",
            });
        }

        const [lng, lat] = currentUser.location.coordinates;

        // ✅ Skip if current user's location is [0, 0]
        if (lng === 0 && lat === 0) {
            return res.status(400).json({
                statusCode: 400,
                message: "Your location is not set properly.",
            });
        }

        const { pageNumber = 1, perPage = 20 } = req.query;

        // Convert self and blocked user IDs to ObjectId
        const excludedUserIds = [
            new mongoose.Types.ObjectId(userId),
            ...(currentUser.blockedUsers || []).map(id => new mongoose.Types.ObjectId(id))
        ];

        // const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        // const fiveMinutesAgo = new Date(Date.now() - 70 * 1000);
        const fiveMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

        // Geo query to get sorted nearby online users (excluding [0,0])
        const users = await User.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lng, lat] },
                    distanceField: "distance",
                    spherical: true,
                    // minDistance: 0,    // 0.1 km = 100 meters
                    // maxDistance: 10000,  // 10 km = 10,000 meters
                    query: {
                        _id: { $nin: excludedUserIds },
                        // isOnline: true, //optional
                        lastSeenAt: { $gte: fiveMinutesAgo },
                        location: {
                            $exists: true,
                            $ne: { type: "Point", coordinates: [0, 0] }
                        },
                        profileUrl: { $exists: true, $ne: "" },
                        fullName: { $exists: true, $ne: "" },
                        gender: { $ne: currentUser.gender }
                    }
                }
            },
            { $skip: (pageNumber - 1) * perPage },
            { $limit: perPage },
            {
                $project: {
                    _id: 1,
                    fullName: 1,
                    profileUrl: 1,
                    age: 1,
                    location: 1,
                    distance: 1
                }
            }
        ]);

        // Count total valid online users
        const totalDocuments = await User.countDocuments({
            _id: { $nin: excludedUserIds },
            status: "online",
            location: {
                $exists: true,
                $ne: { type: "Point", coordinates: [0, 0] }
            },
            profileUrl: { $exists: true, $ne: null },
            fullName: { $exists: true, $ne: "" },
            // gender: { $ne: currentUser.gender } // optional
        });

        return res.status(200).json({
            statusCode: 200,
            message: "Online users fetched successfully",
            data: {
                users,
                totalCount: Math.ceil(totalDocuments / perPage),
                pageNumber,
                perPage
            }
        });

    } catch (error) {
        console.error("Geo query failed:", error);
        return res.status(500).json({
            statusCode: 500,
            message: "Server error",
            error: error.message
        });
    }
};

const checkAndIncrementMessage = async (req, res) => {
    const { senderId, receiverId } = req.body;

    try {
        const user = await User.findById(senderId).select('subscriptionId');

        let subscription = null;
        if (user?.subscriptionId) {
            //   subscription = await Subscriptions.findById(user.subscriptionId).select('benefits subscriptionStatus');
            subscription = await Subscriptions.findOne({ _id: user.subscriptionId }, 'benefits subscriptionStatus planExpiredOn')
        }

        // ---------- CASE 1: ACTIVE SUBSCRIPTION ----------


        if (isActiveEntitlement(subscription) && !(subscription.benefits['chatProfiles'] <= 0)) {
            return res.status(200).json({
                statusCode: 200,
                message: 'User has an active subscription. Message allowed.',
                data: { allowed: true, message: 'paid' },
                error: null
            });
        }

        if (subscription && subscription.benefits['chatProfiles'] <= 0) {
            console.log("Benefits Exhausted!")
            return res.status(402).json({
                statusCode: 402,
                message: 'Benefits have been exhausted. Please upgrade your plan!',
                data: { allowed: false, message: 'exhausted' },
                error: null
            });
        }

        console.log("Treating as free user")

        // ---------- CASE 2: EXPIRED OR NO SUBSCRIPTION ----------
        // Treat as free user with limited messages (3 per receiver)
        let record = await MessageLimit.findOne({ senderId, receiverId });

        if (!record) {
            await MessageLimit.create({ senderId, receiverId, count: 1 });
            return res.status(200).json({
                statusCode: 200,
                message: 'First free message sent (Free Plan)',
                data: { allowed: true, message: 'free' },
                error: null
            });
        }

        if (record.count < 3) {
            record.count += 1;
            await record.save();
            return res.status(200).json({
                statusCode: 200,
                message: `Free message ${record.count} of 3 sent`,
                data: { allowed: true, message: 'free' },
                error: null
            });
        }

        // ---------- CASE 3: FREE LIMIT EXHAUSTED ----------
        return res.status(403).json({
            statusCode: 403,
            message: 'Free message limit reached. Please upgrade your plan.',
            data: { allowed: false, message: 'free' },
            error: null
        });

    } catch (error) {
        console.error('Error in checkAndIncrementMessage:', error);
        return res.status(500).json({
            statusCode: 500,
            message: 'Server error',
            data: { allowed: false, message: 'Server error' },
            error: error.message
        });
    }
};



const { RtcRole, RtcTokenBuilder } = require('agora-token');

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERT = process.env.AGORA_APP_CERTIFICATE;

// EXACTLY match Kotlin: (java String.hashCode) & 0x7fffffff
const javaStringHashCode = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; // 31*h + c
    return h; // signed 32-bit
};
const toAgoraUid = (userId) => ((javaStringHashCode(String(userId)) & 0x7fffffff) >>> 0); // 0..2^31-1

const generateRtcToken = ({ channelName, uid, ttlSeconds = 3600 }) => {
    const role = RtcRole.PUBLISHER;
    const privilegeExpireTs = Math.floor(Date.now() / 1000) + ttlSeconds;
    console.log("Rtc token creating userId: ", uid)
    const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERT,
        channelName,
        uid,
        role,
        privilegeExpireTs
    );
    return { token, channelName, uid };
};

const getRtcToken = (req, res) => {
    try {
        const rawUserId =
            (req.user && (req.user.id ?? req.user.uid)) ??
            req.body?.uid ??
            req.query?.uid;

        const channel = req.body?.channel ?? req.query?.channel;
        if (!rawUserId || !channel) {
            return res.status(400).json({ statusCode: 400, message: 'Missing uid or channel', error: 'Bad Request', data: null });
        }

        // ✅ compute the SAME uid Android uses (hash & 0x7fffffff)
        const uid = Number.isInteger(rawUserId) ? (Number(rawUserId) >>> 0) : toAgoraUid(rawUserId);

        const ttlSeconds = Number(req.body?.ttlSeconds || req.query?.ttlSeconds) || 3600;
        const result = generateRtcToken({ channelName: channel, uid, ttlSeconds });

        return res.status(200).json({
            statusCode: 200,
            message: 'Token generated successfully',
            error: null,
            data: { token: result.token, channelName: result.channelName, userId: result.uid },
        });
    } catch (error) {
        console.error('Token generation error:', error);
        return res.status(500).json({ statusCode: 500, message: 'Failed to generate token', error: error.message, data: null });
    }
};




const sendMessagePushNotification = async (req, res) => {
    // console.log("Here!! ", req.body)
    try {
        const { receiverId, message } = req.body;

        if (!receiverId || !message) {
            return res.status(400).json({
                statusCode: 400,
                error: 'Bad Request',
                message: 'receiverId and message are required'
            });
        }

        const senderId = req.user.id;

        const [receiverUser, senderUser] = await Promise.all([
            User.findById(receiverId, 'loginToken'),
            User.findById(senderId, 'fullName')
        ]);

        if (!receiverUser) {
            return res.status(404).json({
                statusCode: 404,
                error: 'Not Found',
                message: 'Receiver not found'
            });
        }

        let parsed = null;
        try { parsed = JSON.parse(message); } catch (_) { }

        var notificationParams = null;

        if (parsed && parsed.type === 'CALL') {
            // Extract call meta
            const title = parsed.title || 'Incoming Call';
            const meta = parsed.meta || {};
            const callType = meta.callType === 'VIDEO' ? 'Video' : 'Voice';
            const channelName = meta.channel;
            const userId = meta.uid;
            const rtcToken = meta.rtcToken; // may be undefined if you choose to fetch on receiver
            const callerId = meta.callerId;
            const callerPhoto = meta.callerPhoto != "" ? meta.callerPhoto : "";
            console.log("Caller ID: ", callerId);

            notificationParams = {
                title,
                body: `Call from ${senderUser?.fullName || 'Unknown'}`,
                type: 'incoming_call',
                showNotification: 'true',
                user: String(receiverId),
                senderId: String(senderId),

                // 🔑 data your receiver needs:
                callType,                       // "VIDEO" | "VOICE"
                channelName,                    // pass through from client (DO NOT hard-code)
                rtcToken,
                userId,                      // optional: speeds up join
                callerId,
                callerPhoto
            };
        } else if (parsed && parsed.type === 'call_state') {
            const title = parsed.title || "Companion";
            const meta = parsed.meta || {}
            const callerId = meta.callerId;
            const status = meta.status
            notificationParams = {
                title,
                body: `You missed a call from ${callerId || Unknown}`,
                type: 'call_state',
                showNotification: 'true',
                status: `${status}`,
                callId: ''
            }
        } else {
            console.log("This maybe a 1 to 1 message");
            // default chat message path
            notificationParams = {
                title: 'New Message Received',
                body: `${senderUser?.fullName || 'Someone'} sent you a message.`,
                type: 'chat',
                showNotification: 'true',
                user: String(receiverId),
                senderId: String(senderId),
                messageSnippet: String(message).slice(0, 100),
            };
        }

        if (receiverUser.loginToken?.deviceToken?.length > 10) {
            console.log("sending...");
            PushNotification.sendPushNotification(
                receiverUser.loginToken,
                notificationParams.title,
                notificationParams.body,
                notificationParams
            );
        }
        console.log("Sent!!!")
        return res.status(200).json({
            statusCode: 200,
            message: 'Notification sent successfully',
            error: null,
            data: null
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            statusCode: 500,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

const rekognition = new AWS.Rekognition();
const fs = require('fs');
const appVersion = require('../config/appVersion');
const { isOlderVersion } = require('../utilities/versionUtil');
const { storage } = require('firebase-admin');
const multer = require('multer')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /image\/(jpeg|png)/.test(file.mimetype);
        cb(ok ? null : new ERROR('INVALID_FILE_TYPE'), ok);
    }
});

const detectSelfie = async (imageBytes) => {
    const params = {
        Image: { Bytes: imageBytes },

        Attributes: ['EYES_OPEN', 'FACE_OCCLUDED']
    };
    return rekognition.detectFaces(params).promise();
}

const verifyFaceRekognition = [
    upload.single('selfie'),
    async (req, res) => {
        try {
            if (!req.file?.buffer) {
                return res.status(400).json({ body: { verified: false }, error: 'no_file' });
            }

            const { FaceDetails = [] } = await detectSelfie(req.file.buffer);

            const reasons = [];
            if (FaceDetails.length !== 1) {
                reasons.push(FaceDetails.length === 0 ? 'no_face' : 'multiple_faces');
            }

            const face = FaceDetails[0];
            if (face) {
                const { Pose = {}, Quality = {}, EyesOpen, FaceOccluded, BoundingBox, Confidence } = face;

                // Pose (tune thresholds for your UX)
                const yaw = Math.abs(Pose.Yaw || 0);
                const roll = Math.abs(Pose.Roll || 0);
                const pitch = Math.abs(Pose.Pitch || 0);
                if (yaw > 15 || roll > 15 || pitch > 15) reasons.push('pose_too_tilted');

                // Image quality
                const sharp = Quality.Sharpness ?? 0;
                const bright = Quality.Brightness ?? 0;
                if (sharp < 40) reasons.push('blurry');
                if (bright < 35 || bright > 95) reasons.push('bad_lighting');

                // Eyes & occlusion (when available)
                if (EyesOpen && (!EyesOpen.Value || (EyesOpen.Confidence ?? 0) < 80)) reasons.push('eyes_not_open');
                if (FaceOccluded?.Value) reasons.push('face_occluded');

                // Very small/large face in frame (helps avoid screenshots)
                const area = (BoundingBox?.Width ?? 0) * (BoundingBox?.Height ?? 0);
                if (area < 0.05) reasons.push('face_too_small');       // <5% of frame
                if ((Confidence ?? 0) < 98) reasons.push('low_confidence');
            }

            const ok = reasons.length === 0;
            return res.status(200).json({ body: { verified: ok }, message: reasons })
        } catch (err) {
            console.error("Face verification failed: ", err);
            return res.status(500).json({ body: { verified: false }, message: 'rekoginition_error' });
        }
    }
]


const checkAppVersion = async (req, res) => {
    const platform = req.query.platform; // 'android' or 'ios'
    const currentVersion = req.query.version; // app sends current version

    console.log("Running app version check")

    if (!platform || !currentVersion) {
        console.log("Error in app version check: Platform and app version are required")
        return res.status(400).json({ error: "platform and version are required" });
    }

    let minVersion = "";
    let latestVersion = "";
    let storeUrl = "";

    if (platform === "android") {
        minVersion = appVersion.minimum_android_version;
        latestVersion = appVersion.latest_android_version;
        storeUrl = appVersion.play_store_url;
    } else if (platform === "ios") {
        minVersion = appVersion.minimum_ios_version;
        latestVersion = appVersion.latest_ios_version;
        storeUrl = appVersion.app_store_url;
    } else {
        console.log("Error in app version check: Invalid Platform")
        return res.status(400).json({ error: "Invalid platform" });
    }

    const needsUpdate = isOlderVersion(currentVersion, minVersion);

    return res.status(200).json({
        latest_version: latestVersion,
        minimum_version: minVersion,
        force_update: needsUpdate,
        store_url: storeUrl
    });

};

const reportUser = async (req, res) => {
    try {
        console.log("Entered into function!")
        const { reportedUserId, reason } = req.body;

        console.log("Incoming report:", { reportedUserId, reason });
        console.log("req.user:", req.user);

        if (!reportedUserId || !reason) {
            console.warn("Missing fields in report request:", req.body);
            return res.status(400).json({ error: "Missing required fields" });
        }

        const newReport = new Reports({
            reportedUserId,
            reporterUserId: req.user?.id,  // check for undefined
            reason,
        });

        console.log("Prepared document:", newReport);

        await newReport.save();

        console.log("Report saved successfully!");

        return res.status(201).json({
            statusCode: 201,
            message: "Report submitted successfully",
            data: {
                msg: "report submitted"
            }
        });
    } catch (err) {
        console.error("Error submitting report:", err.message);
        console.error(err.stack);
        console.error("Request body:", req.body);
        console.error("Request user:", req.user);

        return res.status(500).json({ error: "Server error" });
    }
};


const getReportRecords = async (req, res) => {
    try {
        // Optional: Check if the requester is admin
        if (req.user.role !== "admin") {
            return res.status(403).json({ error: "Access denied" });
        }

        const reports = await Report.find()
            .populate("reportedUserId", "fullName email")   // populate user info
            .populate("reporterUserId", "fullName email")   // who reported
            .sort({ createdAt: -1 });

        res.json(reports);

    } catch (err) {
        console.error("Error fetching reports:", err);
        res.status(500).json({ error: "Server error" });
    }
}

const updateVOIPToken = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                statusCode: 401,
                message: 'Unauthorized',
                error: null,
                data: null,
            });
        }

        let user = await User.findOne({ _id: req.user.id }, 'loginToken');

        if (!user) {
            return res.status(404).json({
                statusCode: 404,
                message: 'User not found',
                error: null,
                data: null,
            });
        }

        // Handle only iOS devices
        if (req.body.deviceType !== 'ios') {
            return res.status(403).json({
                statusCode: 403,
                message: 'Only iOS devices have authorization!',
                error: null,
                data: null,
            });
        }

        const incomingToken = req.body.voipToken?.trim();
        const method = req.body.method;

        if (method === 'store') {
            if (!incomingToken) {
                return res.status(400).json({
                    statusCode: 400,
                    message: 'Missing voipToken',
                    error: null,
                    data: null,
                });
            }

            // 🔍 Check if the token exists for any other user
            await User.updateMany(
                { 'loginToken.voipToken': incomingToken },
                { $set: { 'loginToken.voipToken': '' } }
            );

            // ✅ Save new token for this user
            user.loginToken.voipToken = incomingToken;
            await user.save();

            return res.status(200).json({
                statusCode: 200,
                message: 'iOS VOIP Token updated',
                error: null,
                data: {
                    msg: 'Set VOIP Token for iOS',
                    token: user.loginToken.voipToken,
                },
            });
        }
        else if (method === 'delete') {
            // 🧹 Delete this user's voip token
            user.loginToken.voipToken = '';
            await user.save();

            return res.status(200).json({
                statusCode: 200,
                message: 'iOS VOIP Token deleted',
                error: null,
                data: {
                    msg: 'Deleted VOIP Token for iOS',
                    token: null,
                },
            });
        }
        else {
            return res.status(400).json({
                statusCode: 400,
                message: 'Invalid method',
                error: null,
                data: null,
            });
        }

    } catch (err) {
        console.error('Error updating VOIP token:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// helpers/subscription.js
const ensureSubscriptionAllowed = async ({ user, Subscriptions, Message }) => {
    // If the benefit requires a paid plan but the user has none
    if (!user.subscriptionId) {
        // special copy for chatProfiles if you want to keep your existing message
        // if (benefit === 'call') {
        //   return {
        //     ok: false,
        //     res: {
        //       statusCode: 403,
        //       error: 'Forbidden',
        //       message: 'You are currently on a free plan.'
        //     }
        //   };
        // }
        return {
            ok: false,
            res: {
                statusCode: 403,
                error: 'Forbidden',
                message: Message.subsriptionNotFound || 'Subscription not found.',
                data: {
                    allowed: false,
                    message: 'Upgrade to a paid plant to send audio and video calls.'
                }
            }
        };
    }

    // Load subscription
    const subscription = await Subscriptions.findById(
        user.subscriptionId,
        'benefits subscriptionStatus planExpiredOn'
    );

    if (!subscription) {
        return {
            ok: false,
            res: {
                statusCode: 403,
                error: 'Forbidden',
                message: Message.subsriptionNotFound || 'Subscription not found.',
                data: {
                    allowed: false,
                    message: 'Upgrade to a paid plant to send audio and video calls.'
                }
            }
        };
    }

    // Status must be active (tweak as per your enum)
    if (!isActiveEntitlement(subscription)) {
        return {
            ok: false,
            res: {
                statusCode: 403,
                error: 'Forbidden',
                message: Message.subscriptionExpired || 'Subscription expired.',
                data: {
                    allowed: false,
                    message: 'Your subscription has expire, please upgrade your plan.'
                }
            }
        };
    }

    // Benefit must exist and be > 0
    //   const count = subscription.benefits?.[benefit];
    //   if (typeof count !== 'number') {
    //     return {
    //       ok: false,
    //       res: {
    //         statusCode: 403,
    //         error: 'Forbidden',
    //         message: `Benefit '${benefit}' not available on your plan.`
    //       }
    //     };
    //   }

    //   if (count <= 0) {
    //     return {
    //       ok: false,
    //       res: {
    //         statusCode: 402,
    //         error: 'Benefits Exhausted',
    //         message: Message.benefitsLess || 'Benefit usage limit reached.'
    //       }
    //     };
    //   }

    return {
        ok: true, subscription, statusCode: 404, res: {
            statusCode: 403,
            error: 'Forbidden',
            message: Message.subsriptionNotFound || 'Subscription not found.',
            data: {
                allowed: false,
                message: '403 - Something went wrong.'
            }
        }
    };
};

const canSendCall = async (req, res) => {
    try {
        let user = await User.findOne({ _id: req.user.id }, 'subscriptionId');
        if (!user) {
            return res.status(400).json({ error: 'Bad Request', data: null, message: 'User not found!' });
        }
        const check = await ensureSubscriptionAllowed({
            user,
            Subscriptions,
            Message,
        });
        if (!check.ok) {
            return res.status(check.res.statusCode).json({
                statusCode: check.res.statusCode,
                data: {
                    allowed: false,
                    message: check.res.message
                }
            });
        }

        return res.status(200).json({
            statusCode: 200,
            message: 'Calling is allowed!',
            error: null,
            data: {
                message: "allowed",
                allowed: true,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: "Something went wrong", data: null, message: error.message });
    }
};






module.exports = {
    getCountryCodesAndFlags,
    requestOtp,
    verifyOtp,
    addUpdateMandatoryDetails,
    getMandatoryDetails,
    getAboutDetails,
    updateAboutDetails,
    getBasicDetails,
    updateBasicDetails,
    updateInterestsByType,
    getInterestsByType,
    createNewTicket,
    getNotifications,
    addAllNotifications,
    uploadFileByType,
    getMyPhotos,
    setProfileFromGallery,
    deletePhotoFromGallery,
    getHomeUsers,
    getHomeUsersPost,
    getTopUsers,
    getUserDetailsById,
    logout,
    approveGalleryImageById,
    getKycDetails,
    uploadKycDocumentsByType,
    getCommunity,
    setUserId,
    getLoginOtp,
    getMaster,
    createInAppSubscription,
    verifyInAppSubscription,
    getPlanDetails,
    regenerateChatToken,
    updateBenefitByType,
    login,
    sendPushNotificatioByType,
    getGalleryPendingRequest,
    verifyAccount,
    approveAllPhotos,
    deleteUser,
    getUnverifiedUsers,
    appleSubscription,
    androidSubscription,
    getAllUsers,
    sendPushNotificationToAll,
    getAdminPushNotifications,
    updateLocation,
    updateOnlineStatus,
    getCoordinates,
    getOnlineUsersSorted,
    checkAndIncrementMessage,
    getRtcToken,
    sendMessagePushNotification,
    verifyFaceRekognition,
    checkAppVersion,
    reportUser,
    getReportRecords,
    updateVOIPToken,
    canSendCall
}
