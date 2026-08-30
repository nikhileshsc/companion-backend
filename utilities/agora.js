const { RtcTokenBuilder, RtcRole, ChatTokenBuilder } = require("agora-token");
const axios = require('axios');
const { User } = require("../models/user");



function generateChannelName(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

let generateMeetingTokenUtil = async (channel_name) => {
        try {

            let appID = process.env.AGORA_APP_ID;
            let appCertificate = process.env.AGORA_APP_CERTIFICATE;
            let role = "PUBLISHER"
            var expirationTimeInSeconds = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
            console.log('appID', appID, 'appCertificate ', appCertificate)
            // channel_name = generateChannelName(5)
            let token = RtcTokenBuilder.buildTokenWithUid(appID, appCertificate, channel_name , 0, role, expirationTimeInSeconds);

            console.log("token", token);
            console.log('channel_name ', channel_name)
            return token;
            
        } catch (error) {
            console.log(error);
            
        }
}
let generateMeetingTokenUtilTemp = async (channel_name) => {
    try {

        let appID = process.env.AGORA_APP_ID;
        let appCertificate = process.env.AGORA_APP_CERTIFICATE;
        let role = "PUBLISHER"
        var expirationTimeInSeconds = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
        console.log('appID', appID, 'appCertificate ', appCertificate)
        channel_name = generateChannelName(5)
        let token = RtcTokenBuilder.buildTokenWithUid(appID, appCertificate, channel_name , 0, role, expirationTimeInSeconds);
        console.log("token", token);
        console.log('channel_name ', channel_name)
        return {token, channel_name: channel_name};
    } catch (error) {
        console.log(error);
    }
}

// const generateMeetingToken = (req, res) => {
//     try {
//         let payload = req.body
//         let appID = process.env.AGORA_APP_ID;
//         let appCertificate = process.env.AGORA_APP_CERTIFICATE;
//         let role = "PUBLISHER"
//         var expirationTimeInSeconds = 3600;
//         let token = RtcTokenBuilder.buildTokenWithUid(appID, appCertificate, payload.channelName, payload.uid, role, expirationTimeInSeconds);


//         return res.status(200).json({ token: token });

//     } catch (error) {

//         console.log(error);
//         return res.status(200).json({ error: error })


//     }
// }

const generateMeetingToken = (uid) => {
    try {
        let appID = process.env.AGORA_APP_ID;
        let appCertificate = process.env.AGORA_APP_CERTIFICATE;
        let role = "PUBLISHER";
        let expirationTimeInSeconds = 3600;
        let channel = generateChannelName(5);  // returns something like "a1b2c"

        let token = RtcTokenBuilder.buildTokenWithUid(
            appID,
            appCertificate,
            channel,
            uid,
            role,
            expirationTimeInSeconds
        );

        // Return both token and channel name
        return {
            token,
            channel
        };

    } catch (error) {
        console.log(error);
        return null;
    }
}


async function acquireAgoraCloudRecording(channel, uid){
    try {
        const Authorization = `Basic ${Buffer.from(`${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_SECRET}`).toString("base64")}`;
        console.log('Authorization ', Authorization, 'appID ', 'appID', process.env.AGORA_APP_ID)
        const acquire = await axios.post(
            `https://api.agora.io/v1/apps/${process.env.AGORA_APP_ID}/cloud_recording/acquire`,
            {
            cname: channel,
            uid: uid,
            clientRequest: {
                resourceExpiredHour: 24,
            },
            },
            { headers: { "Content-Type": 'application/json',
            Accept: 'application/json', Authorization: Authorization } }
        );
        return acquire.data
    } catch (error) {
        console.log('error in acquireAgoraCloudRecording', error)
    }
    
}

async function startAgoraCloudRecording(channel, uid, resource, streamType, token, channelType){
    try {
        var mode = 'mix'
    const Authorization = `Basic ${Buffer.from(`${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_SECRET}`).toString("base64")}`;
    let folderName = `cloudRecordings/${process.env.NODE_ENV}`
    let recordingConfig = {}
    if(streamType === 0){
        console.log('inside 1')
        // recordingConfig = {
        //     "maxIdleTime": 600,
        //     "streamTypes": 1,
        //     "streamMode": "original",
        //     "channelType": 0,
        //     "videoStreamType": 0,
        //     // "subscribeAudioUids": ["123","456"],
        //     "subscribeUidGroup": 0
        // }
        recordingConfig =  {
            "maxIdleTime": 600,
            "channelType": 0,
            "streamTypes": 0,
            "audioProfile": 1,
            // "streamTypes": 0, // Set to 0 to record only audio
            // "channelType": 1,
            // "videoStreamType": 0,
            // "audioProfile": 1, // Use the appropriate audio profile
            // "audioSampleRate": 48000, // Optional, set the audio sample rate
            // "audioBitrate": 48, // Optional, set the audio bitrate
            // "audioChannels": 1 // Optional, set the number of audio channels
          }

    }else{
        recordingConfig = {
            "maxIdleTime": 600,
            // "streamMode": "default",
            "streamTypes": 2,
            "channelType": 0,
            "transcodingConfig": {
                "height": 640,
                "width": 360,
                "bitrate": 500,
                "fps": 15,
                "mixedVideoLayout": 1,
                // "backgroundColor": "#FF0000"
                // "backgroundColor": "#FFFFFF"
                backgroundColor: '#000000'
            }
        }
    }
    console.log('recordingConfig ', recordingConfig)

    
    const start = await axios.post(
        `https://api.agora.io/v1/apps/${process.env.AGORA_APP_ID}/cloud_recording/resourceid/${resource}/mode/mix/start`,
        {
          cname: channel,
          uid: uid,
        //   clientRequest: {
        //     recordingConfig: {
        //       maxIdleTime: 30,
        //       streamTypes: streamType,
        //       channelType: channelType,
        //       videoStreamType: 0,
        //       transcodingConfig: {
        //         height: 640,
        //         width: 360,
        //         bitrate: 500,
        //         fps: 15,
        //         mixedVideoLayout: 1,
        //         backgroundColor: "#FFFFFF",
        //       },
        //     },
        //     recordingFileConfig: {
        //       avFileType: ["hls"],
        //     },
        //     storageConfig: {
        //       vendor: 1,
        //       region: 2,
        //       bucket: process.env.AWS_S3_PUBLIC_BUCKET,
        //       accessKey: process.env.AWS_ACCESS_KEY_ID,
        //       secretKey: process.env.AWS_SECRET_ACCESS_KEY,
        //       fileNamePrefix: ["cloudRecordings", uid],
        //     },
        //   },
        "clientRequest": {
            token: token,
            "recordingConfig": recordingConfig,
            "recordingFileConfig": {
                "avFileType": [
                    "hls",
                    "mp4"
                ]
            },
            storageConfig: {
                vendor: 1,
                region: 14,
                bucket: process.env.AWS_S3_PUBLIC_BUCKET,
                accessKey: process.env.AWS_ACCESS_KEY_ID,
                secretKey: process.env.AWS_SECRET_ACCESS_KEY,
                fileNamePrefix: [`${process.env.NODE_ENV}`, 'cloudRecordings', uid],
              },
        }
        },
        { headers: { Authorization } }
      );

      
    return start.data
    } catch (error) {
        console.log('error in startAgoraCloudRecording', error)
    }
    
}
async function stopAgoraCloudRecording(channel, uid, resource, sid){
    try {
        const Authorization = `Basic ${Buffer.from(`${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_SECRET}`).toString("base64")}`;
        var mode = 'mix'
        const stop = await axios.post(

            // `https://api.agora.io/v1/apps/${process.env.agoraAppID}/cloud_recording/resourceid/${resource}/sid/${sid}/mode/${mode}/stop`,
            `https://api.agora.io/v1/apps/${process.env.AGORA_APP_ID}/cloud_recording/resourceid/${resource}/sid/${sid}/mode/mix/stop`,
            {
              "cname": channel,
              "uid": uid,
              "clientRequest":{
                "async_stop": false   
            }
            },
            { headers: { Authorization } }
          );
        return stop.data
    } catch (error) {
        console.log('error in startAgoraCloudRecording', error)
    }
}
// generate agora chat token
const generateChatTokenByUserId = async (userUuid) => {
    const appID = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    console.log('appCertificate ', appCertificate)
    console.log('appID ', appID)
    let expirationTimeInSeconds = 3600
    const token = ChatTokenBuilder.buildUserToken(appID, appCertificate, userUuid, expirationTimeInSeconds);
    // call back
    // cb({ "token": token })
    return token
}

// generateChatTempToken
const generateChatTempToken = async () => {
    const appID = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    let expirationTimeInSeconds = 3600
    const token = ChatTokenBuilder.buildAppToken(appID, appCertificate, expirationTimeInSeconds)
    // call back
    // cb({ "token": token })
    return token
}

const registerChatUserWithMetaData = async (userDetails) => {
    try {
        let appToken = await generateChatTempToken()
        let chatData = {
            agoraChatUid: '',
            chatToken: '',

        }
        let registerUserToChat = await axios.post(`${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/users`, {"username" : String(userDetails._id),"password": "companion@takedown77"}, {
            headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${appToken}`,
            }
        })
        
        if(registerUserToChat && registerUserToChat.data){
            console.log('registerUserToChat.data.entities[0].uuid ', registerUserToChat.data.entities[0].uuid)
            chatData.agoraChatUid = registerUserToChat.data.entities[0].uuid
            chatData.chatToken = await generateChatTokenByUserId(String(userDetails._id))
        }
        let username = userDetails._id
        // we set last name to email
        let metaData = {
            nickname: userDetails.fullName, avatarurl: userDetails.profileUrl,
        }
        let updateUserToChat = await axios.put(`${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/metadata/user/${username}`, new URLSearchParams(metaData), {
            headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'authorization': `Bearer ${appToken}`,
            // 'x-api-key': 'IMItsHTxPJ2QkpEio4SIY3KXZau0qVTp8wufOZhC'
            }
        })
        return chatData
    } catch (error) {
        console.log('error in registerChatUserWithMetaData', error)
        console.log('userDetails ', userDetails)
        if(error.response?.data?.error === 'duplicate_unique_property_exists'){
            await User.updateOne({_id: userDetails._id}, {$set: {chatUid: '4567'}})
        }
    }
}
// create chat default group
const createDefaultChatGroup = async (userDetails) => {
    try {
        let appToken = await generateChatTempToken()
        let chatData = {
            chatUid: '',
            chatToken: '',
            emergencyGroupId: ''

        }
        let username = userDetails._id
        // we set last name to email
        let metaData = {
            nickname: userDetails.firstName + ' ' + userDetails.lastName, avatarurl: userDetails.profileUrl, phone: userDetails.mobile, mail: userDetails.email
        }
        let updateUserToChat = await axios.put(`${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/metadata/user/${username}`, new URLSearchParams(metaData), {
            headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'authorization': `Bearer ${appToken}`,
            // 'x-api-key': 'IMItsHTxPJ2QkpEio4SIY3KXZau0qVTp8wufOZhC'
            }
        })
        console.log('updateUserToChat ', updateUserToChat)
        console.log('chatData ', chatData)
        // create default emergency group
        let groupName = `${userDetails.firstName.trim().toLowerCase().replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))} ${userDetails.lastName.trim().toLowerCase().replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))} Emergency Group`
        let createGroup = await axios.post(
        `${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/chatgroups`,
        {
            "groupname": groupName,
            "description": groupName,
            "public": true,
            "owner": process.env.DEFAULT_MODERATOR,
            "custom": JSON.stringify({'show': 'n'}),
            "members": [
                username
              ]
        },
        { headers: { "Content-Type": 'application/json', 'authorization': `Bearer ${appToken}`, } }
    );
    if(createGroup && createGroup.data){
        chatData.emergencyGroupId = createGroup.data.data.groupid
    }
        return chatData
    } catch (error) {
        console.log('error in registerChatUserWithMetaData', error)
    }
    
}
// updateRegisterMetaData
const updateRegisterMetaData = async (userDetails) => {
    try {
        let appToken = await generateChatTempToken()
        let username = String(userDetails._id)
        // we set last name to email
        let metaData = {
        }
        if(userDetails.fullName){
            metaData.nickname = userDetails.fullName
        }
        if(userDetails.profileUrl){
            metaData.avatarurl = userDetails.profileUrl
        }
        let updateUserToChat = await axios.put(`${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/metadata/user/${username}`, new URLSearchParams(metaData), {
            headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'authorization': `Bearer ${appToken}`,
            // 'x-api-key': 'IMItsHTxPJ2QkpEio4SIY3KXZau0qVTp8wufOZhC'
            }
        })
        console.log('updateUserToChat ', updateUserToChat)
        if(userDetails.emergencyGroupId){
            let groupName = `${userDetails.firstName.trim().toLowerCase().replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))} ${userDetails.lastName.trim().toLowerCase().replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))} Emergency Group`
            console.log('userDetails.emergencyGroupId ', userDetails.emergencyGroupId)
            
            let updateGroup = await axios.put(`${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/chatgroups/${userDetails.emergencyGroupId}`,{ groupname: groupName, description: groupName}, {
                headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'authorization': `Bearer ${appToken}`,
                }
            })
            // console.log('updateGroup ', updateGroup)
        }
    } catch (error) {
        console.log('error in updateRegisterMetaData', error)
    }
    
}
const addUserToGroup = async (groupId, usernames) => {
    try {
        console.log('groupId ', groupId)
        console.log('usernames ', usernames)
        let appToken = await generateChatTempToken()
        let addMemberGroup = await axios.post(
            `${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/chatgroups/${groupId}/users`,{
                usernames: usernames
            },
            { headers: { "Content-Type": 'application/json', 'authorization': `Bearer ${appToken}`, } }
        );
        console.log('addMemberGroup ', addMemberGroup.data.data)
        console.log('addMemberGroup ', addMemberGroup.data.data.newmembers)
        
    } catch (error) {
        console.log('error in addUserToGroup', error)
    }
    
}
// remove member
const removeUserToGroup = async (groupId, members) => {
    try {
        let appToken = await generateChatTempToken()
        // // separated by the comma
        let removeMembersGroup = await axios.delete(
            `${process.env.AGORA_APP_HOST}/${process.env.AGORA_ORG_NAME}/${process.env.AGORA_APP_NAME}/chatgroups/${groupId}/users/${members}`,{ headers: { "Content-Type": 'application/json', 'authorization': `Bearer ${appToken}`, } }
        );
        console.log('removeMembersGroup ', removeMembersGroup)
        
    } catch (error) {
        console.log('error in removeUserToGroup', error)
    }
    
}
module.exports = {
    generateMeetingToken,
    generateMeetingTokenUtil,
    generateMeetingTokenUtilTemp,
    acquireAgoraCloudRecording,
    startAgoraCloudRecording,
    stopAgoraCloudRecording,
    generateChatTokenByUserId,
    generateChatTempToken,
    registerChatUserWithMetaData,
    updateRegisterMetaData,
    addUserToGroup,
    removeUserToGroup,
    createDefaultChatGroup,
}