const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },

  name:         { type: String, required: true, trim: true },
  description:  { type: String, default: '' },
  price:        { type: Number, required: true, min: 0 },
 image: { 
    data: Buffer,          // Store binary data
    contentType: String     // Store MIME type (e.g., 'image/jpeg')
  },
  isAvailable:  { type: Boolean, default: true },
  isVeg:        { type: Boolean, default: false },
  isBestseller: { type: Boolean, default: false },
  order:        { type: Number, default: 0 },  // display order inside category

}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);