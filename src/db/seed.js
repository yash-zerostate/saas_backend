const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { getPlanFeatures } = require('../utils/features');

const DEMO_USERS = [
  {
    email:          'ansh@saasify.com',
    name:           'Ansh',
    plan:           'Enterprise',
    billing_status: 'active',
    has_paid:       true,
    user_types:     ['security_admin'],
    risk_score:     0.82,
  },
  {
    email:          'hamza@saasify.com',
    name:           'Hamza',
    plan:           'Business',
    billing_status: 'active',
    has_paid:       true,
    user_types:     ['marketing_user'],
    risk_score:     0.1,
  },
  {
    email:          'jiwans@saasify.com',
    name:           'Jiwans',
    plan:           'Pro',
    billing_status: 'active',
    has_paid:       true,
    user_types:     ['Prime'],
    risk_score:     0.3,
  },
  {
    email:          'jay@saasify.com',
    name:           'Jay',
    plan:           'Starter',
    billing_status: 'trial',
    has_paid:       false,
    user_types:     ['normal'],
    risk_score:     0.0,
  },
  {
    email:          'priyanshu@saasify.com',
    name:           'Priyanshu',
    plan:           'Free',
    billing_status: 'never',
    has_paid:       false,
    user_types:     [],
    risk_score:     0.0,
  },
];

async function seedDemoUsers() {
  const password_hash = await bcrypt.hash('password123', 12);

  for (const demo of DEMO_USERS) {
    const exists = await User.findOne({ email: demo.email });
    if (exists) continue;

    await User.create({
      ...demo,
      password_hash,
      features: getPlanFeatures(demo.plan),
    });

    console.log('Seeded:', demo.email);
  }
}

module.exports = { seedDemoUsers };
