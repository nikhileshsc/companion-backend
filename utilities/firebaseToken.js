// const dotenv = require('dotenv')
const path = require('path')
// dotenv.config()
// // process.env.TZ = 'Asia/Kolkata'
// if(process.env.NODE_ENV === 'dev'){
//     dotenv.config({
//         path: path.join(__dirname, '/.env.dev')
//     });
// }else if(process.env.NODE_ENV === 'prod'){
//     console.log('asn ')
//     dotenv.config({
//         path: path.join(__dirname, '/.env.prod')
//     });
// }else if(process.env.NODE_ENV === 'preprod'){
//     dotenv.config({
//         path: path.join(__dirname, '/.env.preprod')
//     });
// } else if (process.env.NODE_ENV === 'qa') {
//     dotenv.config({
//         path: path.join(__dirname, '/.env.qa'),
//         override: true
//     });
// }else{
//     dotenv.config({
//         path: path.join(__dirname, '/.env.dev')
//     });
// }
// console.log('path ', __dirname)

// Replace with the path to your service account key file
const admin = require("firebase-admin");
let s = path.join(__dirname, '/companion-astrodating-firebase-adminsdk-7qc8a-f9942cccd3.json')
console.log('s is ', s)
// Replace with your service account key file path
const serviceAccount = require("./companion-astrodating-firebase-adminsdk-7qc8a-f9942cccd3.json");
process.env.GOOGLE_APPLICATION_CREDENTIALS = `${s}`;


admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
  

async function sendFCM() {
    // const projectId = "your-project-id"; // Replace with your Firebase project ID
    // const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  
    // const token = "your-recipient-device-token"; // Replace with the recipient's FCM token
  
    // // Construct the message payload
    // const message = {
    //   message: {
    //     token, // Target device token
    //     notification: {
    //       title: "Hello World",
    //       body: "This is a test message",
    //     },
    //     data: {
    //       key1: "value1",
    //       key2: "value2",
    //     },
    //   },
    // };
  
    // Generate an access token for FCM v1 API
    const accessToken = await admin.credential.applicationDefault().getAccessToken();
    console.log('accessToken ', accessToken)
  
    try {
      // Send the HTTP POST request
    //   const response = await axios.post(url, message, {
    //     headers: {
    //       "Authorization": `Bearer ${accessToken.access_token}`,
    //       "Content-Type": "application/json",
    //     },
    //   });
  
    //   console.log("Message sent successfully:", response.data);
    } catch (error) {
      console.error("Error sending message:", error.response?.data || error.message);
    }
  }
  
  sendFCM();
  