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
    iTokens: 11300,
    createdAt: new Date().toISOString(),
    status: 'pending_qr',
  },
];

// In-memory store for UPI Partners and their Admin ON/OFF statuses
let upiPartners = [
  { id: 'paytm_bus', name: 'Paytm Business', desc: 'Paytm Business is an Indian digital payment platform.', tags: [], enabled: false, iconBg: '#00baf2', iconText: 'Paytm Business' },
  { id: 'phonepe_bus', name: 'Phonepe Business', desc: 'PhonePe Business is an Indian digital payment platform.', tags: [], enabled: false, iconBg: '#5f259f', iconText: 'pe' },
  { id: 'mobikwik', name: 'Mobikwik', desc: 'MobiKwik is an Indian digital payment platform.', tags: ['Sell'], enabled: true, iconBg: '#0066ff', iconText: 'mb' },
  { id: 'paytm', name: 'Paytm', desc: 'Paytm is an Indian digital payment platform.', tags: ['Sell', 'Buy'], enabled: true, iconBg: '#00baf2', iconText: 'Paytm' },
  { id: 'phonepe', name: 'Phonepe', desc: 'PhonePe is an Indian digital payment platform.', tags: ['Sell'], enabled: true, iconBg: '#5f259f', iconText: 'pe' },
  { id: 'freecharge', name: 'Freecharge', desc: 'Freecharge offers digital payment and mobile recharge services in India.', tags: [], enabled: false, iconBg: '#ff5722', iconText: 'fc' },
  { id: 'airtel', name: 'Airtel', desc: 'Airtel is an Indian digital payment platform.', tags: ['Sell'], enabled: true, iconBg: '#e40000', iconText: 'airtel' },
  { id: 'slice', name: 'Slice', desc: 'Slice is an Indian digital payment platform.', tags: [], enabled: false, iconBg: '#d8b4fe', iconText: 'slice' },
  { id: 'induspay', name: 'IndusPay', desc: 'IndusPay is an Indian digital payment platform.', tags: ['Buy'], enabled: true, iconBg: '#800020', iconText: 'indus' },
  { id: 'amazonpay', name: 'Amazon Pay', desc: 'Amazon Pay is an Indian digital payment platform.', tags: ['Sell', 'Buy'], enabled: true, iconBg: '#ff9900', iconText: 'amazon' },
  { id: 'navi', name: 'Navi', desc: 'Navi is an Indian digital payment platform.', tags: [], enabled: false, iconBg: '#a7f3d0', iconText: 'navi' },
  { id: 'moneyview', name: 'MoneyView', desc: 'MoneyView is an Indian digital payment platform.', tags: ['Buy'], enabled: true, iconBg: '#0f5132', iconText: 'mv' },
  { id: 'bharatpe_bus', name: 'BharatPe Business', desc: 'BharatPe Business is an Indian digital payment platform.', tags: ['Sell'], enabled: true, iconBg: '#00b4d8', iconText: 'bp' },
  { id: 'iob_vyapar', name: 'IOB UPI Vyapar', desc: 'IOB UPI Vyapar is an Indian digital payment platform.', tags: ['Sell'], enabled: true, iconBg: '#6b21a8', iconText: 'iob' },
  { id: 'utk', name: 'UTK', desc: 'UTK is an Indian digital payment platform.', tags: [], enabled: false, iconBg: '#f472b6', iconText: 'utk' },
  { id: 'esaf', name: 'ESAF UPI', desc: 'ESAF is an Indian digital payment platform.', tags: [], enabled: false, iconBg: '#f87171', iconText: 'esaf' },
  { id: 'jio', name: 'Jio Finance', desc: 'Jio Finance is an Indian digital payment platform.', tags: [], enabled: false, iconBg: '#fdba74', iconText: 'jio' },
];

// In-memory store for User KYC Requests
let kycRequests = [];

// Helper to clean up expired pending requests (> 5 minutes)
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const filterExpiredRequests = () => {
  const now = Date.now();
  depositRequests = depositRequests.filter((r) => {
    if (r.status === 'pending_qr') {
      const age = now - new Date(r.createdAt).getTime();
      return age < FIVE_MINUTES_MS; // Keep only if less than 5 minutes old
    }
    return true; // Keep completed/success requests
  });
};

