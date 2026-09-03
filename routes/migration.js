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

module.exports = router;
