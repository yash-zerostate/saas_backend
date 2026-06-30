const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /me — full user profile
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// GET /me/preta-context — only what the Preta loader needs (plain JSON, no JWT)
router.get('/me/preta-context', requireAuth, (req, res) => {
  const u = req.user;

  const daysSinceReg = Math.floor(
    (Date.now() - new Date(u.createdAt).getTime()) / 86400000
  );

  res.json({
    pretaUser: {
      id:             u._id.toString(),
      plan:           u.plan,
      role:           u.role,
      has_paid:       u.has_paid,
      billing_status: u.billing_status,
      risk_score:     u.risk_score,
      days_since_reg: daysSinceReg,
    },
  });
});

// GET /users/preta-token — RS256 signed JWT for Preta loader (universal, works with any frontend)
router.get('/preta-token', requireAuth, (req, res) => {
  const u = req.user;

  if (!process.env.PRETA_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Preta JWT not configured' });
  }

  const token = jwt.sign(
    {
      plan:           u.plan,
      role:           u.role,
      has_paid:       u.has_paid,
      billing_status: u.billing_status,
      risk_score:     u.risk_score,
    },
    process.env.PRETA_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '5m' }
  );

  res.json({ token });
});

// PATCH /me — update name or password
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, current_password, new_password } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'current_password required to change password' });
      }
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is wrong' });
      if (new_password.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      user.password_hash = await bcrypt.hash(new_password, 12);
    }

    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
