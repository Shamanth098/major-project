const mongo = require("mongodb");

const MongoClient = mongo.MongoClient;

// --- CRITICAL CHANGE: Switched from MongoDB Atlas to Localhost ---
// Connection URL for the local MongoDB server running on port 27017
const MONGO_URL = process.env.MONGO_URL;

// mongodb+srv://shamanthgb0987_db_user:44KIEIsq23gwKKU0@project.ddvuzuw.mongodb.net/?appName=project


let _db;

const mongoConnect = (callback) => {
    // Note: Added an explicit console log to confirm successful connection
    MongoClient.connect(MONGO_URL)
        .then((client) => {
            _db = client.db('soliders'); // 'soliders' is the database name
            console.log("Database connection successful to Localhost MongoDB!");
            callback();
        })
        .catch(err => {
            console.log("Error while connecting to mongo. Check if your local MongoDB server is running (mongod).", err);
            // It's good practice to exit the process if the DB connection fails
            throw err;
        });
};

const getDb = () => {
    if (!_db) {
        throw new Error("No database connection found!");
    }
    return _db;
};

// Export both utility functions
module.exports = {
    mongoConnect: mongoConnect,
    getDb: getDb
};