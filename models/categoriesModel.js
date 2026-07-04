const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, default: '' },  // ← not required, generated automatically
  description: { type: String, default: '' },
  image:       { type: String, default: '' },
  order:       { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

// ✅ Remove next() — use async instead
categorySchema.pre('save', async function() {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
});

module.exports = mongoose.model('Category', categorySchema);