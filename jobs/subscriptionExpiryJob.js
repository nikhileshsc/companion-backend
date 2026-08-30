const cron = require('node-cron');
const { Subscriptions } = require('../models/subscription');
const { User } = require('../models/user');

async function expireSubscriptions() {
    const now = new Date();
    const expired = await Subscriptions.find({ subscriptionStatus: 'Active', planExpiredOn: { $type: 'date', $lte: now } }, '_id user');
    if (!expired.length) return;
    const ids = expired.map((subscription) => subscription._id);
    await Subscriptions.updateMany({ _id: { $in: ids }, subscriptionStatus: 'Active' }, { $set: { subscriptionStatus: 'Expired' } });
    await User.updateMany({ subscriptionId: { $in: ids } }, { $set: { subscriptionStatus: 'Expired' } });
    console.info('subscription_expired', { count: ids.length });
}

cron.schedule('7 * * * *', () => expireSubscriptions().catch((error) => console.error('subscription_expiry_failed', { code: error.code || error.name })));

module.exports = { expireSubscriptions };
