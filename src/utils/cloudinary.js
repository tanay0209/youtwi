import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileOnCloudinary = async (localFilePath) => {

    try {
        if (!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })
        // TODO: REMOVE console.log
        console.log(response);
        console.log("File uploaded: " + response.url);
        return response
    } catch (error) {
        return "Unable to save file on cloudinary"
    }
}

export { uploadFileOnCloudinary }