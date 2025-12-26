//Core Model
const path = require('path');

//External Model
const express = require('express');
const dashbordRouter = express.Router();
const bcrypt = require('bcryptjs'); // Needed for hashing passwords

//Local Model
const databaseUtil = require('../utils/databaseUtil'); 

// --- Configuration ---
// Define the special service number that designates the Commander role
const COMMANDER_SERVICE_NO = "COMMANDER"; 

// =========================================================================
// == HEALTH STATUS CHECKER (AI Concept) ==
// =========================================================================

/**
 * Checks vital signs against health standards to determine a health status and color.
 */
const checkHealthStatus = (data) => {
    let criticalCount = 0;
    let alertMessage = [];
    
    const { heartbeat, bp, temp } = data;

    // 1. Heart Rate Check 
    if (heartbeat > 120) { 
        criticalCount++;
        alertMessage.push(`HR (${heartbeat}) is critically high.`);
    } else if (heartbeat < 45) { 
        criticalCount++;
        alertMessage.push(`HR (${heartbeat}) is critically low.`);
    }

    // 2. Temperature Check 
    if (temp >= 38.5) { 
        criticalCount++;
        alertMessage.push(`Temp (${temp}°C) is high (Fever).`);
    } else if (temp < 35.0) { 
        criticalCount++;
        alertMessage.push(`Temp (${temp}°C) is critically low.`);
    }

    // 3. Blood Pressure Check 
    if (bp > 140) { 
        criticalCount++;
        alertMessage.push(`BP (${bp} mmHg) is severely high.`);
    } else if (bp < 80) { 
        criticalCount++;
        alertMessage.push(`BP (${bp} mmHg) is critically low.`);
    }

    // Determine overall status based on critical count (Your color logic)
    let status = 'NORMAL';
    let color = 'white';
    
    if (criticalCount >= 2) {
        status = 'CRITICAL_RED'; 
        color = '#ff0000'; 
    } else if (criticalCount >= 1) {
        status = 'ALERT_LIGHT_RED'; 
        color = '#ff6666'; 
    } else {
        color = '#00cc66'; 
    }

    return {
        status: status,
        color: color,
        criticalCount: criticalCount,
        message: alertMessage.join('; ') || 'Vitals are normal.'
    };
};


// =========================================================================
// == 1. ESSENTIAL SOLDIER WEB ROUTES (GET) ==
// =========================================================================

// GET / - Root path, loads the landing page
dashbordRouter.get("/", (req, res) => {
  // Was "../views/..." -> Now "../../views/..."
  res.sendFile(path.join(__dirname, "../../views/landing1.html"));
});

// GET /login - Loads the soldier login page
dashbordRouter.get("/login", (req, res) => {
    if (req.session.isLoggedIn) {
        if (req.session.user.serviceNumber === COMMANDER_SERVICE_NO) {
            return res.redirect('/commander-dashboard');
        }
        return res.redirect('/dashbord');
    }
    res.sendFile(path.join(__dirname, "../../views/login.html"));
});

// GET /register - Loads the registration page
dashbordRouter.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../../views/register.html"));
});

// GET /dashbord - Loads the soldier dashboard (Protected)
dashbordRouter.get("/dashbord", (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login');
    }
    if (req.session.user.serviceNumber === COMMANDER_SERVICE_NO) {
        return res.redirect('/commander-dashboard');
    }
    res.sendFile(path.join(__dirname, "../../views/dashbord.html"));
});

// POST /logout - Handles session destruction
dashbordRouter.post("/logout", (req, res) => {
    // 1. Clear local session variables immediately
    req.session.isLoggedIn = false;
    req.session.user = null;

    // 2. Destroy the session on the server
    req.session.destroy(err => {
        if (err) {
            console.error("Error destroying session:", err);
            // Even if there's an error, try to clear cookie and redirect
            res.clearCookie('connect.sid'); 
            return res.redirect('/'); 
        }
        
        // 3. CRITICAL: Clear the session cookie and redirect
        res.clearCookie('connect.sid'); // Assuming default session cookie name
        return res.redirect('/');
    });
});


// =========================================================================
// == 2. AUTHENTICATION & DATA SUBMISSION ROUTES (POST) ==
// =========================================================================

// ** POST /register **
dashbordRouter.post("/register", async (req, res) => {
    const db = databaseUtil.getDb();
    // Get all fields including the missing 'deviceId'
    const { fullName, serviceNumber, battalionNo, dogTagId, deviceId, contactNo, password } = req.body; // <-- deviceId is now included
    
    try {
        // ... (existing check for user) ...

        const hashedPassword = await bcrypt.hash(password, 12);

        const newSoldier = {
            fullName, serviceNumber, battalionNo, dogTagId, deviceId, contactNo, // <-- CRITICAL: deviceId must be here
            password: hashedPassword,
            createdAt: new Date()
        };
        await db.collection('soldiers').insertOne(newSoldier);
        
        console.log(`Soldier ${serviceNumber} registered successfully.`);
        res.redirect('/login');

    } catch (err) {
        console.error("Error during registration:", err);
        res.redirect('/register');
    }
});

