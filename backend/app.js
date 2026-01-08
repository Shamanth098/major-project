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
app.post('/api/data-upload', async (req, res) => {
    const incomingKey = req.headers['x-api-key']; 

    // Security check: Match incoming key from Arduino/ESP32
    if (incomingKey !== apiKey) {
        console.warn(`[UNAUTHORIZED] Access attempt with invalid key.`);
        return res.status(401).json({ error: "Unauthorized access" });
    }

    // Success: Extract vitals from Arduino request body
    const { deviceId, heartRate, temperature, lat, lon } = req.body;
    const db = databaseUtil.getDb();

    try {
        // Prepare the data record for MongoDB
        const dataRecord = {
            deviceId: deviceId || "SOLDIER_UNIT_01", 
            heartbeat: Number(heartRate), 
            bp: 120,                      // Placeholder for oxygen/BP
            temp: Number(temperature),   
            location: { 
                lat: Number(lat), 
                long: Number(lon) 
            },
            timestamp: new Date()         // Automatically add a timestamp
        };
        
        // SAVE TO DATABASE: Insert into 'vitals' collection
        await db.collection('vitals').insertOne(dataRecord);
        
        console.log(`[SUCCESS] Vitals saved for Device: ${dataRecord.deviceId}`);
        res.status(200).json({ status: "Success", message: "Vitals saved" });

    } catch (err) {
        console.error("Database Save Error:", err);
        res.status(500).json({ error: "Failed to save data to database" });
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
