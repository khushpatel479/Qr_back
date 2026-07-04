const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  createCategory,
  getCategories,
  updateCategory,
  toggleCategory,
  reorderCategories,
  deleteCategory,
} = require('../controllers/categoryController');

router.post('/create',          protect, createCategory);
router.get('/:restaurantId',    protect, getCategories);
router.put('/:id',              protect, updateCategory);
router.patch('/reorder',        protect, reorderCategories);
router.patch('/:id/toggle',     protect, toggleCategory);
router.delete('/:id',           protect, deleteCategory);

module.exports = router;