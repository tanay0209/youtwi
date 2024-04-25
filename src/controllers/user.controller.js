import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import User from "../models/user.model.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"

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
        throw new ApiError(401, error?.message || "Invalide refresh token")
    }
})
export { registerUser, loginUser, logoutUser, generateAccessToken }