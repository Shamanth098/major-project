require('dotenv').config();
const express = require("express");
const session = require('express-session'); 
const dashbordRouter = require("./routes/dashbord"); 
const databaseUtil = require("./utils/databaseUtil"); 
const path = require('path');

const app = express();

// --- 1. CONFIGURATION ---
const apiKey = process.env.API_KEY; 

// --- 2. MIDDLEWARE ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'YOUR_VERY_SECURE_RANDOM_KEY', 
    resave: false,
    saveUninitialized: false
}));

app.use(express.urlencoded({ extended: false })); 
app.use(express.json()); // Crucial for IoT JSON
app.use(express.static(path.join(__dirname, '../views')));

// --- 3. THE FIXED DATA UPLOAD ROUTE ---
app.post('/api/data-upload', async (req, res) => {
    const incomingKey = req.headers['x-api-key']; 

    // Security check
    if (incomingKey !== apiKey) {
        return res.status(401).json({ error: "Unauthorized access" });
    }

    // Extract data from Arduino
    const { deviceId, heartRate, temperature, lat, lon } = req.body;
    const db = databaseUtil.getDb();

    try {
        // Map Arduino names to Dashboard names
        const dataRecord = {
            deviceId: deviceId || "SOLDIER_UNIT_01", 
            heartbeat: Number(heartRate), // Mapping heartRate -> heartbeat
            bp: 120,                      // Placeholder for oxygen/BP
            temp: Number(temperature),    // Mapping temperature -> temp
            location: { lat: Number(lat), long: Number(lon) },
            timestamp: new Date()
        };
        
        // SAVE TO DATABASE
        await db.collection('vitals').insertOne(dataRecord);
        
        console.log(`[SUCCESS] Saved vitals for ${deviceId}`);
        res.status(200).json({ status: "Success", message: "Vitals saved" });
    } catch (err) {
        console.error("DB Save Error:", err);
        res.status(500).json({ error: "Failed to save to database" });
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
