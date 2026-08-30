
var AWS = require('aws-sdk');
const _ = require('lodash')
var { companionFirbase } = require('../utilities/initialize-firebase')
const sendPushNotificationFromAws = (notificationData, cb) => {
    AWS.config.update({
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,// config.AWS_SECRET_ACCESS_KEY,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, // config.AWS_ACCESS_KEY_ID,
        region: process.env.AWS_REGION
    });

    let sns = new AWS.SNS();
    console.log('in ')

    sns.publish(notificationData, function (err, data) {
        if (err) {
            // console.log('err in sending notification ', err)
            cb({ data: err })

        } else {
            // console.log('success in sending notification ', data);
            cb({ data: data })
        }
        return;
    });
};

async function sendNotificationToMyTeamForIos(loginToken, title, body, data) {
    try {

        let arn = loginToken.arn
        data = JSON.stringify(data)
        data = JSON.parse(data)
        console.log(title, body, data)
        sound = 'default.wav'
        let getDataOtherThanTitleAndBody = _.omit(data, ['title', 'body'])
        var gcmData = {
            'data': {
                'message': body,
                'title': title,
                'body': body,
                'sound': sound,
                'content_available': true,
                'priority': 'high',
                'type': data.type


            }
        };
        gcmData.data = Object.assign(gcmData.data, getDataOtherThanTitleAndBody)
        var apnsData = {
            'aps': {
                'alert': body,
                'type': data.type,
                'sound': sound,
                "badge": 1

            }
        };
        apnsData = Object.assign(apnsData, getDataOtherThanTitleAndBody)
        let notificationData = {
        }
        let silentPushNotificationData = {}
        let silentApnsData = {
            'aps': {
                'content-available': true,
            },
        };
        silentApnsData = Object.assign(silentApnsData, getDataOtherThanTitleAndBody)
        if (loginToken.isSandboxmode) {
            notificationData = {
                'default': body,
                'GCM': JSON.stringify(gcmData),
                'APNS_SANDBOX': JSON.stringify(apnsData),
            };
            silentPushNotificationData = {
                'default': body,
                'GCM': JSON.stringify(gcmData),
                'APNS_SANDBOX': JSON.stringify(silentApnsData),
            };
        } else {
            notificationData = {
                'default': body,
                'GCM': JSON.stringify(gcmData),
                'APNS': JSON.stringify(apnsData),
            };
            silentPushNotificationData = {
                'default': body,
                'GCM': JSON.stringify(gcmData),
                'APNS': JSON.stringify(silentApnsData),
            };
        }
        const params = {
            TargetArn: arn,
            MessageStructure: 'json',
            Message: JSON.stringify(notificationData)
        };
        const silentPushNotificationParams = {
            TargetArn: arn,
            MessageStructure: 'json',
            Message: JSON.stringify(silentPushNotificationData)
        };
        // console.log('arn ', arn)
        console.log(' show ios', data.showNotification)
        if (data.showNotification) {
            console.log('insied show ios')
            sendPushNotificationFromAws(params, notificationRes => {
                console.log('notificationRes ', notificationRes)
            });
        } else {
            sendPushNotificationFromAws(silentPushNotificationParams, notificationRes => {
                console.log('silentPushNotificationParams ', notificationRes)
            });
        }
    } catch (e) {
        console.log(e.message);
    }
}

const { sendVoipPush } = require('../utilities/apns-voip')

const stringifyValues = (obj = {}) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v == null ? '' : String(v)]));


