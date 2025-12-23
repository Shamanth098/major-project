require('dotenv').config();
// External Model
const express = require("express");
const session = require('express-session'); 
const dashbordRouter = require("./routes/dashbord"); 
const databaseUtil = require("./utils/databaseUtil"); 

// --- 1. DEFINE ENVIRONMENT VARIABLES (ADD AT TOP) ---
// These pull the values you set in Vercel's dashboard
const deviceId = process.env.DEVICE_ID;
const apiKey = process.env.API_KEY; 

// Local Model
const path = require('path');

const app = express();

// --- CRITICAL MIDDLEWARE ---

app.use(session({
    secret: process.env.SESSION_SECRET || 'YOUR_VERY_SECURE_RANDOM_KEY', 
    resave: false,
    saveUninitialized: false
}));

app.use(express.urlencoded({ extended: false })); 
app.use(express.json()); // Essential for processing IoT JSON data

app.use(express.static(path.join(__dirname, '../views')));

// --- 2. IOT DATA UPLOAD ROUTE (ADD HERE) ---
// This route is specifically for your ESP32 and A7670C module
app.post('/api/data-upload', (req, res) => {
    const incomingKey = req.headers['x-api-key']; // Key sent by ESP32

    // Security Check: Compare incoming key with Vercel's API_KEY
    if (incomingKey !== apiKey) {
        console.warn(`[UNAUTHORIZED] Attempt to upload data to ${deviceId}`);
        return res.status(401).json({ error: "Unauthorized access" });
    }

    // Success: Extract vitals and location from the request body
    const { heartRate, spo2, temperature, lat, lon } = req.body;
    console.log(`[DATA RECEIVED] ID: ${deviceId}, HR: ${heartRate}, SpO2: ${spo2}%`);

    // TODO: Add logic here to call databaseUtil to save this data
    res.status(200).json({ status: "Success", message: "Vitals saved" });
});

// --- ROUTES ---
app.use(dashbordRouter);

// --- SERVER RUNNING ---
const PORT = process.env.PORT || 3010; // Use Vercel's port or 3010 locally

databaseUtil.mongoConnect(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on address http://localhost:${PORT}`);
  });
});