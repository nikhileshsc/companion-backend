/**
 * Express middleware: keeps Agora Chat's per-user avatar metadata in sync
 * whenever a user's profile photo is set as a side effect of gallery-photo
 * approval (approveGalleryImageById auto-sets a brand-new user's very
 * first photo as their profile photo the moment it's approved).
 *
 * That's the one profile-photo-setting code path in the app that never
 * synced to Agora the way setProfileFromGallery / addUpdateMandatoryDetails
 * already do - so a new user's first photo never reached Agora, and the
 * Android message list fell back to a placeholder icon for most
 * conversations, since it reads avatars from Agora's own UserInfo store.
 *
 * Implemented as a small middleware instead of editing the existing
 * approveGalleryImageById handler in controller/user.js directly, to keep
 * this fix an isolated, easy-to-review diff. It listens for the response's
 * 'finish' event (fired exactly once, whatever combination of res.json /
 * res.send / res.end the handler used) and fires the sync afterwards,
 * without changing that handler's behavior or response at all. Safe to run
 * on every call (including rejections) - it's a no-op unless the user now
 * has both an agoraChatUid and a profileUrl, and re-pushing the same
 * metadata is harmless.
 */

const { User } = require('../models/user');
const { updateRegisterMetaData } = require('../utilities/agora');

async function syncAfterApprove(userId) {
    try {
        if (!userId) return;
        const user = await User.findOne({ _id: userId }, 'fullName profileUrl agoraChatUid');
        if (user && user.agoraChatUid && user.profileUrl) {
            await updateRegisterMetaData(user);
        }
    } catch (err) {
        console.error('agoraAvatarSync: sync after approve failed', err.message || err);
    }
}

function agoraAvatarSyncAfterApprove(req, res, next) {
    res.on('finish', () => {
        syncAfterApprove(req.body && req.body.userId);
    });
    next();
}

module.exports = { agoraAvatarSyncAfterApprove };