async function sendPushNotification(loginToken, title, body, data) {

    try {
        const base = typeof data === 'string' ? JSON.parse(data) : (data || {});
        const payloadData = stringifyValues({ title, body, ..._.omit(base, ['title', 'body']) });

        const isCall = base.type === 'incoming_call' || base.type === 'call_state';
        // const typeCall = base.type === 'incoming_call';
        const typeCallState = base.type === 'call_state';
        const wantsVisibleAlert = !!title || !!body || isCall; // show a banner
        const ttlSeconds = Number(base.ttlSeconds || 120);
        const apnsExpiration = Math.floor(Date.now() / 1000) + ttlSeconds;
        const apnsCollapseId = base.callId ? `call-${base.callId}` : undefined;

        // ---- iOS CallKit via APNs VoIP (preferred for calls) ----

        if (loginToken.deviceType === 'ios' && isCall && loginToken.voipToken) {
            console.log("✅It is ios voip call!")
            const voipToken = loginToken.voipToken;
            await sendVoipPush(voipToken, {
                ...payloadData,
                apnsExpiration,
                apnsCollapseId,
            });
            console.log('[APNs-VoIP] sent to iOS (voipToken).');
            if (!typeCallState) {
                return;
            }
        }

        // ---- FCM (Android + iOS fallback) ----
        // Choose APNs headers/payload correctly:
        let apnsHeaders, apnsAps;

        if (wantsVisibleAlert) {
            // VISIBLE NOTIFICATION
            apnsHeaders = {
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-expiration': String(apnsExpiration),
                ...(apnsCollapseId ? { 'apns-collapse-id': apnsCollapseId } : {})
            };
            apnsAps = {
                alert: { title, body },
                sound: 'default',
                badge: 0
                // omit content-available here for pure alerts
            };
        } else {
            // SILENT BACKGROUND
            apnsHeaders = {
                'apns-push-type': 'background',
                'apns-priority': '5',
                'apns-expiration': String(apnsExpiration),
                ...(apnsCollapseId ? { 'apns-collapse-id': apnsCollapseId } : {})
            };
            apnsAps = { 'content-available': 1 };
        }

        const fcmMsg = {
            token: loginToken.deviceToken,              // MUST be an FCM registration token
            data: payloadData,                           // strings only (you already stringify)
            android: {
                priority: 'high'                           // data-only on Android; show your own notif in receiver
            },
            apns: {
                headers: apnsHeaders,
                payload: { aps: apnsAps }
            },
            // Optionally include notification block for iOS & Android auto-display:
            ...(wantsVisibleAlert ? { notification: { title, body } } : {})
        };

        await companionFirbase.messaging().send(fcmMsg);
        console.log('[FCM] sent (android or ios-fallback).');
    } catch (e) {
        console.error('sendPushNotification error:', e?.message || e);
    }
}



async function sendPushNotificationToMultipleUsers(users, title, body, data) {
    try {
        // if(loginToken.deviceType === 'android'){
        data = JSON.stringify(data)
        data = JSON.parse(data)
        let getDataOtherThanTitleAndBody = _.omit(data, ['title', 'body'])
        let firebaseToken = ''
        let payload = {
            token: '',
            data: {
                title: title,
                body: body,
            },
            apns: {
                payload: {
                    aps: {
                        // 'mutable-content': 1,
                        alert: body,
                        'content-available': 1,
                    }
                },
            }
        }
        payload.data = Object.assign(payload.data, getDataOtherThanTitleAndBody)
        console.log('payload ', payload)
        console.log('payload ', payload.apns)
        for (let user of users) {
            firebaseToken = user.loginToken.deviceToken
            const options = {
                priority: 'high',
                timeToLive: 60 * 60 * 24, // 1 day

            };
            payload.token = firebaseToken

            companionFirbase.messaging().send(payload)
                .then((response) => {
                    // Response is a message ID string.
                    console.log('Successfully sent message:', response);
                })
                .catch((error) => {
                    console.log('Error sending message:', error);
                })
        }
        // }else{
        //     sendNotificationToMyTeamForIos(loginToken, title, body, data)
        // }
    } catch (e) {
        console.log('error in not ', e)
        console.log(e.message);
    }
}
module.exports = {
    sendPushNotificationFromAws,
    sendNotificationToMyTeamForIos,
    sendPushNotification,
    sendPushNotificationToMultipleUsers
}