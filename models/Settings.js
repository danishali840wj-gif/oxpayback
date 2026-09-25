const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  usdtAddress: { type: String, default: 'TMfHZ2iFheRkwrTzmEaxJoHw6XUf2s5w9C' },
  usdtQrUrl: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Settings', settingsSchema);
