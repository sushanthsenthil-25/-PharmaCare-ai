import jwt from 'jsonwebtoken';
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

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { name, full_name, email, password, role, business_name, phone, business_address, profilePhoto } = req.body;

    const userEmail = (email || '').toLowerCase().trim();
    const userName = full_name || name || 'PharmaCare User';
    const userRole = role ? role.toUpperCase() : 'USER';
    const businessName = business_name || 'PharmaCare Central';

    if (!userEmail || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide both email and password',
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
          code: 'DATABASE_CONNECTING',
          message: 'Database is connecting. Please try Quick Demo Login or try again in a moment.',
        },
      });
    }

    if (userExists) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email address already exists',
        },
      });
    }

    const user = await User.create({
      name: userName,
      email: userEmail,
      password,
      role: userRole,
      businessName,
      phone: phone || '',
      address: business_address || 'Indiranagar, Bangalore 560038',
      profilePhoto: profilePhoto || '',
      avatar: profilePhoto || DEFAULT_AVATAR,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      access_token: token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// Built-in demo user fallbacks for instant login and cold-start resilience
const DEMO_FALLBACKS = {
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
  },
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

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

    let user = null;
    try {
      user = await User.findOne({ email: cleanEmail }).select('+password');
    } catch (dbErr) {
      console.warn('[Auth Notice] DB query buffered/failed:', dbErr.message);
      if (DEMO_FALLBACKS[cleanEmail]) {
        const demoUser = DEMO_FALLBACKS[cleanEmail];
        const token = generateToken(demoUser._id);
        return res.json({
          success: true,
          token,
          access_token: token,
          user: formatUserResponse(demoUser),
        });
      }
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_CONNECTING',
          message: 'Database is connecting. Please try Quick Demo Login or try again in a few seconds.',
        },
      });
    }

    if (!user) {
      if (DEMO_FALLBACKS[cleanEmail]) {
        const demoUser = DEMO_FALLBACKS[cleanEmail];
        const token = generateToken(demoUser._id);
        return res.json({
          success: true,
          token,
          access_token: token,
          user: formatUserResponse(demoUser),
        });
      }
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    if (user.matchPassword && !(await user.matchPassword(password)) && !DEMO_FALLBACKS[cleanEmail]) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      access_token: token,
      user: formatUserResponse(user),
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
    let user = null;
    try {
      user = await User.findById(req.user._id);
    } catch (dbErr) {
      console.warn('[Auth Notice] getMe DB query error:', dbErr.message);
    }

    if (!user) {
      // Check demo fallbacks by ID
      const demoUser = Object.values(DEMO_FALLBACKS).find((d) => d._id === req.user._id || d._id === req.user.id);
      if (demoUser) {
        return res.json({
          success: true,
          user: formatUserResponse(demoUser),
        });
      }
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
