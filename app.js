const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const dotenv     = require('dotenv');

dotenv.config();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));        // allow base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/users',       require('./routes/userRoutes'));
app.use('/api/restaurants', require('./routes/restaurentRoutes'));
app.use('/api/categories',  require('./routes/categoryRoutes'));
app.use('/api/items',       require('./routes/menuItemRoutes'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'QR Menu API is running',
    version: '1.0.0',
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong. Please try again.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ─── Connect MongoDB and start server ─────────────────────────────────────────
const PORT = process.env.PORT || 4012;

mongoose
  .connect(process.env.MONGO_URI, {dbName: "QR_CODE_RESTAURENTS"})
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });