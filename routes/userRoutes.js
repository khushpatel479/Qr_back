const express = require('express');
const router = express.Router();
const protect = require('../middleware/Authmiddleware');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/userContoller');

// ── Public routes (no token needed) ──────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);

// ── Private routes (token required) ──────────────────────────────────────────
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;