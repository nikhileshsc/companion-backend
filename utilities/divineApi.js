const axios = require('axios');

// DivineAPI requires two credentials: an account-level Auth Token (sent as a
// Bearer header) and an API key (sent in the request body). Both come from
// the DivineAPI dashboard (divineapi.com) and must be set in the environment
// as DIVINE_API_KEY and DIVINE_AUTH_TOKEN.
const DIVINE_API_KEY = process.env.DIVINE_API_KEY;
const DIVINE_AUTH_TOKEN = process.env.DIVINE_AUTH_TOKEN;

// The app's primary user base is India-based; DivineAPI needs a numeric UTC
// offset per request rather than an IANA timezone name.
const DEFAULT_TZONE = 5.5;

function assertConfigured() {
    if (!DIVINE_API_KEY || !DIVINE_AUTH_TOKEN) {
        const err = new Error('DivineAPI is not configured: set DIVINE_API_KEY and DIVINE_AUTH_TOKEN in the environment.');
        err.code = 'DIVINE_API_NOT_CONFIGURED';
        throw err;
    }
}

async function postForm(url, body) {
    assertConfigured();
    const params = new URLSearchParams({ api_key: DIVINE_API_KEY, ...body });
    const response = await axios.post(url, params, {
        headers: {
            Authorization: `Bearer ${DIVINE_AUTH_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
    });
    return response.data;
}

/**
 * Free daily horoscope for a zodiac sign.
 * sign must be one of: aries, taurus, gemini, cancer, leo, virgo, libra,
 * scorpio, sagittarius, capricorn, aquarius, pisces (lowercase).
 */
async function getDailyHoroscope(sign) {
    const today = new Date();
    return postForm('https://astroapi-5.divineapi.com/api/v5/daily-horoscope', {
        sign: String(sign).toLowerCase(),
        day: today.getUTCDate(),
        month: today.getUTCMonth() + 1,
        year: today.getUTCFullYear(),
        tzone: DEFAULT_TZONE,
        h_day: 'today',
    });
}

// Shared shape for one person's birth details, used by every matching endpoint.
function personPayload(prefix, person) {
    return {
        [`${prefix}_full_name`]: person.fullName,
        [`${prefix}_day`]: person.day,
        [`${prefix}_month`]: person.month,
        [`${prefix}_year`]: person.year,
        [`${prefix}_hour`]: person.hour,
        [`${prefix}_min`]: person.min,
        [`${prefix}_sec`]: person.sec ?? 0,
        [`${prefix}_gender`]: person.gender,
        [`${prefix}_place`]: person.place,
        [`${prefix}_lat`]: person.lat,
        [`${prefix}_lon`]: person.lon,
        [`${prefix}_tzone`]: person.tzone ?? DEFAULT_TZONE,
    };
}

/** Overall 36-point Ashtakoot Milan compatibility score + per-koota breakdown. */
async function getAshtakootMilan(person1, person2) {
    return postForm('https://astroapi-3.divineapi.com/indian-api/v2/ashtakoot-milan', {
        ...personPayload('p1', person1),
        ...personPayload('p2', person2),
    });
}

/** Manglik (Mangal) Dosha for both partners individually + combined verdict. */
async function getMatchingManglikDosha(person1, person2) {
    return postForm('https://astroapi-3.divineapi.com/indian-api/v2/matching/manglik-dosha', {
        ...personPayload('p1', person1),
        ...personPayload('p2', person2),
    });
}

/** Planetary positions (house, sign, nakshatra) for a single person's chart. */
async function getPlanetaryPositions(person) {
    return postForm('https://astroapi-3.divineapi.com/indian-api/v2/planetary-positions', {
        full_name: person.fullName,
        day: person.day,
        month: person.month,
        year: person.year,
        hour: person.hour,
        min: person.min,
        sec: person.sec ?? 0,
        gender: person.gender,
        place: person.place,
        lat: person.lat,
        lon: person.lon,
        tzone: person.tzone ?? DEFAULT_TZONE,
    });
}

module.exports = {
    getDailyHoroscope,
    getAshtakootMilan,
    getMatchingManglikDosha,
    getPlanetaryPositions,
};
