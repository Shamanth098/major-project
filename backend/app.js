require('dotenv').config();
const express = require("express");
const session = require('express-session'); 
const path = require('path');
const cors = require('cors');

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

app.post('/api/demo-simulate', async (req, res) => {
    const { type, status } = req.body; // type: 'heart' or 'temp', status: 'on' or 'off'
    const db = databaseUtil.getDb();
    
    try {
        // 1. Get the very latest record from the DB to see current states
        const lastRecord = await db.collection('vitals')
            .find({ deviceId: "SOLDIER_UNIT_01" })
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();

        // 2. Start with defaults or use previous values
        let currentStatus = lastRecord.length > 0 ? lastRecord[0] : {
            heartbeat: 0,
            bp: 0,
            temp: 25.5
        };

        // 3. Create the NEW record, copying the OLD values first
        let newData = { 
            deviceId: "SOLDIER_UNIT_01", 
            timestamp: new Date(), 
            location: { lat: 12.9716, long: 77.5946 },
            heartbeat: currentStatus.heartbeat,
            bp: currentStatus.bp,
            temp: currentStatus.temp
        };

        // 4. Update ONLY the sensor that was clicked
        if (type === 'heart') {
            if (status === 'on') {
                newData.heartbeat = Math.floor(Math.random() * (85 - 72 + 1)) + 72; // 72-85 BPM
                newData.bp = 98; // Simulated SpO2
            } else {
                newData.heartbeat = 0;
                newData.bp = 0;
            }
        } 

        if (type === 'temp') {
            if (status === 'on') {
                newData.temp = Number((36.5 + (Math.random() * 0.7)).toFixed(1)); // Body Temp
            } else {
                newData.temp = 25.5; // Back to Room Temp
            }
        }

        // 5. Save the updated data as a new entry
        delete newData._id; // Ensure it doesn't try to reuse the old ID
        await db.collection('vitals').insertOne(newData);
        res.json({ success: true });

    } catch (err) {
        console.error("Simulation Error:", err);
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
