require('dotenv').config();
const express = require("express");
const session = require('express-session'); 
const path = require('path');

// Local Models
const dashbordRouter = require("./routes/dashbord"); 
const databaseUtil = require("./utils/databaseUtil"); 

const app = express();

// --- 1. MIDDLEWARE ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'YOUR_VERY_SECURE_RANDOM_KEY', 
    resave: false,
    saveUninitialized: false
}));

app.use(express.urlencoded({ extended: false })); 
app.use(express.json()); 
app.use(express.static(path.join(__dirname, '../views')));

// --- 2. IOT DATA UPLOAD ROUTE (For your Arduino/GSM) ---
app.post('/api/data-upload', async (req, res) => {
    const incomingKey = req.headers['x-api-key']; 
    const apiKey = process.env.API_KEY; 

    // Security Check
    if (incomingKey !== apiKey) {
        return res.status(401).json({ error: "Unauthorized access" });
    }

    // Extracting data from Arduino
    // Note: We accept both 'heartRate' (app.js) and 'heartbeat' (dashbord.js) names
    const { deviceId, heartRate, heartbeat, temperature, temp, lat, lon, long } = req.body;
    const db = databaseUtil.getDb();

    try {
        const dataRecord = {
            deviceId: deviceId || "SOLDIER_UNIT_01", 
            heartbeat: Number(heartbeat || heartRate || 0), 
            bp: 120, // Default placeholder
            temp: Number(temp || temperature || 0),    
            location: { 
                lat: Number(lat || 12.9716), 
                long: Number(long || lon || 77.5946) 
            },
            timestamp: new Date()
        };
        
        await db.collection('vitals').insertOne(dataRecord);
        console.log(`[SUCCESS] Data saved for ${dataRecord.deviceId}`);
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Database Save Error:", err);
        res.status(500).json({ error: "Database Save Error" });
    }
});

// --- 3. NEW: DEMO SIMULATOR ROUTE (For your "Secret" Controller) ---
// This allows you to push data to the dashboard using buttons if hardware fails
app.post('/api/demo-simulate', async (req, res) => {
    const { mode } = req.body;
    const db = databaseUtil.getDb();
    
    // Base object for Soldier Unit 01
    let simulatedData = { 
        deviceId: "SOLDIER_UNIT_01", 
        timestamp: new Date(), 
        location: { lat: 12.9716, long: 77.5946 } 
    };

    // Logic based on Button Clicks
    if (mode === 'idle') {
        // Mode 1: Device is on but not being touched
        simulatedData.heartbeat = 0;
        simulatedData.temp = 25.4; // Room temp
        simulatedData.bp = 0;
    } else if (mode === 'vitals') {
        // Mode 2: Normal Human Heart Rate & Oxygen (SPO2 placeholder in BP field)
        simulatedData.heartbeat = Math.floor(Math.random() * (82 - 72 + 1)) + 72; 
        simulatedData.bp = 98; // Simulating SpO2 98%
        simulatedData.temp = 32.0; // Skin surface temp
    } else if (mode === 'temp') {
        // Mode 3: High/Normal Body Temperature
        simulatedData.heartbeat = 76;
        simulatedData.bp = 97;
        simulatedData.temp = 37.2; // Fever/High Body Temp
    }

    try {
        await db.collection('vitals').insertOne(simulatedData);
        console.log(`[DEMO] Mode updated to: ${mode}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

// --- 4. ROUTES & STARTUP ---
app.use(dashbordRouter);

const PORT = process.env.PORT || 3010;

databaseUtil.mongoConnect(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
