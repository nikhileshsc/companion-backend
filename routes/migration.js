/**
 * One-time data migration route: syncs users from the old AWS/Atlas
 * database into this (Railway) database. Safe to run multiple times —
 * matches on _id and upserts, so it never creates duplicates and never
 * touches users that already exist here correctly.
 *
 * Protected by a shared secret (MIGRATION_SECRET env var) so it can't be
 * triggered by anyone who doesn't already have access to this backend's
 * environment variables.
 *
 * Delete this file (and the route mount in startup/routes.js) once the
 * mobile app has fully cut over to this backend and this is no longer
 * needed.
 */

const express = require('express');
const mongoose = require('mongoose');
const { updateRegisterMetaData } = require('../utilities/agora');
const { User } = require('../models/user');
const router = express.Router();

function checkSecret(req, res, next) {
    const provided = req.headers['x-migration-secret'] || req.query.secret;
    if (!provided || provided !== process.env.MIGRATION_SECRET) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

async function runUserSync(req, res) {
    if (!process.env.ATLAS_MONGODB_URI) {
        return res.status(500).json({ success: false, error: 'ATLAS_MONGODB_URI is not configured' });
    }

    let atlasConnection;
    try {
        atlasConnection = await mongoose.createConnection(process.env.ATLAS_MONGODB_URI, {}).asPromise();

        // Loose schema — we just want the raw documents, not validation,
        // since we're copying data as-is rather than constructing new docs.
        const AtlasUser = atlasConnection.model(
            'MigrationSourceUser',
            new mongoose.Schema({}, { strict: false, collection: 'users' })
        );

        const localUsersCollection = mongoose.connection.collection('users');

        const atlasUsers = await AtlasUser.find({}).lean();

        let inserted = 0;
        let updated = 0;
        const errors = [];

        for (const doc of atlasUsers) {
            try {
                const result = await localUsersCollection.updateOne(
                    { _id: doc._id },
                    { $set: doc },
                    { upsert: true }
                );
                if (result.upsertedCount > 0) {
                    inserted++;
                } else {
                    updated++;
                }
            } catch (err) {
                errors.push({ id: String(doc._id), error: err.message });
            }
        }

        res.json({
            success: true,
            totalUsersInAtlas: atlasUsers.length,
            newlyInsertedIntoRailway: inserted,
            alreadyPresentUpdated: updated,
            errorCount: errors.length,
            errors: errors.slice(0, 20), // cap output size
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (atlasConnection) {
            await atlasConnection.close().catch(() => {});
        }
    }
}

// Supports GET (so it can be triggered by just visiting the URL) and POST.
router.get('/run-users-sync', checkSecret, runUserSync);
router.post('/run-users-sync', checkSecret, runUserSync);

/**
 * List admin/staff accounts (email + name + active status only — never
 * the password hash) so you can see which accounts actually exist to log
 * in with.
 */
router.get('/list-staff', checkSecret, async (req, res) => {
    try {
        const Staff = mongoose.connection.collection('staffs');
        const staff = await Staff.find(
            {},
            { projection: { email: 1, firstName: 1, lastName: 1, isActive: 1, role: 1, _id: 0 } }
        ).toArray();
        res.json({ success: true, count: staff.length, staff });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * Reset a staff member's password to a known value you choose.
 * Usage: POST with JSON body { "email": "...", "newPassword": "..." }
 * and the same secret as the other endpoints.
 */
router.post('/reset-staff-password', checkSecret, async (req, res) => {
    try {
        const { email, newPassword } = req.body || {};
        if (!email || !newPassword) {
            return res.status(400).json({ success: false, error: 'email and newPassword are required in the JSON body' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'newPassword must be at least 8 characters' });
        }

        const bcrypt = require('bcrypt');
        const hashed = await bcrypt.hash(newPassword, 10);

        const Staff = mongoose.connection.collection('staffs');
        const result = await Staff.updateOne(
            { email: email.toLowerCase() },
            { $set: { password: hashed } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'No staff account found with that email' });
        }

        res.json({ success: true, message: `Password updated for ${email}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * Same as /reset-staff-password, but targets the AWS/Atlas database
 * instead of this (Railway) database. Needed because the currently
 * deployed admin panel frontend build calls an AWS API Gateway proxy
 * that forwards to the AWS Elastic Beanstalk backend, which reads from
 * Atlas — not Railway.
 * Usage: POST with JSON body { "email": "...", "newPassword": "..." }
 * and the same secret as the other endpoints.
 */
router.post('/reset-staff-password-atlas', checkSecret, async (req, res) => {
    if (!process.env.ATLAS_MONGODB_URI) {
        return res.status(500).json({ success: false, error: 'ATLAS_MONGODB_URI is not configured' });
    }

    const { email, newPassword } = req.body || {};
    if (!email || !newPassword) {
        return res.status(400).json({ success: false, error: 'email and newPassword are required in the JSON body' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'newPassword must be at least 8 characters' });
    }

    let atlasConnection;
    try {
        atlasConnection = await mongoose.createConnection(process.env.ATLAS_MONGODB_URI, {}).asPromise();

        const bcrypt = require('bcrypt');
        const hashed = await bcrypt.hash(newPassword, 10);

        const AtlasStaff = atlasConnection.collection('staffs');
        const result = await AtlasStaff.updateOne(
            { email: email.toLowerCase() },
            { $set: { password: hashed } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'No staff account found with that email in Atlas' });
        }

        res.json({ success: true, message: `Password updated in Atlas for ${email}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (atlasConnection) {
            await atlasConnection.close().catch(() => {});
        }
    }
});

/**
 * List staff accounts from Atlas (the database the current admin
 * frontend build actually authenticates against via the AWS proxy).
 */
router.get('/list-staff-atlas', checkSecret, async (req, res) => {
    if (!process.env.ATLAS_MONGODB_URI) {
        return res.status(500).json({ success: false, error: 'ATLAS_MONGODB_URI is not configured' });
    }
    let atlasConnection;
    try {
        atlasConnection = await mongoose.createConnection(process.env.ATLAS_MONGODB_URI, {}).asPromise();
        const AtlasStaff = atlasConnection.collection('staffs');
        const staff = await AtlasStaff.find(
            {},
            { projection: { email: 1, firstName: 1, lastName: 1, isActive: 1, role: 1, _id: 0 } }
        ).toArray();
        res.json({ success: true, count: staff.length, staff });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (atlasConnection) {
            await atlasConnection.close().catch(() => {});
        }
    }
});

/**
 * Diagnostic only: mirrors the exact login lookup + bcrypt compare
 * against Atlas, to isolate whether a failure is due to record lookup,
 * password mismatch, or something else — without any curl/shell quoting
 * ambiguity. Never returns the hash itself.
 */
router.post('/test-atlas-login', checkSecret, async (req, res) => {
    if (!process.env.ATLAS_MONGODB_URI) {
        return res.status(500).json({ success: false, error: 'ATLAS_MONGODB_URI is not configured' });
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'email and password are required' });
    }

    let atlasConnection;
    try {
        atlasConnection = await mongoose.createConnection(process.env.ATLAS_MONGODB_URI, {}).asPromise();
        const bcrypt = require('bcrypt');
        const AtlasStaff = atlasConnection.collection('staffs');

        const staff = await AtlasStaff.findOne({ email: email.toLowerCase() });
        if (!staff) {
            return res.json({ success: true, staffFound: false });
        }

        const passwordFieldType = typeof staff.password;
        const passwordLength = staff.password ? staff.password.length : 0;
        const hashPrefix = staff.password ? staff.password.substring(0, 7) : null;
        const passwordMatches = staff.password ? await bcrypt.compare(password, staff.password) : false;

        res.json({
            success: true,
            staffFound: true,
            isActive: staff.isActive,
            passwordFieldType,
            passwordLength,
            hashPrefix, // e.g. "$2b$10$" if a real bcrypt hash
            passwordMatches,
            receivedPasswordLength: password.length,
            receivedPasswordCharCodes: [...password].map(c => c.charCodeAt(0)), // reveals hidden/extra characters
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (atlasConnection) {
            await atlasConnection.close().catch(() => {});
        }
    }
});

/**
 * One-time backfill: pushes every existing user's profile photo
 * (profileUrl) into Agora Chat's per-user avatar metadata
 * (updateRegisterMetaData / PUT metadata/user/{username}) for any user
 * who already has both an Agora chat registration (agoraChatUid) and a
 * profileUrl, but whose Agora avatar metadata predates the sync being
 * wired into every profile-photo-setting code path. Fixes the Android
 * message list showing a placeholder icon instead of the other user's
 * real photo for existing conversations, without needing an app update -
 * the Android client already reads avatarUrl from Agora's UserInfo, this
 * just makes sure that value actually gets set for users who already had
 * a photo before the sync hooks existed everywhere they were needed.
 *
 * Safe to run multiple times - it's just re-pushing the same metadata.
 * Rate-limited (sequential with a small delay) to avoid hammering the
 * Agora Chat REST API. Protected by the same MIGRATION_SECRET as the
 * other routes in this file.
 */
async function backfillAgoraAvatars(req, res) {
    try {
        const users = await User.find(
            { agoraChatUid: { $exists: true, $ne: null }, profileUrl: { $exists: true, $ne: '' } },
            '_id fullName profileUrl agoraChatUid'
        ).lean();

        let synced = 0;
        const errors = [];
        const delayMs = Number(req.query.delayMs || 150);

        for (const user of users) {
            try {
                await updateRegisterMetaData(user);
                synced++;
            } catch (err) {
                errors.push({ id: String(user._id), error: err.message });
            }
            if (delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        res.json({
            success: true,
            totalEligibleUsers: users.length,
            synced,
            errorCount: errors.length,
            errors: errors.slice(0, 20),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

router.get('/backfill-agora-avatars', checkSecret, backfillAgoraAvatars);
router.post('/backfill-agora-avatars', checkSecret, backfillAgoraAvatars);

module.exports = router;
