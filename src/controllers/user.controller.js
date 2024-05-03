import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import User from "../models/user.model.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

// TODO: WHEN THE IMAGE IS UPDATED THEN REMOVE/DELETE THE IMAGE THAT IS STORED ON CLOUD (CREATE A UTIL FUNCTION FOR THAT)
const generateRefreshAndAccessTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens")
    }
}
const registerUser = asyncHandler(async (req, res) => {
    const { username, fullName, email, password } = req.body;
    if (
        [username, fullName, email, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }
    try {
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        })
        console.log("Existing User: ", existingUser); //TODO: REMOVE
        if (existingUser) {
            throw new ApiError(400, "User already exists")
        }
        const avatarLocalPath = req.files?.avatar[0]?.path
        console.log(req.files); //TODO: REMOVE
        const coverImageLocalPath = req.files?.coverImage[0]?.path

        if (!avatarLocalPath) {
            throw new Error(400, "Avatar file is required")
        }

        const avatar = await uploadFileOnCloudinary(avatarLocalPath)
        if (coverImageLocalPath) {
            const coverImage = await uploadFileOnCloudinary(coverImageLocalPath)
        }

        if (!avatar) {
            throw new Error(400, "Avatar file is required")
        }

        const user = await User.create({
            username: username.toLowerCase(),
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            fullName
        })

        const createdUser = await User.findById(user._id).select("-password -refreshToken")

        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering user")
        }
        return res.json(201).json(
            new ApiResponse(201, "User registered successfully", createdUser)
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "User already exists")
    }

})

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body
    if (!username && !email) {
        throw new ApiError(400, "Username or email is required")
    }
    try {
        const user = await User.findOne({
            $or: [{ username }, { email }]
        })

        if (!user) {
            throw new ApiError(404, "User not found")
        }
        const passwordValidity = await user.isPasswordCorrect(password)
        if (!passwordValidity) {
            throw new ApiError(401, "Incorrect Password")
        }
        const { refreshToken, accessToken } = await generateRefreshAndAccessTokens(user._id)

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken },
                    "User logged in successfully")
            )
    } catch (error) {
        throw new ApiError(500, "Something went wrong")
    }


})

const logoutUser = asyncHandler(async (req, res) => {
    try {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    refreshToken: undefined
                }
            },
            {
                new: true
            })
        const options = {
            httpOnly: true,
            secure: true
        }
        return res
            .status(200)
            .clearCookie("refreshToken", options)
            .clearCookie("accessToken", options)
            .json(new ApiResponse(200, {}, "Logged out successfully"))
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong")
    }
})

const generateAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Invalid refresh token")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { newRefreshToken, accessToken } = await generateRefreshAndAccessTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed successfully"))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { newPassword, oldPassword } = req.body
    try {
        const user = await User.findById(req.user?._id)
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
        if (!isPasswordCorrect) {
            throw new ApiError(400, "Incorrect Password")
        }
        user.password = newPassword
        await user.save({ validateBeforeSave: false })
        return res
            .status(200)
            .json(new ApiResponse(200, "Password changed successfully"))
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong")
    }
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, "Current user data", req.user))
})

const updateProfileDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }
    try {
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    fullName,
                    email
                }
            },
            { new: true }
        ).select("-password -refreshToken")
        return res
            .status(200)
            .json(new ApiResponse(200, "Details updated successfully", user))
    } catch (error) {
        throw new ApiError(500, error?.message || "Not able to update account details")
    }
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }
    try {
        const avatar = await uploadFileOnCloudinary(avatarLocalPath)
        if (!avatar.url) {
            throw new ApiError(500, "Something went wrong while uploading avatar")
        }
        const user = await User.findByIdAndUpdate(
            user.req?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            { new: true }).select("-password -refreshToken")
        return res
            .status(200)
            .json(new ApiResponse(200, "Avatar updated successfully", user))
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong while updating avatar")
    }
})

const updateUserCover = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing")
    }
    try {
        const coverImage = await uploadFileOnCloudinary(coverImageLocalPath)
        if (!coverImage.url) {
            throw new ApiError(500, "Something went wrong while uploading cover image")
        }
        const user = await User.findByIdAndUpdate(
            user.req?._id,
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            { new: true }).select("-password -refreshToken")

        return res
            .status(200)
            .json(new ApiResponse(200, "Cover image updated successfully", user))
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong while updating cover image")
    }
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username?.trim) {
        throw new ApiError(400, "Username is missing")
    }
    try {
        const channel = await User.aggregate([
            {
                $match: { username: username?.toLowerCase() }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: 'channel',
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    subscribedCount: {
                        $size: '$subscribedTo'
                    },
                    isSubscribed: {
                        $cond: {
                            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    subscribedCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1
                }
            }
        ])
        console.log(channel); //TODO: REMOVE LATER

        if (!channel?.length) {
            throw new ApiError(400, "Channel does not exists")
        }
        return res
            .status(200)
            .json(new ApiResponse(200, "User channel details fetched successfully", channel[0]))
    } catch (error) {
        throw new ApiError(500, "Something went wrong while fetching channel details")
    }
})

const getWatchHistory = asyncHandler(async (req, res) => {
    try {
        const user = await User.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.user._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: 'watchHistory',
                    foreignField: '_id',
                    as: 'watchHistory',
                    pipeline: [{
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [{
                                $project: {
                                    username: 1,
                                    fullName: 1,
                                    avatar: 1
                                }
                            }]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }]
                }
            }
        ])
        return res
            .status(200)
            .json(new ApiResponse(200, "Users watch history fetched successfuly", user[0].watchHistory))
    } catch (error) {
        throw new ApiError(500, "Not able to fetch watch history")
    }
})

export { registerUser, loginUser, logoutUser, generateAccessToken, changeCurrentPassword, getCurrentUser, updateProfileDetails, updateUserAvatar, updateUserCover, getUserChannelProfile, getWatchHistory }