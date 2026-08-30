const jwt = require('jsonwebtoken');
// Generate random strings.
const generateRandom = (length = 32, alphanumeric = true) => {
    let data = "",
        keys = "";

    if (alphanumeric) {
        keys = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    } else {
        keys = "0123456789";
    }

    for (let i = 0; i < length; i++) {
        data += keys.charAt(Math.floor(Math.random() * keys.length));
    }
    return data;
};
/*********** Generate JWT token *************/
const generateToken = (data) =>
    jwt.sign(data, process.env.JWT_PRIVATE_KEY, { expiresIn: "365d" });//expires in 1d days

//expiresIn: "10h" // it will be expired after 10 hours
//expiresIn: "20d" // it will be expired after 20 days
//expiresIn: 120 // it will be expired after 120ms
//expiresIn: "120s" // it will be expired after 120s


/*********** Decode JWT token *************/
const decodeToken = token => jwt.verify(token, jwtKey);
module.exports = {
    generateRandom,
    generateToken,
    decodeToken,
}