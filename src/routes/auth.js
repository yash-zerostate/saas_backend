const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { calculateRiskScore } = require('../utils/risk');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { error: 'Too many requests, try again in 15 minutes' },
});

const REFRESH_COOKIE = 'saasify_refresh';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
  path:     '/auth',
};

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signPretaJwt(user) {
  if (!process.env.PRETA_PRIVATE_KEY) return null;
  return jwt.sign(
    {
      plan:           user.plan,
      role:           user.role,
      has_paid:       user.has_paid,
      billing_status: user.billing_status,
      risk_score:     user.risk_score,
    },
    process.env.PRETA_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '5m' }
  );
}

async function issueTokens(user, res) {
  const tokenId      = uuidv4();
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id, tokenId);

  await RefreshToken.create({
    user_id:    user._id,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  return accessToken;
}

// POST /auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const VALID_PLANS = ['Free', 'Pro', 'Enterprise'];

    const VALID_BILLING = ['never', 'trial', 'active'];

    const {
      email,
      name,
      password,
      plan           = 'Free',
      role           = '',
      billing_status,
      has_paid       = false,
    } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!VALID_PLANS.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const resolvedBilling = VALID_BILLING.includes(billing_status)
      ? billing_status
      : plan === 'Free' ? 'never' : 'trial';

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      name,
      password_hash,
      plan,
      role,
      billing_status: resolvedBilling,
      has_paid:       Boolean(has_paid),
    });

    const access_token = await issueTokens(user, res);

    return res.status(201).json({
      user:         user.toSafeObject(),
      access_token,
      preta_token:  signPretaJwt(user),
      expires_in:   900,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      user.failed_logins += 1;
      user.risk_score = calculateRiskScore(user);
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset failed logins on success, update risk score and last login
    user.failed_logins = 0;
    user.risk_score    = calculateRiskScore(user);
    await user.save();

    const access_token = await issueTokens(user, res);

    return res.json({
      user:         user.toSafeObject(),
      access_token,
      preta_token:  signPretaJwt(user),
      expires_in:   900,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await RefreshToken.findOne({ token_hash: hashToken(token) });
    if (!stored) {
      res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Rotate: delete old, issue new
    await RefreshToken.deleteOne({ _id: stored._id });
    const access_token = await issueTokens(user, res);

    return res.json({ access_token, expires_in: 900 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) {
      await RefreshToken.deleteOne({ token_hash: hashToken(token) });
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
