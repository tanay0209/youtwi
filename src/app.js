import express, { urlencoded } from 'express'
import cors from "cors"
import cookieParser from 'cookie-parser'

const app = express()


// Application configurations
app.use(cors({
    // Allow requests from this origins only
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

// Allow applictaion to receive json responses, limit option allows to limit the size of json reponse
app.use(express.json({ limit: "16kb" }))

// Enabels the application handle enconded urls
app.use(express.urlencoded({ extended: true, limit: "16kb" }))

app.use(express.static("public"))

app.use(cookieParser())


export { app }