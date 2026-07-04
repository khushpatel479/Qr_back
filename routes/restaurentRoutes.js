const express = require('express');
const router = express.Router();
const protect = require('../middleware/Authmiddleware');
const {
  createRestaurant,
  getMyRestaurants,
  getRestaurantById,
  updateRestaurant,
  toggleRestaurant,
  getQRCode,
  deleteRestaurant,
  getPublicMenu,
} = require('../controllers/restaurentController');

// ── Public route ──────────────────────────────────────────────────────────────
router.get('/menu/:slug', getPublicMenu);

// ── Private routes ────────────────────────────────────────────────────────────
router.post('/create',      protect, createRestaurant);
router.get('/my',           protect, getMyRestaurants);

// ← these specific routes MUST come before /:id
router.get('/:id/qr',      protect, getQRCode);
router.patch('/:id/toggle', protect, toggleRestaurant);
router.put('/:id',          protect, updateRestaurant);
router.delete('/:id',       protect, deleteRestaurant);

// ← /:id must be LAST otherwise it catches /my and /qr
router.get('/:id',          protect, getRestaurantById);

module.exports = router;