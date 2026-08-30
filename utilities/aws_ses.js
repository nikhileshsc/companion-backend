var AWS = require('aws-sdk');
const nodemailer = require("nodemailer");
const axios = require('axios')
async function sendEmailWithTemplateInvoice(emailSubject, fromEmailId, ccemailId, toEmailId, emailTemplate, attachments) {
    try {
        AWS.config.update({
            secretAccessKey:  process.env.AWS_SECRET_ACCESS_KEY,// config.AWS_SECRET_ACCESS_KEY,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID, // config.AWS_ACCESS_KEY_ID,
            region: process.env.AWS_REGION
        });
    
        let transporter = nodemailer.createTransport({
        SES: new AWS.SES({apiVersion: "2010-12-01" })
        });
        let finalAttachment = []
        for(let attachment of attachments){
            let invoiceContent = await axios.get(
                attachment.url,
                { responseType: 'arraybuffer' }
            );
            let buffer = Buffer.from(invoiceContent.data, 'utf-8');
            finalAttachment.push({filename: attachment.fileName, content: buffer})
        }
        let info = await transporter.sendMail({
            from: fromEmailId,
            cc: ccemailId,
            to: [`${toEmailId}`],
            subject: emailSubject,// Subject line
            attachments: finalAttachment,                   // plaintext version
            html: `${emailTemplate}`, // html version
        })
        return info;
    } catch (error) {
        throw error;
    }
    
}

module.exports = {
    sendEmailWithTemplateInvoice
}
