import mongoose from "mongoose";
import { DB_NAME } from "../constants.js"
async function connectDB() {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log("DB Host: ", connectionInstance.connection.host);
    } catch (error) {
        console.log("Issue connecting with Database ", error);
        process.exit(1)
    }
}

export default connectDB