// POST /api/deposit-request - Register user USDT deposit request
router.post('/deposit-request', (req, res) => {
  try {
    const { phone, usdtAmount, iTokens } = req.body;
    const userPhone = phone || 'Guest User';

    // Auto-clean expired pending requests first
    filterExpiredRequests();

    // Remove previous pending requests from same user
    depositRequests = depositRequests.filter((r) => !(r.phone === userPhone && r.status === 'pending_qr'));

    const newRequest = {
      id: Date.now().toString(),
      phone: userPhone,
      usdtAmount: parseFloat(usdtAmount) || 100,
      iTokens: parseFloat(iTokens) || parseFloat(usdtAmount || 100) * 113,
      createdAt: new Date().toISOString(),
      status: 'pending_qr',
    };

    depositRequests.unshift(newRequest);
    if (depositRequests.length > 50) depositRequests = depositRequests.slice(0, 50);

    return res.json({ success: true, request: newRequest });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

// GET /api/admin/deposit-requests - Fetch all deposit requests for Admin Panel (Auto-purges >5 min expired pending)
router.get('/deposit-requests', (req, res) => {
  filterExpiredRequests();
  return res.json({ success: true, requests: depositRequests });
});

// DELETE /api/admin/deposit-requests/:id - Clear request
router.delete('/deposit-requests/:id', (req, res) => {
  const { id } = req.params;
  depositRequests = depositRequests.filter((r) => r.id !== id);
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

// POST /api/admin/settings - Save/Update admin USDT settings & fulfill deposit request
router.post('/settings', async (req, res) => {
  try {
    const { usdtAddress, usdtQrUrl, requestId, phone } = req.body;
    if (usdtAddress !== undefined) memorySettings.usdtAddress = usdtAddress;
    if (usdtQrUrl !== undefined) memorySettings.usdtQrUrl = usdtQrUrl;

    // Filter expired requests first
    filterExpiredRequests();

    // Mark the request as 'success' when admin uploads address & QR image!
    if (memorySettings.usdtAddress && memorySettings.usdtQrUrl) {
      depositRequests.forEach((r) => {
        if (requestId && r.id === requestId) {
          r.status = 'success';
          r.fulfilledAt = new Date().toISOString();
        } else if (phone && r.phone === phone && r.status === 'pending_qr') {
          r.status = 'success';
          r.fulfilledAt = new Date().toISOString();
        } else if (!requestId && !phone && r.status === 'pending_qr') {
          r.status = 'success';
          r.fulfilledAt = new Date().toISOString();
        }
      });
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
      message: 'USDT deposit settings saved & request fulfilled successfully.',
      settings: memorySettings,
      requests: depositRequests,
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

// GET /api/admin/upi-partners or /api/upi-partners - Fetch all UPI partners status
router.get(['/upi-partners', '/admin/upi-partners'], (req, res) => {
  return res.json({ success: true, partners: upiPartners });
});

// POST /api/admin/upi-partners/toggle or /api/upi-partners/toggle - Toggle partner ON/OFF status
router.post(['/upi-partners/toggle', '/admin/upi-partners/toggle'], (req, res) => {
  try {
    const { partnerId, enabled } = req.body;
    upiPartners = upiPartners.map((p) => {
      if (p.id === partnerId) {
        return { ...p, enabled: Boolean(enabled) };
      }
      return p;
    });
    return res.json({ success: true, message: 'UPI Partner updated.', partners: upiPartners });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update UPI partner.' });
  }
});

// POST /api/user/link-kyc or /link-kyc - Register user KYC request
router.post(['/user/link-kyc', '/link-kyc', '/admin/user/link-kyc'], (req, res) => {
  try {
    const { phone, userName, upiNo, partnerId, partnerName } = req.body;
    if (!userName || !upiNo || upiNo.trim().length !== 10) {
      return res.status(400).json({ error: 'Please enter name and a 10-digit mobile number.' });
    }

    const userPhone = phone || '9341048237';
    const newKycReq = {
      id: 'kyc_' + Date.now(),
      phone: userPhone,
      userName: userName.trim(),
      upiNo: upiNo.trim(),
      partnerId: partnerId || 'paytm',
      partnerName: partnerName || 'Paytm',
      status: 'Waiting for KYC',
      createdAt: new Date().toISOString(),
    };

    // Remove old pending KYC for same user if exists
    kycRequests = kycRequests.filter((k) => !(k.phone === userPhone && k.partnerId === newKycReq.partnerId));
    kycRequests.unshift(newKycReq);

    return res.json({ success: true, request: newKycReq });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit KYC request.' });
  }
});

// GET /api/user/kyc-requests or /kyc-requests - Fetch user active KYC requests
router.get(['/user/kyc-requests', '/kyc-requests', '/admin/user/kyc-requests'], (req, res) => {
  const { phone } = req.query;
  const userPhone = phone || '9341048237';
  const userReqs = kycRequests.filter((k) => k.phone === userPhone);
  return res.json({ success: true, requests: userReqs });
});

// GET /api/admin/kyc-requests - Fetch all KYC requests for Admin Panel
router.get(['/admin/kyc-requests', '/all-kyc-requests'], (req, res) => {
  return res.json({ success: true, requests: kycRequests });
});

module.exports = router;
