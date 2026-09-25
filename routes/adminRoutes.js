const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const User = require(path.join(__dirname, '../models/User'));
const Settings = require(path.join(__dirname, '../models/Settings'));

// In-memory fallback cache for fast response
let memorySettings = {
  usdtAddress: 'TMfHZ2iFheRkwrTzmEaxJoHw6XUf2s5w9C',
  usdtQrUrl: '',
};

// In-memory active deposit requests store (pre-seeded for user 9341048237)
let depositRequests = [
  {
    id: 'req_9341048237',
    phone: '9341048237',
    usdtAmount: 100,
    iTokens: 10750,
    createdAt: new Date().toISOString(),
    status: 'pending_qr',
  },
];

// POST /api/deposit-request - Register user USDT deposit request
router.post('/deposit-request', (req, res) => {
  try {
    const { phone, usdtAmount, iTokens } = req.body;
    const userPhone = phone || 'Guest User';
    
    // Remove existing pending requests from same user
    depositRequests = depositRequests.filter(r => r.phone !== userPhone);

    const newRequest = {
      id: Date.now().toString(),
      phone: userPhone,
      usdtAmount: parseFloat(usdtAmount) || 100,
      iTokens: parseFloat(iTokens) || (parseFloat(usdtAmount || 100) * 107.5),
      createdAt: new Date().toISOString(),
      status: (memorySettings.usdtQrUrl && memorySettings.usdtAddress) ? 'qr_ready' : 'pending_qr',
    };

    depositRequests.unshift(newRequest);
    if (depositRequests.length > 20) depositRequests = depositRequests.slice(0, 20);

    return res.json({ success: true, request: newRequest });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

// GET /api/admin/deposit-requests - Fetch all deposit requests for Admin Panel
router.get('/deposit-requests', (req, res) => {
  return res.json({ success: true, requests: depositRequests });
});

// DELETE /api/admin/deposit-requests/:id - Clear request
router.delete('/deposit-requests/:id', (req, res) => {
  const { id } = req.params;
  depositRequests = depositRequests.filter(r => r.id !== id);
  return res.json({ success: true, requests: depositRequests });
});

// GET /api/admin/settings - Fetch current admin settings
router.get('/settings', async (req, res) => {
  try {
    let settings = null;
    try {
      settings = await Settings.findOne({ key: 'global' });
    } catch (err) {
      console.error('Atlas settings fetch error:', err.message);
    }

    if (settings) {
      memorySettings.usdtAddress = settings.usdtAddress || memorySettings.usdtAddress;
      memorySettings.usdtQrUrl = settings.usdtQrUrl || memorySettings.usdtQrUrl;
    }

    return res.json({
      success: true,
      settings: memorySettings,
    });
  } catch (err) {
    console.error('Settings fetch error:', err);
    return res.json({ success: true, settings: memorySettings });
  }
});

// POST /api/admin/settings - Save/Update admin USDT settings
router.post('/settings', async (req, res) => {
  try {
    const { usdtAddress, usdtQrUrl } = req.body;
    if (usdtAddress !== undefined) memorySettings.usdtAddress = usdtAddress;
    if (usdtQrUrl !== undefined) memorySettings.usdtQrUrl = usdtQrUrl;

    // Update statuses of deposit requests to qr_ready
    if (memorySettings.usdtAddress && memorySettings.usdtQrUrl) {
      depositRequests.forEach(r => { r.status = 'qr_ready'; });
    }

    try {
      await Settings.findOneAndUpdate(
        { key: 'global' },
        { usdtAddress: memorySettings.usdtAddress, usdtQrUrl: memorySettings.usdtQrUrl, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      console.error('Atlas settings save error:', dbErr.message);
    }

    return res.json({
      success: true,
      message: 'USDT deposit settings saved successfully.',
      settings: memorySettings,
    });
  } catch (err) {
    console.error('Settings save error:', err);
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// GET /api/admin/users - Returns users' phone, password, otp, iTokenBalance, rewardPercent
router.get('/users', async (req, res) => {
  try {
    const authRoutes = require(path.join(__dirname, 'authRoutes'));
    const memoryUsers = authRoutes.memoryUsers || new Map();
    let dbUsers = [];

    try {
      dbUsers = await User.find({}, 'phone password otp role iTokenBalance rewardPercent createdAt').sort({ createdAt: -1 });
    } catch (err) {
      console.error('Atlas fetch error:', err.message);
    }

    const userMap = new Map();

    // Populate memory users first
    if (memoryUsers && memoryUsers.values) {
      for (const u of memoryUsers.values()) {
        userMap.set(u.phone, {
          id: u.id || u._id || u.phone,
          phone: u.phone,
          password: u.password,
          otp: u.otp || 'N/A',
          role: u.role || 'user',
          iTokenBalance: u.iTokenBalance ?? 0,
          rewardPercent: u.rewardPercent ?? 6,
          createdAt: u.createdAt || new Date().toISOString(),
        });
      }
    }

    // Populate/merge DB users
    for (const u of dbUsers) {
      userMap.set(u.phone, {
        id: u._id,
        phone: u.phone,
        password: u.password,
        otp: u.otp || 'N/A',
        role: u.role || 'user',
        iTokenBalance: u.iTokenBalance ?? 0,
        rewardPercent: u.rewardPercent ?? 6,
        createdAt: u.createdAt,
      });
    }

    const allUsers = Array.from(userMap.values());

    // Sort users by createdAt descending (newest users first at the top)
    allUsers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return res.json({
      success: true,
      count: allUsers.length,
      users: allUsers,
    });
  } catch (err) {
    console.error('Admin fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user list for admin.' });
  }
});

// PUT /api/admin/users/:identifier - Update user's iTokenBalance (wallet) and rewardPercent
router.put('/users/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { iTokenBalance, rewardPercent } = req.body;

    if (!identifier) {
      return res.status(400).json({ error: 'User identifier is required.' });
    }

    const authRoutes = require(path.join(__dirname, 'authRoutes'));
    const memoryUsers = authRoutes.memoryUsers || new Map();

    const updateFields = {};
    if (iTokenBalance !== undefined && !isNaN(Number(iTokenBalance))) {
      updateFields.iTokenBalance = Number(iTokenBalance);
    }
    if (rewardPercent !== undefined && !isNaN(Number(rewardPercent))) {
      updateFields.rewardPercent = Number(rewardPercent);
    }

    let updatedUserObj = null;

    // Update MongoDB Atlas
    try {
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      const query = isObjectId ? { _id: identifier } : { phone: identifier };

      const dbUser = await User.findOneAndUpdate(query, { $set: updateFields }, { new: true });
      if (dbUser) {
        updatedUserObj = dbUser.toObject();
      }
    } catch (dbErr) {
      console.error('Atlas user update error:', dbErr.message);
    }

    // Update in memoryUsers Map if present
    for (const [phoneKey, u] of memoryUsers.entries()) {
      if (phoneKey === identifier || u.id === identifier || u._id === identifier || String(u.id) === String(identifier)) {
        if (updateFields.iTokenBalance !== undefined) u.iTokenBalance = updateFields.iTokenBalance;
        if (updateFields.rewardPercent !== undefined) u.rewardPercent = updateFields.rewardPercent;
        if (!updatedUserObj) updatedUserObj = u;
      }
    }

    return res.json({
      success: true,
      message: 'User wallet amount and reward percentage updated successfully.',
      user: updatedUserObj,
    });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Failed to update user parameters.' });
  }
});

// DELETE /api/admin/users/:identifier - Delete user by ID or Phone number
router.delete('/users/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ error: 'User identifier is required.' });
    }

    const authRoutes = require(path.join(__dirname, 'authRoutes'));
    const memoryUsers = authRoutes.memoryUsers || new Map();

    let deletedCount = 0;

    // Delete from MongoDB Atlas
    try {
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      const query = isObjectId ? { _id: identifier } : { phone: identifier };

      const targetUser = await User.findOne(query);
      if (targetUser && memoryUsers.has(targetUser.phone)) {
        memoryUsers.delete(targetUser.phone);
      }

      const dbRes = await User.deleteOne(query);
      deletedCount += dbRes.deletedCount || 0;
    } catch (dbErr) {
      console.error('Atlas delete error:', dbErr.message);
    }

    // Delete from memoryUsers map if present by phone or ID
    if (memoryUsers.has(identifier)) {
      memoryUsers.delete(identifier);
      deletedCount++;
    } else {
      for (const [phoneKey, u] of memoryUsers.entries()) {
        if (u.id === identifier || u._id === identifier || String(u.id) === String(identifier)) {
          memoryUsers.delete(phoneKey);
          deletedCount++;
        }
      }
    }

    return res.json({
      success: true,
      message: `User deleted successfully.`,
      deletedCount,
    });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;
