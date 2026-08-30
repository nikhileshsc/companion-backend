const firebase = require("firebase-admin");
const companionServiceAccount = require('./companion-astrodating-firebase-adminsdk-7qc8a-f9942cccd3.json');
var companionFirbase = firebase.initializeApp({
    credential: firebase.credential.cert(companionServiceAccount),
    databaseURL: "https://yodda-companion.firebaseio.com"
  }, 'companionFirbase');

module.exports.companionFirbase = companionFirbase;
