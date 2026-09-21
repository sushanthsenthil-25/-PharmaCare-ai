import jwt from 'jsonwebtoken';
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
    
    let user = null;
    try {
      user = await User.findById(decoded.id).select('-password');
    } catch (_) {}

    if (!user) {
      // Demo fallbacks for instant authorized access
      if (decoded.id === '65f1a2b3c4d5e6f7a8b9c0d2' || decoded.id === 'usr_default') {
        user = {
          _id: '65f1a2b3c4d5e6f7a8b9c0d2',
          id: '65f1a2b3c4d5e6f7a8b9c0d2',
          name: 'Demo Pharmacy Owner',
          email: 'owner@pharmacare.ai',
          role: 'OWNER',
          businessName: 'PharmaCare Central Pharmacy',
          phone: '+91 98765 43210',
          address: 'Indiranagar, Bangalore 560038',
        };
      } else if (decoded.id === '65f1a2b3c4d5e6f7a8b9c0d1') {
        user = {
          _id: '65f1a2b3c4d5e6f7a8b9c0d1',
          id: '65f1a2b3c4d5e6f7a8b9c0d1',
          name: 'Demo Pharmacist',
          email: 'demo@pharmacare.ai',
          role: 'USER',
          businessName: 'PharmaCare Central Pharmacy',
          phone: '+91 98765 43210',
          address: 'Indiranagar, Bangalore 560038',
        };
      }
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
      req.user = await User.findById(decoded.id).select('-password');
    } catch {
      // Ignore token error for optional auth
    }
  }
  next();
};
