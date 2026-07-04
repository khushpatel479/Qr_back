const Restaurant = require('../models/restaurentModel');
const Category = require('../models/categoriesModel');
const MenuItem = require('../models/menuItems');
const QRCode = require('qrcode');

// ─── Helper: generate unique slug from restaurant name ────────────────────────
const generateSlug = async (name) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-');            // multiple hyphens to one

  // check if slug already exists, if yes add random suffix
  let slug = base;
  let exists = await Restaurant.findOne({ slug });

  while (exists) {
    const suffix = Math.random().toString(36).slice(2, 6); // e.g. "a3f9"
    slug = `${base}-${suffix}`;
    exists = await Restaurant.findOne({ slug });
  }

  return slug;
};

// ─── Helper: generate QR code and menu URL ────────────────────────────────────
const generateQR = async (slug) => {
  const menuUrl = `${process.env.FRONTEND_URL}/menu/${slug}`;
   console.log("menuUrl:", menuUrl);
  const qrCode = await QRCode.toDataURL(menuUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
    width: 400,
  });
  return { menuUrl, qrCode };
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/restaurants/create
// @desc    Create a new restaurant profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createRestaurant = async (req, res) => {
  try {
    const { name, description, address, phone, cuisine } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Restaurant name is required' }
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Restaurant name must be at least 2 characters' }
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Restaurant name cannot exceed 100 characters' }
      });
    }

    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { phone: 'Please enter a valid 10-digit mobile number' }
        });
      }
    }

    // ── Check: one owner can have max 1 restaurant on free plan ──────────────
    const existingRestaurant = await Restaurant.findOne({ owner: req.userId });
    if (existingRestaurant && req.user.plan === 'free') {
      return res.status(403).json({
        success: false,
        message: 'Free plan allows only 1 restaurant. Please upgrade to Pro.'
      });
    }

    // ── Generate slug and QR ──────────────────────────────────────────────────
    const slug = await generateSlug(name.trim());
    const { menuUrl, qrCode } = await generateQR(slug);

    // ── Create Restaurant ─────────────────────────────────────────────────────
    const restaurant = await Restaurant.create({
      owner:       req.userId,
      name:        name.trim(),
      description: description ? description.trim() : '',
      address:     address ? address.trim() : '',
      phone:       phone ? phone.trim() : '',
      cuisine:     cuisine ? cuisine.trim() : '',
      slug,
      menuUrl,
      qrCode,
    });

    res.status(201).json({
      success: true,
      message: 'Restaurant created successfully!',
      restaurant,
    });

  } catch (error) {
    console.error('CreateRestaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/restaurants/my
// @desc    Get all restaurants of logged in owner
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMyRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ owner: req.userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });

  } catch (error) {
    console.error('GetMyRestaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/restaurants/:id
// @desc    Get single restaurant by ID (owner dashboard)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      _id:   req.params.id,
      owner: req.userId,         // owner can only see their own restaurant
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // also send categories and item counts
    const categories = await Category.find({
      restaurant: restaurant._id,
      isActive: true
    }).sort({ order: 1 });

    const totalItems = await MenuItem.countDocuments({
      restaurant: restaurant._id
    });

    const availableItems = await MenuItem.countDocuments({
      restaurant: restaurant._id,
      isAvailable: true
    });

    res.status(200).json({
      success: true,
      restaurant,
      categories,
      stats: {
        totalCategories: categories.length,
        totalItems,
        availableItems,
        hiddenItems: totalItems - availableItems,
      }
    });

  } catch (error) {
    console.error('GetRestaurantById error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/restaurants/:id
// @desc    Update restaurant profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateRestaurant = async (req, res) => {
  try {
    const { name, description, address, phone, cuisine, logo } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Restaurant name is required' }
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Restaurant name must be at least 2 characters' }
      });
    }

    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { phone: 'Please enter a valid 10-digit mobile number' }
        });
      }
    }

    // ── Find restaurant (only owner can update) ───────────────────────────────
    const restaurant = await Restaurant.findOne({
      _id:   req.params.id,
      owner: req.userId,
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // ── Update fields ─────────────────────────────────────────────────────────
    restaurant.name        = name.trim();
    restaurant.description = description ? description.trim() : restaurant.description;
    restaurant.address     = address ? address.trim() : restaurant.address;
    restaurant.phone       = phone ? phone.trim() : restaurant.phone;
    restaurant.cuisine     = cuisine ? cuisine.trim() : restaurant.cuisine;
    restaurant.logo        = logo ? logo.trim() : restaurant.logo;

    // NOTE: slug and qrCode are NEVER updated
    // QR always points to same URL — only menu data changes

    await restaurant.save();

    res.status(200).json({
      success: true,
      message: 'Restaurant updated successfully',
      restaurant,
    });

  } catch (error) {
    console.error('UpdateRestaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/restaurants/:id/toggle
// @desc    Toggle restaurant active/inactive (open/closed)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const toggleRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      _id:   req.params.id,
      owner: req.userId,
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    restaurant.isActive = !restaurant.isActive;
    await restaurant.save();

    res.status(200).json({
      success: true,
      message: `Restaurant is now ${restaurant.isActive ? 'Active (Open)' : 'Inactive (Closed)'}`,
      isActive: restaurant.isActive,
    });

  } catch (error) {
    console.error('ToggleRestaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/restaurants/:id/qr
// @desc    Get QR code of restaurant (for download/display)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getQRCode = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      _id:   req.params.id,
      owner: req.userId,
    }).select('name slug qrCode menuUrl');

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.status(200).json({
      success: true,
      qrCode:  restaurant.qrCode,
      menuUrl: restaurant.menuUrl,
      name:    restaurant.name,
    });

  } catch (error) {
    console.error('GetQRCode error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/restaurants/:id
// @desc    Delete restaurant and all its categories and items
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      _id:   req.params.id,
      owner: req.userId,
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // delete all menu items of this restaurant
    await MenuItem.deleteMany({ restaurant: restaurant._id });

    // delete all categories of this restaurant
    await Category.deleteMany({ restaurant: restaurant._id });

    // delete the restaurant itself
    await Restaurant.findByIdAndDelete(restaurant._id);

    res.status(200).json({
      success: true,
      message: 'Restaurant and all its data deleted successfully',
    });

  } catch (error) {
    console.error('DeleteRestaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/restaurants/menu/:slug
// @desc    PUBLIC — Customer scans QR, gets full menu
// @access  Public (no token needed)
// ─────────────────────────────────────────────────────────────────────────────
const getPublicMenu = async (req, res) => {
  try {
    const { slug } = req.params;

    // find restaurant by slug
    const restaurant = await Restaurant.findOne({ slug, isActive: true })
      .select('-qrCode -owner -__v'); // dont send QR base64 to customer (heavy)

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found or restaurant is currently closed'
      });
    }

    // get all active categories sorted by order
    const categories = await Category.find({
      restaurant: restaurant._id,
      isActive: true
    }).sort({ order: 1 });

    // get all available items
    const items = await MenuItem.find({
      restaurant:  restaurant._id,
      isAvailable: true
    }).sort({ order: 1 });

    // group items under their category
    const menu = categories.map(cat => ({
      category: {
        _id:         cat._id,
        name:        cat.name,
        description: cat.description,
        image:       cat.image,
      },
      items: items.filter(
        item => item.category.toString() === cat._id.toString()
      )
    })).filter(section => section.items.length > 0); // hide empty categories

    res.status(200).json({
      success: true,
      restaurant: {
        name:        restaurant.name,
        description: restaurant.description,
        logo:        restaurant.logo,
        address:     restaurant.address,
        phone:       restaurant.phone,
        cuisine:     restaurant.cuisine,
      },
      menu,
      totalItems: items.length,
    });

  } catch (error) {
    console.error('GetPublicMenu error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  createRestaurant,
  getMyRestaurants,
  getRestaurantById,
  updateRestaurant,
  toggleRestaurant,
  getQRCode,
  deleteRestaurant,
  getPublicMenu,
};