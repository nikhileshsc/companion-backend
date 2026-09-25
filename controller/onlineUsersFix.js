/**
 * Standalone replacement for the original getOnlineUsersSorted handler in
 * controller/user.js. Kept in its own small file (rather than editing the
 * ~3,400-line controller/user.js in place) so this fix is easy to review
 * and land as a small, isolated diff.
 *
 * Bug this fixes: the original handler read the requesting user's location
 * only from User.location.coordinates, which nothing in either the Android
 * app or this backend ever writes - it stays the schema default [0, 0] for
 * every user. So this endpoint returned HTTP 400 ("location not set") for
 * every request, every time, which is why the Android "Online Users" screen
 * got stuck on "Loading..." forever.
 *
 * The Android app (CompanionApi.getOnlineUsers) already sends latitude and
 * longitude as query params on this exact request - the original handler
 * just never read them. This version falls back to those query params when
 * the stored location is unset, and persists them onto the user record so
 * future requests (and other location-based features) don't need to resend
 * them.
 *
 * Everything else below is unchanged from the original handler.
 */

const mongoose = require('mongoose');
const { User } = require('../models/user');

const getOnlineUsersSorted = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Fetch current user's location and blocked users
        const currentUser = await User.findById(userId).select('location gender blockedUsers');

        const { pageNumber = 1, perPage = 20, latitude: queryLat, longitude: queryLng } = req.query;

        let [lng, lat] = (currentUser && currentUser.location && currentUser.location.coordinates) || [0, 0];

        // Stored location is missing/unset (still [0,0]) - fall back to the
        // latitude/longitude this request already sends, and persist it so
        // future requests don't need to resend it.
        if (!lng && !lat) { lng = 0; lat = 0; }
        if (lng === 0 && lat === 0) {
            const parsedLat = parseFloat(queryLat);
            const parsedLng = parseFloat(queryLng);

            if (!isNaN(parsedLat) && !isNaN(parsedLng) && !(parsedLat === 0 && parsedLng === 0)) {
                lat = parsedLat;
                lng = parsedLng;

                await User.findByIdAndUpdate(userId, {
                    location: { type: "Point", coordinates: [lng, lat] }
                });
            } else {
                return res.status(400).json({
                    statusCode: 400,
                    message: "Location not found. Please enable location services.",
                });
            }
        }

        // Convert self and blocked user IDs to ObjectId
        const excludedUserIds = [
            new mongoose.Types.ObjectId(userId),
            ...(currentUser.blockedUsers || []).map(id => new mongoose.Types.ObjectId(id))
        ];

        const fiveMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

        // Geo query to get sorted nearby online users (excluding [0,0])
        const users = await User.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lng, lat] },
                    distanceField: "distance",
                    spherical: true,
                    query: {
                        _id: { $nin: excludedUserIds },
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

module.exports = { getOnlineUsersSorted };
