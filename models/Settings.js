const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  usdtAddress: { type: String, default: 'TMfHZ2iFheRkwrTzmEaxJoHw6XUf2s5w9C' },
  usdtQrUrl: { type: String, default: '' },
  buyRewardTiers: {
    type: Array,
    default: [
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
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Settings', settingsSchema);
