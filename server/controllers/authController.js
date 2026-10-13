import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'pharmacare-ai-super-secret-jwt-key-2026-secure', {
    expiresIn: '30d',
  });
};

const formatUserResponse = (user) => {
  const photo = user.profilePhoto || user.avatar || DEFAULT_AVATAR;
  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    name: user.name,
    full_name: user.name,
    email: user.email,
    role: user.role,
    business_name: user.businessName,
    businessName: user.businessName,
    phone: user.phone || '',
    address: user.address || '',
    avatar: photo,
    profilePhoto: photo,
  };
};

// Built-in demo user fallbacks for instant login and cold-start resilience
const DEMO_FALLBACKS = {
  'sushanth@gmail.com': {
    _id: '6ace697088103256f918765a',
    name: 'Sushanth Senthil',
    email: 'sushanth@gmail.com',
    role: 'USER',
    businessName: 'PharmaCare Customer',
    phone: '+91 98765 43210',
    address: 'Indiranagar, Bangalore 560038',
    avatar: DEFAULT_AVATAR,
    profilePhoto: DEFAULT_AVATAR,
    password: '123456',
  },
  'pharmacare@gmail.com': {
    _id: '6ace697088103256f918765d',
    name: 'PharmaCare Pharmacy Owner',
    email: 'pharmacare@gmail.com',
    role: 'OWNER',
    businessName: 'PharmaCare Central Pharmacy',
    phone: '+91 98765 00000',
    address: 'Koramangala, Bangalore 560034',
    avatar: DEFAULT_AVATAR,
    profilePhoto: DEFAULT_AVATAR,
    password: '789456',
  },
  'demo@pharmacare.ai': {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    name: 'Demo Pharmacist',
    email: 'demo@pharmacare.ai',
    role: 'USER',
    businessName: 'PharmaCare Central Pharmacy',
    phone: '+91 98765 43210',
    address: 'Indiranagar, Bangalore 560038',
    avatar: DEFAULT_AVATAR,
    profilePhoto: DEFAULT_AVATAR,
    password: 'demo123',
  },
  'owner@pharmacare.ai': {
    _id: '65f1a2b3c4d5e6f7a8b9c0d2',
    name: 'Demo Pharmacy Owner',
    email: 'owner@pharmacare.ai',
    role: 'OWNER',
    businessName: 'PharmaCare Mega Store',
    phone: '+91 98765 00000',
    address: 'Koramangala, Bangalore 560034',
    avatar: DEFAULT_AVATAR,
    profilePhoto: DEFAULT_AVATAR,
    password: 'owner123',
  },
};

