const _ = require('lodash');
const jwt = require('jsonwebtoken');
const url2 = require('url');
const { Role } = require('../models/role');
const { User } = require('../models/user');
const Message = require('../utilities/message');
const { Staff } = require('../models/staff');

async function auth(req, res, next) {
    try {
        // get the token from headers -> authorization
        const token = req.headers["authorization"];
        // if token not found return 401 'Unauthorized' with message
        if (!token) return res.status(401).send({ statusCode: 401, error: 'Unauthorized', message: Message.tokenExpired });
        // decode the token with jwt 
        var decodedId = jwt.decode(token);
        if(!decodedId) return res.status(401).send({ statusCode: 401, error: 'Unauthorized', message: Message.tokenExpired });
        console.log('decodedId ', decodedId)
        // get the user from the decoded token id
        let user = null
        console.log('decodedId ', decodedId)
        if(decodedId.userType){
            user = await Staff.findOne({ _id: decodedId._id }, 'loginToken role subscriptionId blockedUsers');
        }else{
            user = await User.findOne({ _id: decodedId._id }, 'loginToken role subscriptionId blockedUsers');
        }
        // if user not found return 401 'Unauthorised' with message
        if (!user) return res.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'The user does not exists on this platform.' });
        if(!decodedId.deviceType){
            decodedId.deviceType = user.loginToken.deviceType
        }
        if(decodedId.deviceType === 'android watch'){
            if (user.androidWatchLoginToken.token !== token) return res.status(401).send({ statusCode: 401, error: 'Invalid token', message: Message.tokenExpired  });
        }else{
            if (user.loginToken.token !== token) return res.status(401).send({ statusCode: 401, error: 'Invalid token', message: Message.tokenExpired });
        }
        //-------------End here-------------
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        // genreate url to check priviledge is assign to requested url or not
        const getUrlForPrev = req.method + url2.parse(req.originalUrl).pathname;
        // if role not found for this user return 403 'Unauthorised' with message
        if (user.role.length == 0) return res.status(403).send({ statusCode: 403, error: 'Unauthorised', message: 'This role is not found on the platform. Please contact platform support.' });
        // remove password from user object
        user.password = undefined;
        // set user information to req for API purpose
        req.user = user;
        req.user.currentDeviceType = decodedId.deviceType
        // found variable is used to privilege assignment
        // var found = false;
        var found = true;
        // using loop check all roles 
        // for (var i = 0; i < user.role.length; i++) {
        //     // get the role from the database
        //     const role = await Role.findOne({ role: user.role[i] });
        //     // if role found check priviledge is exist or not
        //     if (role) {
        //         if (_.includes(role.privileges, getUrlForPrev)) {
        //             //if found means roles and previledge is granted 
        //             found = true;
        //             break;
        //         }
        //     }
        // }
        // if found true proceed to next functionality
        if (found) {
            // cursor moves to next function         
            next();
        } else {
            // if not found retunn 403 'Unauthorized' with message
            return res.status(403).send({ statusCode: 401, error: 'Invalid token', message: Message.tokenExpired });
        }
    } catch (ex) {
        console.log('ex ', ex)
        // means token not decoded return 408 'Request timed out' wiht message
        return res.status(408).send({ statusCode: 401, error: 'Invalid token', message: Message.tokenExpired });
    }
}
/**
 * @exports auth
 */
module.exports = auth;