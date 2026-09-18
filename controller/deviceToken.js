const { User } = require('../models/user');

// Refreshes the FCM device token for the currently logged-in user without
// requiring a full re-login. FCM rotates its token periodically (app
// reinstall, Play Services update, app data cleared, token expiry) and the
// app previously only ever sent a fresh token to the backend once, during
// OTP verification (controller/user.js verifyOtp). Once a token went stale,
// a later push failing with 'registration-token-not-registered' (see
// jobs/photoReminderJob.js) would null it out in the DB, and nothing ever
// wrote a new one back in - silently and permanently breaking push
// notifications, interest popups, and badges for that account until the
// next full logout+login. Confirmed live: two of three spot-checked test
// accounts in the production DB currently have an empty
// loginToken.deviceToken. The Android app's FCM onNewToken() callback now
// calls this endpoint whenever the token rotates.
const updateDeviceToken = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                statusCode: 401,
                message: 'Unauthorized',
                error: null,
                data: null,
            });
        }

        const incomingToken = req.body.deviceToken?.trim();
        if (!incomingToken) {
            return res.status(400).json({
                statusCode: 400,
                message: 'Missing deviceToken',
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

        user.loginToken.deviceToken = incomingToken;
        if (req.body.deviceType) {
            user.loginToken.deviceType = req.body.deviceType;
        }
        await user.save();

        return res.status(200).json({
            statusCode: 200,
            message: 'Device token updated',
            error: null,
            data: { deviceToken: user.loginToken.deviceToken },
        });
    } catch (error) {
        console.error('update_device_token_failed', { error: error.message });
        return res.status(500).json({
            statusCode: 500,
            message: 'Unable to update device token',
            error: error.message,
            data: null,
        });
    }
};

module.exports = {
    updateDeviceToken,
};
