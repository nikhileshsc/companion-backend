'use strict';
require('dotenv').config();
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const s3 = require('./s3Object')


const fileFilter = (req, file, cb) => {
  if (file) {
    cb(null, true);
  } else {
    cb( new Error('Invalid file type!'), false);
  }
}

const upload = multer({
  fileFilter,
  storage: multerS3({
    acl: 'private',
    s3,
    bucket: process.env.AWS_S3_PRIVATE_BUCKET,
    metadata: function (req, file, cb) {
      cb(null, {fieldName: 'TESTING_METADATA'});
    },
    key: function (req, file, cb) {
        var filePath = ''
        console.log('file ', file)
        console.log('file.originalname ', file.originalname)
        var fileExtention = file.originalname.split('.')[file.originalname.split('.').length - 1]
        console.log('fileExtention ', fileExtention)
        if(fileExtention === 'undefined' || fileExtention === undefined){
          fileExtention = '.pdf'
        }
        let folderName = req.query.memberId ? req.query.memberId: req.user.id
        let fileName = req.query.fileType + '.' + fileExtention
        console.log('fileName  ', fileName)
        // filePath = process.env.NODE_ENV + '/' + folderName + '/' + req.query.fileType + '/'+ uuidString + '_' + Date.now().toString() + '_' + fileName
        if(req.query.fileType === 'addMyTeam' || req.query.fileType === 'watchoverme'){
          filePath = process.env.NODE_ENV + '/' + req.query.fileType + '/' + Date.now().toString() + '_' + fileName
        }else{
          filePath = process.env.NODE_ENV + '/' + folderName + '/' + req.query.fileType + '/' + Date.now().toString() + '_' + fileName
        }
        console.log('filePath ', filePath)
        cb(null, filePath);
    }
  })
});
module.exports = upload;