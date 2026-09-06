const axios = require('axios');
const FormData = require('form-data');

const DIVINE_API_KEY = process.env.DIVINE_API_KEY;
const DIVINE_API_ACCESS_TOKEN = process.env.DIVINE_API_ACCESS_TOKEN;

const DAILY_HOROSCOPE_URL = 'https://astroapi-5.divineapi.com/api/v5/daily-horoscope';
const ASHTAKOOT_MILAN_URL = 'https://astroapi-3.divineapi.com/indian-api/v1/ashtakoot-milan';

const DEFAULT_TZONE = 5.5; // IST - all current users are India-based per existing app data

/**
 * Parses a stored timeOfBirth string into { hour, min, sec } (24hr).
 * Handles "HH:mm", "H:mm", and "hh:mm AM/PM" formats defensively,
 * since the field has no enforced format at the schema level.
 */
function parseTimeOfBirth(timeOfBirth) {
    if (!timeOfBirth || typeof timeOfBirth !== 'string') {
        return { hour: 12, min: 0, sec: 0 }; // fallback: noon
    }
    const trimmed = timeOfBirth.trim();
    const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
        let hour = parseInt(ampmMatch[1], 10);
        const min = parseInt(ampmMatch[2], 10);
        const isPM = ampmMatch[3].toUpperCase() === 'PM';
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        return { hour, min, sec: 0 };
    }
    const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (h24Match) {
        return { hour: parseInt(h24Match[1], 10), min: parseInt(h24Match[2], 10), sec: 0 };
    }
    return { hour: 12, min: 0, sec: 0 };
}

/**
 * Fetches today's daily horoscope prediction for a zodiac sign.
 * @param {string} sign - e.g. "Leo", "Aries"
 * @param {number} tzone - defaults to IST
 */
async function getDailyHoroscope(sign, tzone = DEFAULT_TZONE) {
    if (!DIVINE_API_KEY || !DIVINE_API_ACCESS_TOKEN) {
        throw new Error('Divine API credentials not configured (DIVINE_API_KEY / DIVINE_API_ACCESS_TOKEN)');
    }
    if (!sign) {
        throw new Error('Zodiac sign is required');
    }

    const form = new FormData();
    form.append('api_key', DIVINE_API_KEY);
    form.append('sign', sign);
    form.append('h_day', 'today');
    form.append('tzone', String(tzone));
    form.append('lan', 'en');

    const response = await axios.post(DAILY_HOROSCOPE_URL, form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${DIVINE_API_ACCESS_TOKEN}`,
        },
        timeout: 15000,
    });

    return response.data;
}

/**
 * Fetches Ashtakoot Milan (36-point Vedic compatibility) between two people.
 * @param {object} person1 - { fullName, day, month, year, hour, min, sec, gender, place, lat, lon, tzone }
 * @param {object} person2 - same shape as person1
 */
async function getAshtakootMilan(person1, person2) {
    if (!DIVINE_API_KEY || !DIVINE_API_ACCESS_TOKEN) {
        throw new Error('Divine API credentials not configured (DIVINE_API_KEY / DIVINE_API_ACCESS_TOKEN)');
    }

    const form = new FormData();
    form.append('api_key', DIVINE_API_KEY);

    form.append('p1_full_name', person1.fullName);
    form.append('p1_day', String(person1.day));
    form.append('p1_month', String(person1.month));
    form.append('p1_year', String(person1.year));
    form.append('p1_hour', String(person1.hour));
    form.append('p1_min', String(person1.min));
    form.append('p1_sec', String(person1.sec));
    form.append('p1_gender', person1.gender);
    form.append('p1_place', person1.place);
    form.append('p1_lat', String(person1.lat));
    form.append('p1_lon', String(person1.lon));
    form.append('p1_tzone', String(person1.tzone));

    form.append('p2_full_name', person2.fullName);
    form.append('p2_day', String(person2.day));
    form.append('p2_month', String(person2.month));
    form.append('p2_year', String(person2.year));
    form.append('p2_hour', String(person2.hour));
    form.append('p2_min', String(person2.min));
    form.append('p2_sec', String(person2.sec));
    form.append('p2_gender', person2.gender);
    form.append('p2_place', person2.place);
    form.append('p2_lat', String(person2.lat));
    form.append('p2_lon', String(person2.lon));
    form.append('p2_tzone', String(person2.tzone));

    form.append('lan', 'en');

    const response = await axios.post(ASHTAKOOT_MILAN_URL, form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${DIVINE_API_ACCESS_TOKEN}`,
        },
        timeout: 20000,
    });

    return response.data;
}

module.exports = {
    getDailyHoroscope,
    getAshtakootMilan,
    parseTimeOfBirth,
    DEFAULT_TZONE,
};
