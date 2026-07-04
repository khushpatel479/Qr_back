const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  logo:        { type: String, default: '' },
  address:     { type: String, default: '' },
  phone:       { type: String, default: '' },
  cuisine:     { type: String, default: '' },

  // unique URL slug — yoursite.com/menu/THIS-SLUG
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  // QR code base64 image — generated ONCE when restaurant is created
  // saved here so we never regenerate it again
  qrCode: {
    type: String,
    default: ''
  },

  // the actual URL that is baked inside the QR code
  menuUrl: {
    type: String,
    default: ''
  },

  isActive: { type: Boolean, default: true },

}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);