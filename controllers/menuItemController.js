const MenuItem = require('../models/menuItems');
const Category = require('../models/categoriesModel');
const Restaurant = require('../models/restaurentModel');
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload'); // Your existing multer middleware

// ─── Helper: verify ownership through category → restaurant chain ─────────────
const verifyOwnership = async (categoryId, userId) => {
  const category = await Category.findById(categoryId).populate('restaurant');
  if (!category) return { error: 'Category not found', status: 404 };
  if (category.restaurant.owner.toString() !== userId.toString()) {
    return { error: 'Not authorized', status: 403 };
  }
  return { category, restaurant: category.restaurant };
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/items/create
// @desc    Add a new menu item under a category
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createMenuItem = (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading image'
      });
    }

    try {
      const {
        categoryId,
        restaurantId,
        name,
        description,
        price,
        isVeg,
        isBestseller,
      } = req.body;

      // ── Validations ──────────────────────────────────────────────────────────
      const errors = {};

      if (!categoryId)   errors.categoryId   = 'Category is required';
      if (!restaurantId) errors.restaurantId = 'Restaurant ID is required';
      if (!name)         errors.name         = 'Item name is required';
      if (!price && price !== 0) errors.price = 'Price is required';

      if (Object.keys(errors).length > 0) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }

      if (name.trim().length < 2) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { name: 'Item name must be at least 2 characters' }
        });
      }

      if (name.trim().length > 100) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { name: 'Item name cannot exceed 100 characters' }
        });
      }

      if (isNaN(price) || Number(price) < 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { price: 'Price must be a valid positive number' }
        });
      }

      if (Number(price) > 100000) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { price: 'Price seems too high. Please check.' }
        });
      }

      if (description && description.trim().length > 300) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { description: 'Description cannot exceed 300 characters' }
        });
      }

      // ── Verify restaurant belongs to owner ────────────────────────────────────
      const restaurant = await Restaurant.findOne({
        _id:   restaurantId,
        owner: req.userId,
      });

      if (!restaurant) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found'
        });
      }

      // ── Verify category belongs to this restaurant ────────────────────────────
      const category = await Category.findOne({
        _id:        categoryId,
        restaurant: restaurantId,
      });

      if (!category) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Category not found in this restaurant'
        });
      }

      // ── Get order number ──────────────────────────────────────────────────────
      const count = await MenuItem.countDocuments({ category: categoryId });

      // ── Prepare image data ────────────────────────────────────────────────────
      let imageData = null;
      if (req.file) {
        // Read the uploaded file and convert to buffer for MongoDB storage
        const fileBuffer = fs.readFileSync(req.file.path);
        imageData = {
          data: fileBuffer,
          contentType: req.file.mimetype
        };
        
        // Delete the file from disk after reading it into buffer
        fs.unlinkSync(req.file.path);
      }

      // ── Create item ───────────────────────────────────────────────────────────
      const item = await MenuItem.create({
        restaurant:   restaurantId,
        category:     categoryId,
        name:         name.trim(),
        description:  description ? description.trim() : '',
        price:        Number(price),
        image:        imageData,
        isVeg:        isVeg || false,
        isBestseller: isBestseller || false,
        order:        count,
      });

      // populate category name in response
      await item.populate('category', 'name');

      // Convert to object to include virtuals
      const itemObj = item.toObject();

      res.status(201).json({
        success: true,
        message: `"${item.name}" added to ${category.name} successfully`,
        item: itemObj,
      });

    } catch (error) {
      // Clean up uploaded file if error occurs
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      console.error('CreateMenuItem error:', error);
      res.status(500).json({
        success: false,
        message: 'Something went wrong. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/items/:restaurantId
// @desc    Get all items of a restaurant (grouped by category)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMenuItems = async (req, res) => {
  try {
    // verify restaurant ownership
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

    // get all categories
    const categories = await Category.find({
      restaurant: req.params.restaurantId
    }).sort({ order: 1 });

    // get all items (exclude image binary data for performance)
    const items = await MenuItem.find({
      restaurant: req.params.restaurantId
    }).select('-image.data').sort({ order: 1 });

    // group items under categories
    const grouped = categories.map(cat => ({
      category: cat,
      items: items.filter(
        item => item.category.toString() === cat._id.toString()
      ),
    }));

    res.status(200).json({
      success: true,
      totalItems: items.length,
      menu: grouped,
    });

  } catch (error) {
    console.error('GetMenuItems error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/items/single/:id
// @desc    Get single menu item by ID
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMenuItemById = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
      .populate('category', 'name')
      .populate('restaurant', 'name owner');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // verify ownership
    if (item.restaurant.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Convert to object to include virtuals
    const itemObj = item.toObject();

    res.status(200).json({
      success: true,
      item: itemObj,
    });

  } catch (error) {
    console.error('GetMenuItemById error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/items/image/:id
// @desc    Get menu item image (for direct img tag usage)
// @access  Public/Private (adjust as needed)
// ─────────────────────────────────────────────────────────────────────────────
const getMenuItemImage = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id).select('image');

    if (!item || !item.image || !item.image.data || item.image.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // 🔥 STRONG cache prevention
    res.set('Content-Type', item.image.contentType);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('ETag', Date.now().toString()); // Unique ETag every time
    
    res.send(item.image.data);
  } catch (error) {
    console.error('GetMenuItemImage error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/items/:id
// @desc    Update menu item details
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateMenuItem = (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Error uploading image'
      });
    }

    try {
      const {
        name, description, price, isVeg, isBestseller,
        categoryId, removeImage,
      } = req.body;

      // Validations...
      if (!name) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: 'Validation failed', errors: { name: 'Item name is required' } });
      }

      const item = await MenuItem.findById(req.params.id)
        .populate({ path: 'restaurant', select: 'owner' });

      if (!item) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, message: 'Item not found' });
      }

      if (item.restaurant.owner.toString() !== req.userId.toString()) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      // Update fields
      item.name = name.trim();
      item.description = description ? description.trim() : item.description;
      item.price = Number(price);

      // 🔥 FIXED: Handle image updates properly
      if (removeImage === 'true' || removeImage === true || removeImage === '1') {
        // Explicitly remove image
        console.log('🗑️ Removing image for item:', item._id);
        item.image = undefined; // Use undefined to remove the field completely
      } else if (req.file) {
        // New image uploaded
        console.log('📸 New image uploaded:', req.file.originalname);
        const fileBuffer = fs.readFileSync(req.file.path);
        item.image = {
          data: fileBuffer,
          contentType: req.file.mimetype
        };
        fs.unlinkSync(req.file.path);
      }
      // If neither, keep existing image (don't modify item.image)

      if (categoryId && categoryId !== item.category.toString()) {
        const newCategory = await Category.findOne({
          _id: categoryId,
          restaurant: item.restaurant._id,
        });
        if (!newCategory) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(404).json({ success: false, message: 'Category not found' });
        }
        item.category = categoryId;
      }

      item.isVeg = isVeg !== undefined ? isVeg : item.isVeg;
      item.isBestseller = isBestseller !== undefined ? isBestseller : item.isBestseller;

      await item.save();
      await item.populate('category', 'name');

      const itemObj = item.toObject();
      console.log('✅ Item updated. Has image:', !!itemObj.image, 'Has imageUrl:', !!itemObj.imageUrl);

      res.status(200).json({
        success: true,
        message: `"${item.name}" updated successfully`,
        item: itemObj,
      });

    } catch (error) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      console.error('UpdateMenuItem error:', error);
      res.status(500).json({
        success: false,
        message: 'Something went wrong. Please try again.'
      });
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/items/:id/toggle
// @desc    Toggle item available / unavailable
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const toggleMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
      .populate({ path: 'restaurant', select: 'owner' });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    if (item.restaurant.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    item.isAvailable = !item.isAvailable;
    await item.save();

    res.status(200).json({
      success: true,
      message: `"${item.name}" is now ${item.isAvailable ? 'available on menu' : 'hidden from menu'}`,
      isAvailable: item.isAvailable,
    });

  } catch (error) {
    console.error('ToggleMenuItem error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/items/reorder
// @desc    Reorder items inside a category
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const reorderMenuItems = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Orders array is required'
      });
    }

    await Promise.all(
      orders.map(({ id, order }) =>
        MenuItem.findByIdAndUpdate(id, { order })
      )
    );

    res.status(200).json({
      success: true,
      message: 'Items reordered successfully',
    });

  } catch (error) {
    console.error('ReorderMenuItems error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/items/:id
// @desc    Delete a menu item
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
      .populate({ path: 'restaurant', select: 'owner' });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    if (item.restaurant.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this item'
      });
    }

    const itemName = item.name;
    await MenuItem.findByIdAndDelete(item._id);

    res.status(200).json({
      success: true,
      message: `"${itemName}" deleted successfully`,
    });

  } catch (error) {
    console.error('DeleteMenuItem error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  getMenuItemImage,
  updateMenuItem,
  toggleMenuItem,
  reorderMenuItems,
  deleteMenuItem,
};