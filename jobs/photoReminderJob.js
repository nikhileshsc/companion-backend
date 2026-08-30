const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const PushNotification = require('../utilities/push_notification');

const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0));

cron.schedule('00 11 * * *', async () => {
    console.log("⏰ [CRON] Running daily profile photo reminder...");

    try {
        const today = startOfToday();

        const users = await User.find({
            profileUrl: { $in: [null, '', undefined] },
            "loginToken.deviceToken": { $type: "string" },
            $or: [
                { lastProfilePhotoReminder: { $lt: today } },
                { lastProfilePhotoReminder: { $exists: false } }
            ]
        }, 'fullName loginToken lastProfilePhotoReminder');

        if (!users.length) {
            console.log("[CRON] No users to notify.");
            return;
        }

        const message = 'Hi there, your profile looks incomplete. Upload a photo now!';
        let notifiedCount = 0;

        for (const user of users) {
            const token = user.loginToken?.deviceToken;
            const sessionJwt  = user.loginToken?.token;


            // Skip invalid or short tokens
            if (!token || token.length < 10) {
                console.log(`[CRON] ⏩ Skipping user ${user.fullName} due to missing/invalid token`);
                continue;
            }

            try {
                
                const notificationTitle = "👤 Add Your Profile Photo";
                const notificationBody = `${user.fullName || 'Hi there'}, your profile looks incomplete. Upload a photo now!`;

                await PushNotification.sendPushNotification(
                    user.loginToken,
                    notificationTitle,
                    notificationBody,
                    {
                        type: 'reminder-profile-photo',
                        showNotifications: "true",
                        user: String(user._id)
                    }
                );

                user.lastProfilePhotoReminder = new Date();
                await user.save();

                notifiedCount++;
                console.log(`[CRON] ✅ Reminder sent to user: ${user.fullName} (${user._id})`);
            } catch (err) {
                const errCode = err?.errorInfo?.code;
                console.log(err)

                if (errCode === 'messaging/registration-token-not-registered') {
                    console.warn(`[CRON] 🚫 Invalid FCM token for user ${user.fullName}. Removing from DB.`);
                    user.loginToken.deviceToken = null;
                    await user.save();
                } else {
                    console.error(`[CRON] ❌ Failed to send to ${user._id}:`, err.message);
                }
            }
        }

        console.log(`[CRON] ✅ Sent profile photo reminders to ${notifiedCount} user(s).`);
    } catch (error) {
        console.error("[CRON] ❌ Error in profile reminder job:", error.message);
    }
});
