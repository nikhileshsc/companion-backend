const s3 = require('./s3Object')
const getKeyFromUrl = (url) => {
    url = url.split("//")[1].split('/');
    url.splice(0, 1);
    key = url.join('/')
    return key;
  };
  
  const getSignedUrl = (key) => {
    const params = { Bucket: process.env.AWS_S3_PRIVATE_BUCKET, Key: key };
    const url = s3.getSignedUrl("getObject", params);
  
    return url;
  };
  const deleteFileFromS3 = (bucketName, key) => {
    const params = { Bucket: bucketName, Key: key };
    const url = s3.deleteObject(params, function(err, data) {
      if (err) console.log(err, err.stack);  // error
      else     console.log('deleted');                 // deleted
    });
    return url;
  };

  module.exports.getKeyFromUrl = getKeyFromUrl;
  module.exports.getSignedUrl = getSignedUrl;
  module.exports.deleteFileFromS3 = deleteFileFromS3;
