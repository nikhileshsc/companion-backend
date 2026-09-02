const express = require('express');
const userRoute = require('../routes/user')
const migrationRoute = require('../routes/migration')
module.exports = function (app) {
    // app.use(express.json());
    //user routes
    app.use('/api/app/v1/user', userRoute)
    app.use('/api/app/v1/admin', userRoute)
    //temporary: one-time AWS/Atlas -> Railway user data migration, remove after cutover is complete
    app.use('/internal/migration', migrationRoute)

}
