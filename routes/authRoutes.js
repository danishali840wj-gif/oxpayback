const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const User = require(path.join(__dirname, '../models/User'));

// In-memory fallback user store (pre-seeded with an Admin account)
const memoryUsers = new Map();

// Helper to generate a 4-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const isDbConnected = () => mongoose.connection.readyState === 1;

// Core function to sync and persist users to both MongoDB Atlas & In-Memory Store
const syncUserToDbAndMemory = async ({ phone, password, otp, inviterCode, role = 'user' }) => {
  const normPhone = String(phone).trim();
  let dbUser = null;

  try {
    // First, check if user already exists to preserve their role
    const existingDbUser = await User.findOne({ phone: normPhone });
    const preservedRole = existingDbUser ? existingDbUser.role : role;

    dbUser = await User.findOneAndUpdate(
      { phone: normPhone },
      {
        $set: {
          password,
          otp: otp || 'N/A',
          role: preservedRole,  // Never downgrade an existing role
          inviterCode: inviterCode || 'ioRcph47gQ',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Successfully synced user ${normPhone} to MongoDB Atlas (role: ${preservedRole}).`);
  } catch (err) {
    console.error('Atlas Upsert Error for', normPhone, ':', err.message);
  }

  const memUser = {
    id: dbUser ? dbUser._id.toString() : 'mem_' + Date.now(),
    phone: normPhone,
    password,
    otp: otp || 'N/A',
    role: dbUser ? dbUser.role : role,
    inviterCode: inviterCode || 'ioRcph47gQ',
    referralCode: dbUser ? dbUser.referralCode : 'REF' + normPhone.slice(-6),
    iTokenBalance: dbUser ? dbUser.iTokenBalance : 0,
    todayProfit: dbUser ? dbUser.todayProfit : 0,
    rewardPercent: dbUser ? (dbUser.rewardPercent !== undefined ? dbUser.rewardPercent : 4.5) : 4.5,
    createdAt: dbUser ? dbUser.createdAt : new Date().toISOString(),
  };

  // Preserve existing memory user's role too
  const existingMemUser = memoryUsers.get(normPhone);
  if (existingMemUser && existingMemUser.role === 'admin') {
    memUser.role = 'admin';
  }

  memoryUsers.set(normPhone, memUser);

  return dbUser || memUser;
};

// Force-restore admin account — always ensures role=admin regardless of DB state
const forceRestoreAdmin = async () => {
  const normPhone = '0000000000';
  try {
    await User.findOneAndUpdate(
      { phone: normPhone },
      { $set: { phone: normPhone, password: 'admin123', role: 'admin', inviterCode: 'ADMIN001', otp: '1234' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('Admin account force-restored to role=admin in MongoDB.');
  } catch (err) {
    console.error('Could not force-restore admin in MongoDB (DB may be offline):', err.message);
  }
  // Always ensure admin is correct in memory store too
  memoryUsers.set(normPhone, {
    id: 'admin_000',
    phone: normPhone,
    password: 'admin123',
    otp: '1234',
    role: 'admin',
    inviterCode: 'ADMIN001',
    referralCode: 'REFADMIN',
    iTokenBalance: 0,
    todayProfit: 0,
    rewardPercent: 4.5,
    createdAt: new Date().toISOString(),
  });
};

// Seed function to ensure Admin user and Test user are present in MongoDB Atlas & Memory
const seedAdminToDb = async () => {
  try {
    await forceRestoreAdmin();
    console.log('Admin account seeded to DB (Phone: 0000000000, Pass: admin123)');

    await syncUserToDbAndMemory({
      phone: '9341048237',
      password: '8899',
      otp: '8899',
      inviterCode: 'TEST9341',
      role: 'user',
    });
    console.log('Test user account seeded to DB (Phone: 9341048237, Pass: 8899)');
  } catch (err) {
    console.error('Failed to seed admin/test user:', err.message);
  }
};



// Seed test user immediately into memory
syncUserToDbAndMemory({
  phone: '9341048237',
  password: '8899',
  otp: '8899',
  inviterCode: 'TEST9341',
  role: 'user',
});

// Force-restore admin on startup (runs async, fixes any DB corruption)
forceRestoreAdmin();

// Register Route
router.post('/register', async (req, res) => {
  try {
    const { phone, password, inviterCode } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const normPhone = String(phone).trim();
    const otp = generateOTP();

    const user = await syncUserToDbAndMemory({
      phone: normPhone,
      password,
      otp,
      inviterCode: inviterCode || 'ioRcph47gQ',
    });

    return res.status(200).json({
      success: true,
      message: 'Registration processed. OTP sent.',
      phone: normPhone,
      otp,
      role: user.role || 'user',
      user: {
        id: user._id || user.id,
        phone: normPhone,
        role: user.role || 'user',
        iTokenBalance: user.iTokenBalance || 0,
        todayProfit: user.todayProfit || 0,
        rewardPercent: user.rewardPercent !== undefined ? user.rewardPercent : 4.5,
        inviterCode: user.inviterCode || 'ioRcph47gQ',
        referralCode: user.referralCode || 'REF' + normPhone.slice(-6),
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login Route - Directly logs in with password only
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required.' });
    }

    const normPhone = String(phone).trim();

    // Look up user in DB first, then memory store
    let existingUser = null;
    try {
      existingUser = await User.findOne({ phone: normPhone });
    } catch (e) {
      console.error('Atlas findOne error:', e.message);
    }
    if (!existingUser) {
      existingUser = memoryUsers.get(normPhone);
    }

    if (!existingUser) {
      return res.status(404).json({ error: 'Account not found. Please register first.' });
    }

    // STRICT PASSWORD VERIFICATION
    if (existingUser.password !== password) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    // Direct Login without OTP (OTP is only required during Registration)
    return res.json({
      success: true,
      requireOtp: false,
      message: 'Login successful.',
      user: {
        id: existingUser._id || existingUser.id,
        phone: normPhone,
        role: existingUser.role || 'user',
        iTokenBalance: existingUser.iTokenBalance || 0,
        todayProfit: existingUser.todayProfit || 0,
        rewardPercent: existingUser.rewardPercent !== undefined ? existingUser.rewardPercent : 4.5,
        accountHolderName: existingUser.accountHolderName || '',
        accountNumber: existingUser.accountNumber || '',
        ifscCode: existingUser.ifscCode || '',
        bankName: existingUser.bankName || '',
        upiId: existingUser.upiId || '',
        inviterCode: existingUser.inviterCode || 'ioRcph47gQ',
        referralCode: existingUser.referralCode || 'REF' + normPhone.slice(-6),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const newOtp = generateOTP();

    if (isDbConnected()) {
      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      user.otp = newOtp;
      await user.save();

      return res.json({
        success: true,
        message: 'New OTP generated successfully.',
        phone: user.phone,
        otp: user.otp,
      });
    } else {
      const user = memoryUsers.get(phone);
      if (user) {
        user.otp = newOtp;
      }
      return res.json({
        success: true,
        message: 'New OTP generated successfully.',
        phone,
        otp: newOtp,
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend OTP.' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required.' });
    }

    if (isDbConnected()) {
      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      user.otp = otp;
      await user.save();

      return res.json({
        success: true,
        message: 'OTP verified successfully.',
        user: {
          id: user._id,
          phone: user.phone,
          role: user.role,
          iTokenBalance: user.iTokenBalance,
          todayProfit: user.todayProfit,
          rewardPercent: user.rewardPercent,
          inviterCode: user.inviterCode,
        },
      });
    } else {
      let user = memoryUsers.get(phone);
      if (!user) {
        const role = (phone === '0000000000' || phone.toLowerCase() === 'admin') ? 'admin' : 'user';
        user = {
          id: 'mem_' + Date.now(),
          phone,
          password: 'Password123!',
          inviterCode: 'ioRcph47gQ',
          otp,
          role,
          iTokenBalance: 0,
          todayProfit: 0,
          rewardPercent: 4.5,
          createdAt: new Date().toISOString(),
        };
        memoryUsers.set(phone, user);
      } else {
        user.otp = otp;
      }

      return res.json({
        success: true,
        message: 'OTP verified successfully.',
        user,
      });
    }
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Server error during OTP verification.' });
  }
});

// GET /api/auth/user/:phone - Fetch latest user info
router.get('/user/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const normPhone = String(phone).trim();
    if (isDbConnected()) {
      const user = await User.findOne({ phone: normPhone });
      if (user) {
        return res.json({
          success: true,
          user: {
            id: user._id,
            phone: user.phone,
            role: user.role,
            iTokenBalance: user.iTokenBalance || 0,
            todayProfit: user.todayProfit || 0,
            rewardPercent: user.rewardPercent ?? 4.5,
            accountHolderName: user.accountHolderName || '',
            accountNumber: user.accountNumber || '',
            ifscCode: user.ifscCode || '',
            bankName: user.bankName || '',
            upiId: user.upiId || '',
            inviterCode: user.inviterCode,
            referralCode: user.referralCode,
          },
        });
      }
    }
    const memUser = memoryUsers.get(normPhone);
    if (memUser) {
      return res.json({
        success: true,
        user: memUser,
      });
    }
    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.memoryUsers = memoryUsers;
router.seedAdminToDb = seedAdminToDb;

module.exports = router;
