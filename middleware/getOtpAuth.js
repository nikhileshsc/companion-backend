
const crypto = require('crypto');

async function auth(req, res, next) {
    try {
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'You need to provide token for authentication.' });
        const configuredToken = process.env.OTP_API_TOKEN;
        if (!configuredToken) return res.status(503).send({ statusCode: 503, error: 'Service Unavailable', message: 'OTP service is not configured.' });
        const supplied = Buffer.from(token);
        const expected = Buffer.from(configuredToken);
        if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
            return res.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'You need to provide token for authentication.' });
        }
        next();
        
    } catch (ex) {
        console.log('ex ', ex)
        // means token not decoded return 408 'Request timed out' wiht message
        return res.status(408).send({ statusCode: 408, error: 'Request Timed-out', message: 'Access Denied. Invalid Token.' });
    }
}
/**
 * @exports auth
 */
module.exports = auth;
