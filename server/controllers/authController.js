import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'pharmacare-ai-super-secret-jwt-key-2026-secure', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { name, full_name, email, password, role, business_name, phone, business_address } = req.body;

    const userEmail = (email || '').toLowerCase().trim();
    const userName = full_name || name || 'PharmaCare User';
    const userRole = role || 'USER';
    const businessName = business_name || 'PharmaCare Central';

    if (!userEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const userExists = await User.findOne({ email: userEmail });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists',
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
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      access_token: token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        full_name: user.name,
        email: user.email,
        role: user.role,
        business_name: user.businessName,
        businessName: user.businessName,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
      },
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      access_token: token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        full_name: user.name,
        email: user.email,
        role: user.role,
        business_name: user.businessName,
        businessName: user.businessName,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
      },
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
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        full_name: user.name,
        email: user.email,
        role: user.role,
        business_name: user.businessName,
        businessName: user.businessName,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};
