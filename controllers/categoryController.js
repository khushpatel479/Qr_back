const Category = require('../models/categoriesModel');
const MenuItem = require('../models/menuItems');
const Restaurant = require('../models/restaurentModel');

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/categories/create
// @desc    Add a new category to a restaurant (e.g. Starters, Drinks)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createCategory = async (req, res) => {
  try {
    const { restaurantId, name, description, image } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { restaurantId: 'Restaurant ID is required' }
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Category name is required' }
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Category name must be at least 2 characters' }
      });
    }

    if (name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Category name cannot exceed 50 characters' }
      });
    }

    // ── Check restaurant belongs to this owner ────────────────────────────────
    const restaurant = await Restaurant.findOne({
      _id:   restaurantId,
      owner: req.userId,
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // ── Check duplicate category name in same restaurant ──────────────────────
    const duplicate = await Category.findOne({
      restaurant: restaurantId,
      name:       { $regex: new RegExp(`^${name.trim()}$`, 'i') }, // case-insensitive
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Validation failed',
        errors: { name: `Category "${name}" already exists in this restaurant` }
      });
    }

    // ── Get order number (add to end) ─────────────────────────────────────────
    const count = await Category.countDocuments({ restaurant: restaurantId });

    // ── Create category ───────────────────────────────────────────────────────
    const category = await Category.create({
      restaurant:  restaurantId,
      name:        name.trim(),
      description: description ? description.trim() : '',
      image:       image ? image.trim() : '',
      order:       count, // e.g. 0, 1, 2, 3...
    });

    res.status(201).json({
      success: true,
      message: `Category "${category.name}" created successfully`,
      category,
    });

  } catch (error) {
    console.error('CreateCategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/categories/:restaurantId
// @desc    Get all categories of a restaurant
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getCategories = async (req, res) => {
  try {
    // verify restaurant belongs to owner
    const restaurant = await Restaurant.findOne({
      _id:   req.params.restaurantId,
      owner: req.userId,
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    const categories = await Category.find({
      restaurant: req.params.restaurantId
    }).sort({ order: 1 });

    // also get item count per category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const itemCount = await MenuItem.countDocuments({
          category: cat._id
        });
        const availableCount = await MenuItem.countDocuments({
          category:    cat._id,
          isAvailable: true
        });
        return {
          ...cat.toObject(),
          itemCount,
          availableCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: categories.length,
      categories: categoriesWithCount,
    });

  } catch (error) {
    console.error('GetCategories error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/categories/:id
// @desc    Update category name, description, image
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Category name is required' }
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Category name must be at least 2 characters' }
      });
    }

    // ── Find category ─────────────────────────────────────────────────────────
    const category = await Category.findById(req.params.id).populate('restaurant');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // ── Verify ownership ──────────────────────────────────────────────────────
    if (category.restaurant.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this category'
      });
    }

    // ── Check duplicate name (excluding current category) ─────────────────────
    const duplicate = await Category.findOne({
      restaurant: category.restaurant._id,
      name:       { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id:        { $ne: req.params.id },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Validation failed',
        errors: { name: `Category "${name}" already exists in this restaurant` }
      });
    }

    // ── Update ────────────────────────────────────────────────────────────────
    category.name        = name.trim();
    category.description = description ? description.trim() : category.description;
    category.image       = image ? image.trim() : category.image;

    await category.save(); // pre-save hook will update slug automatically

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category,
    });

  } catch (error) {
    console.error('UpdateCategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/categories/:id/toggle
// @desc    Toggle category active/inactive (show/hide on menu)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const toggleCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate('restaurant');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (category.restaurant.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category "${category.name}" is now ${category.isActive ? 'visible' : 'hidden'} on menu`,
      isActive: category.isActive,
    });

  } catch (error) {
    console.error('ToggleCategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/categories/reorder
// @desc    Reorder categories (drag and drop order)
// @access  Private
// body: { orders: [{ id: "catId", order: 0 }, { id: "catId2", order: 1 }] }
// ─────────────────────────────────────────────────────────────────────────────
const reorderCategories = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Orders array is required'
      });
    }

    // update order for each category
    await Promise.all(
      orders.map(({ id, order }) =>
        Category.findByIdAndUpdate(id, { order })
      )
    );

    res.status(200).json({
      success: true,
      message: 'Categories reordered successfully',
    });

  } catch (error) {
    console.error('ReorderCategories error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/categories/:id
// @desc    Delete category and all its items
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate('restaurant');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (category.restaurant.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this category'
      });
    }

    // delete all items under this category first
    const deletedItems = await MenuItem.deleteMany({ category: category._id });

    // then delete the category
    await Category.findByIdAndDelete(category._id);

    res.status(200).json({
      success: true,
      message: `Category "${category.name}" and ${deletedItems.deletedCount} items deleted successfully`,
    });

  } catch (error) {
    console.error('DeleteCategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  toggleCategory,
  reorderCategories,
  deleteCategory,
};