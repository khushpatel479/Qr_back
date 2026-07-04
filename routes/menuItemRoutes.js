const express = require('express');
const router = express.Router();
const protect = require('../middleware/Authmiddleware');
const {
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  getMenuItemImage,
  updateMenuItem,
  toggleMenuItem,
  reorderMenuItems,
  deleteMenuItem,
} = require('../controllers/menuItemController');

// Public route for images (or protect if needed)
router.get('/image/:id', getMenuItemImage);

// Protected routes
router.post('/create',             protect, createMenuItem);
router.get('/:restaurantId',       protect, getMenuItems);
router.get('/single/:id',          protect, getMenuItemById);
router.put('/:id',                 protect, updateMenuItem);
router.patch('/reorder',           protect, reorderMenuItems);
router.patch('/:id/toggle',        protect, toggleMenuItem);
router.delete('/:id',              protect, deleteMenuItem);

module.exports = router;