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
    data: Buffer,
    contentType: String
  },
  isAvailable:  { type: Boolean, default: true },
  isVeg:        { type: Boolean, default: false },
  isBestseller: { type: Boolean, default: false },
  order:        { type: Number, default: 0 },
}, { timestamps: true });

// 🔥 FIXED: Better virtual handling
menuItemSchema.virtual('imageUrl').get(function() {
  if (this.image && this.image.data && this.image.data.length > 0) {
    return `data:${this.image.contentType};base64,${this.image.data.toString('base64')}`;
  }
  return null;
});

// Check if image exists
menuItemSchema.virtual('hasImage').get(function() {
  return !!(this.image && this.image.data && this.image.data.length > 0);
});

menuItemSchema.set('toJSON', { virtuals: true });
menuItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);