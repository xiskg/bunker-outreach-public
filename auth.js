import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.DEMO_MODE === 'true' ? randomBytes(48).toString('hex') : null);
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to at least 32 characters outside demo mode');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// Hash plain password
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare plain password with hash
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Generate JWT token for user
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Express middleware to protect routes
export function requireAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Acesso não autorizado. Faça login para continuar.',
      code: 'AUTH_REQUIRED'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: 'Sessão expirada ou inválida. Por favor, entre novamente.',
      code: 'TOKEN_INVALID'
    });
  }

  req.user = decoded;
  next();
}

// Express middleware to protect ADMIN-only routes
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({
      error: 'Acesso restrito. Esta área requer privilégios de Administrador do Bunker.',
      code: 'FORBIDDEN_ADMIN_ONLY'
    });
  });
}

// Optional Auth (for endpoints that work with or without user)
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}
