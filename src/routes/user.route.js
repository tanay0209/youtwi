import { Router } from "express";
import { changeCurrentPassword, generateAccessToken, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, registerUser, updateProfileDetails, updateUserAvatar, updateUserCover } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)
router.route("/logout").get(verifyJWT, logoutUser)
router.route("/generate-refresh-token").get(generateAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route('/update-account').patch(verifyJWT, updateProfileDetails)
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCover)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route('/watch-history').get(verifyJWT, getWatchHistory)


export default router