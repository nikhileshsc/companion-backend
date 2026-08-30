const { maskDestination } = require('../utilities/otpDestination');

function redact(value, key) {
    if (key && /otp|password|authorization|token|receipt|purchase|transaction/i.test(key)) return '[redacted]';
    if (key && /mobile|phone|email/i.test(key) && typeof value === 'string') return maskDestination(value);
    if (Array.isArray(value)) return value.map((item) => redact(item));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
    }
    return value;
}

const logger = (req, res, next) => {
    console.log(`${req.method} ${req.protocol}://${req.get("host")}${req.originalUrl}`);
    console.log('request metadata', { body: redact(req.body), query: redact(req.query) });
    next();
};

module.exports = logger;
