const express = require('express');
const app = express();
const dotenv = require('dotenv')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('./middleware/logger')
const port = process.env.PORT || 3000;
const path = require('path')
dotenv.config()
if(process.env.NODE_ENV === 'dev'){
    dotenv.config({
        path: path.join(__dirname, '/.env.dev')
    });
    
}else if(process.env.NODE_ENV === 'prod'){
    dotenv.config({
        path: path.join(__dirname, '/.env.prod')
    });
}else if(process.env.NODE_ENV === 'preprod'){
    dotenv.config({
        path: path.join(__dirname, '/.env.preprod')
    });
}else{
    dotenv.config({
        path: path.join(__dirname, '/.env.dev')
    });
}
//database connection setup
console.log('current working envirment is ', process.env.NODE_ENV)
mongoose.connect(process.env.MONGODB_URI, {})
    .then(() => {
        console.log('Successfully connected to DB! ')
    }).catch(err => {
        console.log('error in connection to DB ', err)
    })
// use body parser so we can get info from POST and/or URL parameters
app.use(cors());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 }));
// app.use(bodyParser.json({ limit: 1024102420, type: 'application/json' }));
app.use(express.json());


app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Origin", '*');
    res.header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
})
app.use(logger);

require('./startup/routes')(app);

//send response to show health status on aws
app.get("/", (req, res) => {
    res.send(` <h3> Companion Backend Platform ${process.env.NODE_ENV}</h3> `)
})

require('./jobs/photoReminderJob');
require('./jobs/subscriptionExpiryJob');

server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})

