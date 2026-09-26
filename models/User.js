const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  inviterCode: {
    type: String,
    default: 'ioRcph47gQ',
  },
  referralCode: {
    type: String,
    default: function () {
      return 'REF' + Math.floor(100000 + Math.random() * 900000);
    },
  },
  iTokenBalance: {
    type: Number,
    default: 0,
  },
  todayProfit: {
    type: Number,
    default: 0,
  },
  rewardPercent: {
    type: Number,
    default: 6,
  },
  accountHolderName: {
    type: String,
    default: '',
  },
  accountNumber: {
    type: String,
    default: '',
  },
  ifscCode: {
    type: String,
    default: '',
  },
  bankName: {
    type: String,
    default: '',
  },
  upiId: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
