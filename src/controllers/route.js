const aws=require('aws-sdk');
const multer = require('multer');
const uuid = require('uuid').v4;

const s3= new asserts.s3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 20000000 }, // 20MB limit
});

const uploadtoS3= async (req, res)=>{
    try {
        
    } catch (error) {
        
    }
}