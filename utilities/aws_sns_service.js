
var AWS = require('aws-sdk');
const { maskDestination, normalizeIndianSmsDestination } = require('./otpDestination');

//------ Send OTP -------------------
const sendMessage = (messageData) => {
    const destination = normalizeIndianSmsDestination(messageData && messageData.to);
    if (!destination) {
        const error = new Error('SMS delivery is restricted to valid Indian mobile numbers.');
        error.code = 'SMS_DESTINATION_NOT_ALLOWED';
        console.warn('otp_sms_blocked', { channel: 'sms', normalizedDestination: maskDestination(messageData && messageData.to) });
        return Promise.reject(error);
    }

    AWS.config.update({
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,// config.AWS_SECRET_ACCESS_KEY,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, // config.AWS_ACCESS_KEY_ID,
        region: process.env.AWS_REGION
    });


    return new Promise(function (resolve, reject) {
    // create sns object to set sms attributes and publish otp
    var sns = new AWS.SNS({ apiVersion: '2010-03-31' })

    sns.setSMSAttributes({ attributes: { DefaultSMSType: "Transactional" } }, function (err, data) {
        if (err) {
            return reject(err);
        }
        // after set sms attributes send otp with following params

        var params2 = {
            Message: messageData.sms, /* required */
            PhoneNumber: destination,
            MessageAttributes: {
                'AWS.SNS.SMS.SenderID': {
                    'DataType': 'String',
                    'StringValue': 'ATRCOM'
                },
                'AWS.MM.SMS.EntityId': {
                    'DataType': 'String',
                    'StringValue': '1201173157955205321'
                },
                'AWS.MM.SMS.TemplateId': {
                    'DataType': 'String',
                    'StringValue': messageData.templateId
                }
            },
            // TopicArn: process.env.AWS_SNS_SMS_TOPIC_ARN
        };
        // Final fail-closed guard immediately before the AWS SMS request.
        if (!normalizeIndianSmsDestination(params2.PhoneNumber)) {
            const error = new Error('SMS delivery is restricted to valid Indian mobile numbers.');
            error.code = 'SMS_DESTINATION_NOT_ALLOWED';
            console.warn('otp_sms_blocked', { channel: 'sms', normalizedDestination: maskDestination(params2.PhoneNumber) });
            return reject(error);
        }

        console.info('otp_sms_dispatch', { channel: 'sms', country: 'IN', normalizedDestination: maskDestination(params2.PhoneNumber) });
        sns.publish(params2, function (err, data) {
            if (err) {
                return resolve({ err: err });
            }
            resolve({ data: data })
        });
    });
})
};




module.exports = {
    sendMessage,
}
