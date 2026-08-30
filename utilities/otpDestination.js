const { parsePhoneNumberFromString } = require('libphonenumber-js');

const INDIAN_MOBILE_E164 = /^\+91[6-9]\d{9}$/;

function normalizePhoneNumber(value) {
    if (typeof value !== 'string' || !value.trim().startsWith('+')) return null;

    const phoneNumber = parsePhoneNumberFromString(value.trim());
    if (!phoneNumber || !phoneNumber.isValid()) return null;

    return {
        country: phoneNumber.country,
        countryCallingCode: phoneNumber.countryCallingCode,
        e164: phoneNumber.number,
    };
}

function normalizeIndianSmsDestination(value) {
    const phoneNumber = normalizePhoneNumber(value);
    if (!phoneNumber || phoneNumber.country !== 'IN' || !INDIAN_MOBILE_E164.test(phoneNumber.e164)) return null;
    return phoneNumber.e164;
}

function normalizeEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function maskDestination(value) {
    if (!value) return 'unavailable';
    if (value.includes('@')) {
        const [local, domain] = value.split('@');
        return `${local.slice(0, 2)}***@${domain}`;
    }
    return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

module.exports = {
    maskDestination,
    normalizeEmail,
    normalizeIndianSmsDestination,
    normalizePhoneNumber,
};
