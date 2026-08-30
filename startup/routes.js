const express = require('express');
const userRoute = require('../routes/user')
module.exports = function (app) {
    // app.use(express.json());
    //user routes
    app.use('/api/app/v1/user', userRoute)
    app.use('/api/app/v1/admin', userRoute)

}
