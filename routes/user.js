const express = require('express');
const router = express.Router();
const userController = require('../controller/user')
const getOtpAuth = require('../middleware/getOtpAuth')
const userAuth = require('../middleware/userAuth')


router.get('/getCountryCodesAndFlags', userController.getCountryCodesAndFlags)
router.post('/requestOtp', userController.requestOtp)
router.post('/verifyOtp', userController.verifyOtp)
router.post('/addUpdateMandatoryDetails', userAuth, userController.addUpdateMandatoryDetails)
router.get('/getMandatoryDetails', userAuth, userController.getMandatoryDetails)
router.get('/getAboutDetails', userAuth, userController.getAboutDetails)
router.post('/updateAboutDetails', userAuth, userController.updateAboutDetails)
router.get('/getBasicDetails', userAuth, userController.getBasicDetails)
router.post('/updateBasicDetails', userAuth, userController.updateBasicDetails)
router.post('/updateInterestsByType', userAuth, userController.updateInterestsByType)
router.get('/getInterestsByType', userAuth, userController.getInterestsByType)
router.post('/createNewTicket', userAuth, userController.createNewTicket)
router.get('/getNotifications', userAuth, userController.getNotifications)
router.get('/addAllNotifications', userAuth, userController.addAllNotifications)
router.post('/uploadFileByType', userAuth, userController.uploadFileByType)
router.get('/getMyPhotos', userAuth, userController.getMyPhotos)
router.post('/setProfileFromGallery', userAuth, userController.setProfileFromGallery)
router.delete('/deletePhotoFromGallery', userAuth, userController.deletePhotoFromGallery)
router.get('/getHomeUsers', userAuth, userController.getHomeUsers)
router.post('/getHomeUsers', userAuth, userController.getHomeUsersPost)
router.get('/getTopUsers', userAuth, userController.getTopUsers)
router.get('/getUserDetailsById', userAuth, userController.getUserDetailsById)
router.post('/logout', userAuth, userController.logout)
router.post('/approveGalleryImageById', userAuth, userController.approveGalleryImageById)
router.get('/getKycDetails', userAuth, userController.getKycDetails)
router.post('/uploadKycDocumentsByType', userAuth, userController.uploadKycDocumentsByType)
router.get('/getCommunity', userAuth, userController.getCommunity)
router.get('/setUserId', userController.setUserId)
router.get('/getMaster', userAuth, userController.getMaster)
router.post('/createInAppSubscription', userAuth, userController.createInAppSubscription)
router.post('/verifyInAppSubscription', userAuth, userController.verifyInAppSubscription)
router.get('/getPlanDetails', userAuth, userController.getPlanDetails)
router.get('/regenerateChatToken', userAuth, userController.regenerateChatToken)
router.post('/updateBenefitByType', userAuth, userController.updateBenefitByType)
router.post('/sendPushNotificatioByType', userAuth, userController.sendPushNotificatioByType)
// admin login
router.post('/login', getOtpAuth, userController.login)
router.get('/getGalleryPendingRequest', userAuth, userController.getGalleryPendingRequest)
router.post('/approveAllPhotos', userAuth, userController.approveAllPhotos)
router.post('/verifyAccount', userAuth, userController.verifyAccount)
router.delete('/deleteUser', userAuth, userController.deleteUser)
router.get('/getUnverifiedUsers', userAuth, userController.getUnverifiedUsers)
router.post('/appleSubscription', userController.appleSubscription)
router.post('/androidSubscription', userController.androidSubscription)
// router.get('/getAll', userAuth, userController.getUnverifiedUsers)
router.get('/getAllUsers', userAuth, userController.getAllUsers)
router.post('/sendPushNotificationToAll', userController.sendPushNotificationToAll)
router.get('/getAdminPushNotifications', userAuth, userController.getAdminPushNotifications)

router.post('/updateLocation', userAuth, userController.updateLocation);
router.post('/updateOnlineStatus', userAuth, userController.updateOnlineStatus)


router.get('/getCoordinates', userController.getCoordinates);

router.get('/getOnlineUsersSorted', userAuth, userController.getOnlineUsersSorted);

router.post('/checkAndIncrementMessage', userAuth, userController.checkAndIncrementMessage);

router.post('/generateRtcTokenForCalling', userAuth, userController.getRtcToken)

router.post('/sendMessagePushNotification', userAuth, userController.sendMessagePushNotification);

const multer = require('multer');
// const upload = multer({ dest: 'uploads/' });


router.post('/verifyFaceRekognition', 
    // upload.single('selfie'), 
userController.verifyFaceRekognition);

router.get('/checkAppVersion',userController.checkAppVersion);

router.post('/reportUser', userAuth, userController.reportUser);

router.get('/getReportsRecords', userAuth, userController.getReportRecords);

router.post('/updateToken', userAuth, userController.updateVOIPToken)

router.get('/canSendCall', userAuth, userController.canSendCall)

module.exports = router;