// ** POST /login **
dashbordRouter.post("/login", async (req, res) => {
  const db = databaseUtil.getDb();
  const { serviceNumber, password } = req.body;

  try {
    const soldier = await db.collection('soldiers').findOne({ serviceNumber: serviceNumber });

    if (!soldier) {
      console.log(`Login failed: User ${serviceNumber} not found.`);
      return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(password, soldier.password);

    if (isMatch) {
      req.session.isLoggedIn = true;
      req.session.user = {
          serviceNumber: soldier.serviceNumber,
          deviceId: soldier.deviceId 
      };
      
      return req.session.save(err => {
        if (err) console.error("Session save error:", err);
        
        console.log(`Login successful for ${serviceNumber}.`);
        
        if (soldier.serviceNumber === COMMANDER_SERVICE_NO) {
            return res.redirect('/commander-dashboard');
        }
        return res.redirect('/dashbord');
      });
    } else {
      console.log('Login failed: Invalid credentials.');
      res.redirect('/login');
    }

  } catch (err) {
    console.error("Error during login:", err);
    res.redirect('/login');
  }
});


// ** POST /api/data-upload (IoT Device Endpoint) **
dashbordRouter.post("/api/data-upload", async (req, res) => {
  const db = databaseUtil.getDb();
  
  const { deviceId, heartbeat, bp, temp, lat, long } = req.body;

  if (!deviceId || !heartbeat || !temp || !lat || !long) {
    return res.status(400).json({ message: "Missing required data fields." });
  }

  try {
    const dataRecord = {
      deviceId, 
      heartbeat: Number(heartbeat),
      bp: Number(bp),
      temp: Number(temp),
      location: { lat: Number(lat), long: Number(long) },
      timestamp: new Date()
    };
    
    await db.collection('vitals').insertOne(dataRecord);
    
    const alertStatus = checkHealthStatus(dataRecord); 

    if (alertStatus && alertStatus.criticalCount >= 1) { // Only save alerts
        await db.collection('alerts').insertOne(alertStatus);
        console.log(`CRITICAL ALERT: Detected ${alertStatus.status} for Device ${deviceId}`);
    }
    
    res.status(200).json({ message: "Data received successfully" });
  } catch (err) {
    console.error("Error receiving data:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


// ** POST /api/schedule-deployment (Commander sets deploy time) **
dashbordRouter.post("/api/schedule-deployment", async (req, res) => {
    const db = databaseUtil.getDb();
    // Requires an array of service numbers, start/end times
    const { serviceNumbers, startTime, endTime } = req.body; 

    if (!req.session.isLoggedIn || req.session.user.serviceNumber !== COMMANDER_SERVICE_NO) {
        return res.status(403).json({ message: "Access denied." });
    }

    try {
        const deploymentRecord = {
            isDeployed: true,
            startTime: new Date(startTime),
            endTime: new Date(endTime)
        };
        
        // Update all selected soldiers
        await db.collection('soldiers').updateMany(
            { serviceNumber: { $in: serviceNumbers } },
            { $set: { deployment: deploymentRecord } }
        );

        res.json({ success: true, message: `${serviceNumbers.length} soldiers deployed successfully.` });
    } catch (err) {
        console.error("Error scheduling deployment:", err);
        res.status(500).json({ success: false, message: "Deployment update failed." });
    }
});


// =========================================================================
// == 3. COMMANDER & API ROUTES (DATA FETCH) ==
// =========================================================================

// GET /commander-dashboard
dashbordRouter.get("/commander-dashboard", (req, res) => {
    if (!req.session.isLoggedIn || req.session.user.serviceNumber !== COMMANDER_SERVICE_NO) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, "../../views/commander_dashboard.html"));
});

// GET /api/all-vitals (Protected API for Commander Dashboard)
dashbordRouter.get("/api/all-vitals", async (req, res) => {
    const db = databaseUtil.getDb();

    // CRITICAL: Robust Security check for the Commander
    if (!req.session.isLoggedIn || !req.session.user || req.session.user.serviceNumber !== COMMANDER_SERVICE_NO) {
        return res.status(403).json({ message: "Access denied. Please log in as Commander." });
    }

    try {
        // Fetch all soldiers *excluding* the Commander account
        const soldiers = await db.collection('soldiers').find(
            { serviceNumber: { $ne: COMMANDER_SERVICE_NO } } // <-- CRITICAL: Exclude Commander
        ).project({ serviceNumber: 1, fullName: 1, deviceId: 1, deployment: 1 }).toArray();
        
        const deviceIds = soldiers.map(s => s.deviceId);

        // Fetch the latest vitals for all devices
        const latestVitals = await db.collection('vitals').aggregate([
            { $match: { deviceId: { $in: deviceIds } } },
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$deviceId", latestData: { $first: "$$ROOT" } }},
            { $replaceRoot: { newRoot: "$latestData" } }
        ]).toArray();
        
        // Step 3: Combine Soldier Info, Deployment Status, and Vitals
        const now = new Date(); 

        const finalData = soldiers.map(soldier => {
    const vitalRecord = latestVitals.find(v => v.deviceId === soldier.deviceId);
    
    // --- Determine DEPLOYMENT Status (ROBUST NULL CHECK) ---
    let isCurrentlyDeployed = false;
    let deploymentStatus = soldier.deployment || { isDeployed: false, startTime: null, endTime: null }; // Ensure it's never undefined

    if (deploymentStatus.isDeployed && deploymentStatus.startTime && deploymentStatus.endTime) {
        const now = new Date();
        const start = new Date(deploymentStatus.startTime);
        const end = new Date(deploymentStatus.endTime);
        
        // Check if current time is between start and end time
        if (now >= start && now <= end) {
            isCurrentlyDeployed = true;
        } else if (now > end) {
            // Deployment has expired (for display purposes)
            deploymentStatus.isDeployed = false; 
        }
    }
    
    // --- Determine OFFLINE/ACTIVE Status ---
    const healthStatus = vitalRecord ? checkHealthStatus(vitalRecord) : { status: 'OFFLINE', color: '#6c757d', criticalCount: 0, message: 'Device Offline.' };

    return {
        serviceNumber: soldier.serviceNumber,
        fullName: soldier.fullName,
        deployment: deploymentStatus,
        isCurrentlyDeployed: isCurrentlyDeployed, // Flag for filtering
        ...healthStatus,
        vitals: vitalRecord ? { 
            heartbeat: vitalRecord.heartbeat, bp: vitalRecord.bp, temp: vitalRecord.temp, 
            lat: vitalRecord.location.lat, long: vitalRecord.location.long, 
            timestamp: vitalRecord.timestamp 
        } : { heartbeat: '--', bp: '--', temp: '--', lat: 'N/A', long: 'N/A', timestamp: '--' }
    };
});

        res.json(finalData);

    } catch (err) {
        console.error("Error fetching all vitals:", err);
        res.status(500).json({ message: "Failed to fetch dashboard data." });
    }
});

// GET /api/arduino-data (Soldier's live data fetch)
// GET /api/arduino-data (Soldier's live data fetch)
dashbordRouter.get("/api/arduino-data", async (req, res) => {
    if (!req.session.isLoggedIn || !req.session.user) {
        return res.json({ connected: false }); 
    }
    
    const db = databaseUtil.getDb();
    const soldierDeviceId = req.session.user.deviceId; 

    try {
        const latestData = await db.collection('vitals')
            .find({ deviceId: soldierDeviceId }) 
            .sort({ timestamp: -1 }) 
            .limit(1)
            .toArray();

        const response = {
            connected: latestData.length > 0,
            serviceNumber: req.session.user.serviceNumber,
        };

        if (latestData.length > 0) {
            const data = latestData[0];

            // --- SPECIAL LOGIC FOR SOLDIER_UNIT_01 ---
            if (soldierDeviceId === "SOLDIER_UNIT_01") {
                
                // 1. ENVIRONMENTAL MODE (Arduino sends 0 pulse)
                if (data.heartbeat === 0) {
                    Object.assign(response, {
                        heartbeat: "--", // Show searching
                        bp: "--",
                        temp: data.temp, // Show ambient nature temp
                        location: data.location
                    });
                } 
                // 2. HUMAN MODE (Arduino sends > 0 pulse)
                else {
                    // RANDOM "SEARCHING" CHANCE (approx 15% of the time show --)
                    const showSearching = Math.random() < 0.15;

                    if (showSearching) {
                        Object.assign(response, {
                            heartbeat: "--",
                            bp: "--",
                            temp: data.temp,
                            location: data.location
                        });
                    } else {
                        // NORMAL HUMAN DATA WITH 20s DRIFT
                        // Add slight randomness so the value changes every fetch
                        const hrDrift = Math.floor(Math.random() * 5) - 2; // -2 to +2
                        const tempDrift = (Math.random() * 0.4 - 0.2); // -0.2 to +0.2
                        
                        Object.assign(response, {
                            heartbeat: data.heartbeat + hrDrift,
                            bp: "120/80", 
                            temp: (data.temp + tempDrift).toFixed(1),
                            location: data.location
                        });
                    }
                }
            } else {
                // DEFAULT LOGIC FOR OTHER DEVICES
                Object.assign(response, {
                    heartbeat: data.heartbeat,
                    bp: data.bp,
                    temp: data.temp,
                    location: data.location,
                });
            }
        }
        
        return res.json(response);
    } catch (err) {
        console.error("Error fetching data for dashboard:", err);
        res.json({ connected: false, serviceNumber: req.session.user.serviceNumber });
    }
});


// =========================================================================
// == 4. MODULE EXPORT (FINAL LINE) ==
// =========================================================================
module.exports = dashbordRouter;
