import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token missing',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pharmacare-ai-super-secret-jwt-key-2026-secure');
    
    // Demo fallbacks for instant authorized access without database latency
    if (decoded.id === '6ace697088103256f918765d' || decoded.id === '65f1a2b3c4d5e6f7a8b9c0d2' || decoded.id === 'usr_default') {
      req.user = {
        _id: '6ace697088103256f918765d',
        id: '6ace697088103256f918765d',
        name: 'PharmaCare Pharmacy Owner',
        email: 'pharmacare@gmail.com',
        role: 'OWNER',
        businessName: 'PharmaCare Central Pharmacy',
        phone: '+91 98765 00000',
        address: 'Koramangala, Bangalore 560034',
      };
      return next();
    }
    if (decoded.id === '6ace697088103256f918765a' || decoded.id === '65f1a2b3c4d5e6f7a8b9c0d1') {
      req.user = {
        _id: '6ace697088103256f918765a',
        id: '6ace697088103256f918765a',
        name: 'Sushanth Senthil',
        email: 'sushanth@gmail.com',
        role: 'USER',
        businessName: 'PharmaCare Customer',
        phone: '+91 98765 43210',
        address: 'Indiranagar, Bangalore 560038',
      };
      return next();
    }

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findById(decoded.id).select('-password');
      } catch (_) {}
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed or expired',
    });
  }
};

// Role-Based Access Control (RBAC) middleware
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const userRole = (req.user.role || 'USER').toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Role '${req.user.role}' is not authorized to access owner resources.`,
        },
      });
    }

    next();
  };
};

// Optional auth middleware: sets req.user if valid token provided, otherwise leaves it undefined
export const optionalAuth = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pharmacare-ai-super-secret-jwt-key-2026-secure');
      if (decoded.id === '6ace697088103256f918765d' || decoded.id === '65f1a2b3c4d5e6f7a8b9c0d2' || decoded.id === 'usr_default') {
        req.user = {
          _id: '6ace697088103256f918765d',
          id: '6ace697088103256f918765d',
          name: 'PharmaCare Pharmacy Owner',
          email: 'pharmacare@gmail.com',
          role: 'OWNER',
          businessName: 'PharmaCare Central Pharmacy',
          phone: '+91 98765 00000',
          address: 'Koramangala, Bangalore 560034',
        };
      } else if (decoded.id === '6ace697088103256f918765a' || decoded.id === '65f1a2b3c4d5e6f7a8b9c0d1') {
        req.user = {
          _id: '6ace697088103256f918765a',
          id: '6ace697088103256f918765a',
          name: 'Sushanth Senthil',
          email: 'sushanth@gmail.com',
          role: 'USER',
          businessName: 'PharmaCare Customer',
          phone: '+91 98765 43210',
          address: 'Indiranagar, Bangalore 560038',
        };
      } else if (mongoose.connection.readyState === 1) {
        req.user = await User.findById(decoded.id).select('-password');
      }
    } catch {
      // Ignore token error for optional auth
    }
  }
  next();
};
