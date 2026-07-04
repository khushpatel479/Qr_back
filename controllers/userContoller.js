const User = require('../models/usersModel');
const jwt = require('jsonwebtoken');

// ─── Helper: generate JWT token ───────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ─── Helper: send token response ─────────────────────────────────────────────
const sendTokenResponse = (res, statusCode, user, message) => {
  const token = generateToken(user._id);
  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: user.toSafeObject(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/users/register
// @desc    Register new restaurant owner
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────

    // 1. Check all required fields
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        errors: {
          ...((!name) && { name: 'Name is required' }),
          ...((!email) && { email: 'Email is required' }),
          ...((!password) && { password: 'Password is required' }),
          ...((!confirmPassword) && { confirmPassword: 'Please confirm your password' }),
        }
      });
    }

    // 2. Name validation
    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Name must be at least 2 characters' }
      });
    }

    if (name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Name cannot exceed 50 characters' }
      });
    }

    // 3. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { email: 'Please enter a valid email address' }
      });
    }

    // 4. Password strength validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { password: 'Password must be at least 6 characters' }
      });
    }

    if (password.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { password: 'Password is too long' }
      });
    }

    // 5. Password must have at least one letter and one number
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { password: 'Password must contain at least one letter and one number' }
      });
    }

    // 6. Confirm password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { confirmPassword: 'Passwords do not match' }
      });
    }

    // 7. Phone validation (optional but if provided must be valid)
    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile number
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: { phone: 'Please enter a valid 10-digit mobile number' }
        });
      }
    }

    // 8. Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Validation failed',
        errors: { email: 'This email is already registered. Please login instead.' }
      });
    }

    // ── Create User ──────────────────────────────────────────────────────────
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone ? phone.trim() : '',
    });

    sendTokenResponse(res, 201, user, 'Account created successfully! Welcome aboard.');

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/users/login
// @desc    Login restaurant owner
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────

    // 1. Check required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        errors: {
          ...((!email) && { email: 'Email is required' }),
          ...((!password) && { password: 'Password is required' }),
        }
      });
    }

    // 2. Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { email: 'Please enter a valid email address' }
      });
    }

    // ── Find user (include password for comparison) ───────────────────────
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    // 3. User not found — dont reveal if email exists or not (security)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: { general: 'Email or password is incorrect' }
      });
    }

    // 4. Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated',
        errors: { general: 'Your account has been deactivated. Please contact support.' }
      });
    }

    // 5. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: { general: 'Email or password is incorrect' }
      });
    }

    sendTokenResponse(res, 200, user, 'Login successful! Welcome back.');

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/users/me
// @desc    Get currently logged in user profile
// @access  Private (requires JWT)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/update-profile
// @desc    Update user name, phone
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Name is required' }
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Name must be at least 2 characters' }
      });
    }

    if (name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { name: 'Name cannot exceed 50 characters' }
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

    // ── Update ────────────────────────────────────────────────────────────────
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        name: name.trim(),
        phone: phone ? phone.trim() : '',
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        errors: {
          ...((!currentPassword) && { currentPassword: 'Current password is required' }),
          ...((!newPassword) && { newPassword: 'New password is required' }),
          ...((!confirmNewPassword) && { confirmNewPassword: 'Please confirm your new password' }),
        }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { newPassword: 'New password must be at least 6 characters' }
      });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { newPassword: 'Password must contain at least one letter and one number' }
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { confirmNewPassword: 'New passwords do not match' }
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: { newPassword: 'New password must be different from current password' }
      });
    }

    // ── Verify current password ───────────────────────────────────────────────
    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Validation failed',
        errors: { currentPassword: 'Current password is incorrect' }
      });
    }

    // ── Update password ───────────────────────────────────────────────────────
    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again.',
    });

  } catch (error) {
    console.error('ChangePassword error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/users/delete-account
// @desc    Deactivate user account (soft delete)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your password to confirm',
        errors: { password: 'Password is required to delete account' }
      });
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Validation failed',
        errors: { password: 'Incorrect password' }
      });
    }

    // Soft delete — just deactivate, dont actually delete from DB
    await User.findByIdAndUpdate(req.userId, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('DeleteAccount error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
};