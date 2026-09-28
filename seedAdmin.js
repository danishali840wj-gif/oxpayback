const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/authRoutes');

const DEFAULT_MONGO_URI = 'mongodb://danishali840wj_db_user:jp7yRc7fWyPgIJQ3@ac-26udp0r-shard-00-00.lcwftcr.mongodb.net:27017,ac-26udp0r-shard-00-01.lcwftcr.mongodb.net:27017,ac-26udp0r-shard-00-02.lcwftcr.mongodb.net:27017/oxpay?ssl=true&replicaSet=atlas-z50mpv-shard-0&authSource=admin&appName=Cluster0';
const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO_URI;

async function runSeed() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI, {
      dbName: 'oxpay',
      serverSelectionTimeoutMS: 15000,
    });
    console.log('Connected to MongoDB Atlas successfully.');

    if (authRoutes && authRoutes.seedAdminToDb) {
      await authRoutes.seedAdminToDb();
      console.log('Admin & test user seeding complete!');
    } else {
      console.error('seedAdminToDb function not found in authRoutes.');
    }
  } catch (err) {
    console.error('Seeding Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runSeed();