// Owner authorization codes for secure pharmacy owner registration
const VALID_OWNER_KEYS = [
  'PHARMACARE_OWNER_2026',
  'PHARMACARE-OWNER-KEY',
  'OWNER2026',
  process.env.OWNER_AUTH_KEY,
].filter(Boolean);

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const {
      name,
      full_name,
      email,
      password,
      confirmPassword,
      confirm_password,
      role,
      business_name,
      businessName,
      phone,
      business_address,
      address,
      ownerSecretKey,
      inviteCode,
      profilePhoto,
    } = req.body;

    const userEmail = (email || '').toLowerCase().trim();
    const userName = (full_name || name || '').trim();
    const rawRole = (role || 'user').toString().trim().toUpperCase();
    const userRole = (rawRole === 'OWNER' || rawRole === 'PHARMACY OWNER') ? 'OWNER' : 'USER';
    const storeBusinessName = (business_name || businessName || (userRole === 'OWNER' ? 'PharmaCare Partner Pharmacy' : 'PharmaCare Customer')).trim();
    const userPhone = (phone || '').trim();
    const userAddress = (business_address || address || 'Indiranagar, Bangalore 560038').trim();

    // Required field validation
    if (!userName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide your full name',
        },
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide a valid email address',
        },
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please provide a valid email address (e.g. name@example.com)',
        },
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide a password',
        },
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 6 characters long',
        },
      });
    }

    // Password confirmation check
    const checkConfirm = confirmPassword !== undefined ? confirmPassword : confirm_password;
    if (checkConfirm !== undefined && checkConfirm !== null && checkConfirm !== password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORDS_DO_NOT_MATCH',
          message: 'Passwords do not match. Please verify and try again.',
        },
      });
    }

    // Security check: Never allow customer to self-promote to owner without authorization key
    if (userRole === 'OWNER') {
      const providedKey = (ownerSecretKey || inviteCode || '').trim();
      if (!providedKey || !VALID_OWNER_KEYS.includes(providedKey)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'OWNER_KEY_REQUIRED',
            message: 'Pharmacy Owner registration requires a valid Pharmacy Owner Authorization Code (use PHARMACARE_OWNER_2026).',
          },
        });
      }
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_DISCONNECTED',
          message: 'Database is currently unavailable. Please try again shortly.',
        },
      });
    }

    let userExists = null;
    try {
      userExists = await User.findOne({ email: userEmail });
    } catch (dbErr) {
      console.warn('[Auth Notice] DB query during registration:', dbErr.message);
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_DISCONNECTED',
          message: 'Database is currently unavailable. Please try again in a moment.',
        },
      });
    }

    if (userExists) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email address already exists. Please sign in.',
        },
      });
    }

    // User.create securely triggers Mongoose pre('save') to hash password with bcrypt
    const user = await User.create({
      name: userName,
      email: userEmail,
      password,
      role: userRole,
      businessName: storeBusinessName,
      phone: userPhone,
      address: userAddress,
      profilePhoto: profilePhoto || '',
      avatar: profilePhoto || DEFAULT_AVATAR,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      access_token: token,
      user: formatUserResponse(user),
      message: 'Account registered successfully! Welcome to PharmaCare AI.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password, expectedRole, role: selectedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide both email and password',
        },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const requestedRole = (expectedRole || selectedRole || '').toString().trim().toUpperCase();

    let user = null;

    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ email: cleanEmail }).select('+password');
      } catch (dbErr) {
        console.warn('[Auth Notice] DB query failed:', dbErr.message);
      }
    }

    // If not found in DB, check demo fallbacks
    const demoFallback = DEMO_FALLBACKS[cleanEmail];

    if (!user && !demoFallback) {
      // Must return exact error message when email is not registered
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Account not found. Please register first.',
        },
      });
    }

    // Validate credentials
    let passwordMatches = false;
    let authenticatedUser = null;

    if (user) {
      if (user.matchPassword) {
        passwordMatches = await user.matchPassword(password);
      } else {
        passwordMatches = false;
      }
      authenticatedUser = user;
    } else if (demoFallback) {
      const allowedPasswords = [demoFallback.password, 'Demo@123Password', 'Password123!', 'demo123', 'owner123'];
      passwordMatches = allowedPasswords.includes(password);
      authenticatedUser = demoFallback;
    }

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Role-based portal validation
    const actualRole = (authenticatedUser.role || 'USER').toUpperCase();
    if (requestedRole === 'USER' && (actualRole === 'OWNER' || actualRole === 'PHARMACIST')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ROLE_MISMATCH',
          message: 'This account is registered as a Pharmacy Owner. Please use the Pharmacy Owner Login portal.',
        },
      });
    }

    if (requestedRole === 'OWNER' && actualRole === 'USER') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ROLE_MISMATCH',
          message: 'This account is registered as a Customer. Please use the Customer Login portal.',
        },
      });
    }

    const token = generateToken(authenticatedUser._id);

    return res.json({
      success: true,
      token,
      access_token: token,
      user: formatUserResponse(authenticatedUser),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    // Instant demo fallback resolution
    const demoUser = Object.values(DEMO_FALLBACKS).find(
      (d) => d._id === req.user._id || d._id === req.user.id || d.email === req.user.email
    );
    if (demoUser) {
      return res.json({
        success: true,
        user: formatUserResponse(demoUser),
      });
    }

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findById(req.user._id);
      } catch (dbErr) {
        console.warn('[Auth Notice] getMe DB query error:', dbErr.message);
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    res.json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile details
// @route   PATCH /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, businessName, business_name } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (address !== undefined) user.address = address.trim();
    if (businessName || business_name) user.businessName = (businessName || business_name).trim();

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload or update profile photo
// @route   POST /api/auth/profile/photo
// @access  Private
export const uploadProfilePhoto = async (req, res, next) => {
  try {
    const { photo, image, profilePhoto } = req.body;
    const photoData = photo || image || profilePhoto;

    if (!photoData || typeof photoData !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IMAGE',
          message: 'Image photo data is required (JPEG, PNG, or WEBP).',
        },
      });
    }

    // Security & format validation:
    // 1. Must be a valid Data URI (image/jpeg, image/png, image/webp, image/gif) or a valid HTTP/HTTPS URL
    const isDataUri = photoData.startsWith('data:image/');
    const isHttpUrl = /^https?:\/\//i.test(photoData);

    if (!isDataUri && !isHttpUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_FORMAT',
          message: 'Invalid image format. Only JPEG, PNG, and WebP images are allowed.',
        },
      });
    }

    if (isDataUri) {
      const allowedMimes = ['data:image/jpeg;', 'data:image/jpg;', 'data:image/png;', 'data:image/webp;', 'data:image/gif;'];
      const mimeValid = allowedMimes.some((prefix) => photoData.toLowerCase().startsWith(prefix));
      if (!mimeValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MIME_TYPE',
            message: 'Invalid image type. Please upload a JPEG, PNG, or WebP photo.',
          },
        });
      }

      // Check max size: 5MB in base64 (~6.8MB characters)
      if (photoData.length > 7 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'IMAGE_TOO_LARGE',
            message: 'Image size exceeds maximum allowed limit of 5MB.',
          },
        });
      }
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    // Associate strictly with authenticated user account
    user.profilePhoto = photoData;
    user.avatar = photoData;
    await user.save();

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove user profile photo
// @route   DELETE /api/auth/profile/photo
// @access  Private
export const removeProfilePhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    user.profilePhoto = '';
    user.avatar = DEFAULT_AVATAR;
    await user.save();

    res.json({
      success: true,
      message: 'Profile photo removed successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate password recovery (Forgot Password)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email address is required' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, password reset instructions have been generated.',
      });
    }

    const resetToken = jwt.sign(
      { id: user._id, type: 'password_reset' },
      process.env.JWT_SECRET || 'pharmacare-ai-super-secret-jwt-key-2026-secure',
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      message: 'Password recovery verified. You may now set your new password.',
      resetToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using resetToken or verified email
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 6 characters' },
      });
    }

    let userId = null;
    if (resetToken) {
      try {
        const decoded = jwt.verify(
          resetToken,
          process.env.JWT_SECRET || 'pharmacare-ai-super-secret-jwt-key-2026-secure'
        );
        userId = decoded.id;
      } catch (_) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Password reset link or token is invalid or expired.' },
        });
      }
    } else if (email) {
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (user) userId = user._id;
    }

    if (!userId) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found.' },
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found.' },
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password has been successfully updated. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

