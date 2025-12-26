require('dotenv').config();
// External Model
const express = require("express");
const session = require('express-session'); 
const dashbordRouter = require("./routes/dashbord"); 
const databaseUtil = require("./utils/databaseUtil"); 

// --- 1. DEFINE ENVIRONMENT VARIABLES ---
// These pull the values you set in Vercel's dashboard
const deviceId = process.env.DEVICE_ID || "SOLDIER_UNIT_01";
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

// Static files (assuming your views folder is one level up from this file)
app.use(express.static(path.join(__dirname, '../views')));

// --- 2. IOT DATA UPLOAD ROUTE ---
// This route matches your Arduino code and saves data to MongoDB
app.post('/api/data-upload', async (req, res) => {
    const incomingKey = req.headers['x-api-key']; // Key sent by Arduino

    // Security Check: Compare incoming key with Vercel's API_KEY
    if (incomingKey !== apiKey) {
        console.warn(`[UNAUTHORIZED] Attempt to upload data for ${deviceId}`);
        return res.status(401).json({ error: "Unauthorized access" });
    }

    // Success: Extract vitals and location from the request body
    // We map the Arduino names (heartRate, temperature) to your dashboard names (heartbeat, temp)
    const { heartRate, temperature, lat, lon } = req.body;
    const db = databaseUtil.getDb();

    try {
        const dataRecord = {
            deviceId: deviceId, 
            heartbeat: Number(heartRate),
            bp: 120, // Default/Placeholder as discussed
            temp: Number(temperature),
            location: { lat: Number(lat), long: Number(lon) },
            timestamp: new Date()
        };
        
        // Save to the 'vitals' collection
        await db.collection('vitals').insertOne(dataRecord);
        
        console.log(`[DATA SAVED] ID: ${deviceId}, HR: ${heartRate}, Temp: ${temperature}`);
        res.status(200).json({ status: "Success", message: "Vitals saved to database" });
    } catch (err) {
        console.error("Database save error:", err);
        res.status(500).json({ status: "Error", message: "Failed to save data" });
    }
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
