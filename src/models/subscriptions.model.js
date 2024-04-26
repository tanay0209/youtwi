import mongoose from "mongoose";


const subscriptionModel = new mongoose.Schema({
    subscriber: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true })


const Subscription = mongoose.models.subscriptions || mongoose.model("Subscription", subscriptionModel)

export default Subscription