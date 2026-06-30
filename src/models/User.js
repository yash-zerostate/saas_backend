const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    password_hash: {
      type:     String,
      required: true,
    },
    plan: {
      type:    String,
      enum:    ['Free', 'Pro', 'Enterprise'],
      default: 'Free',
    },
    role: {
      type:    String,
      default: '',
    },
    billing_status: {
      type:    String,
      enum:    ['never', 'trial', 'active'],
      default: 'never',
    },
    has_paid: {
      type:    Boolean,
      default: false,
    },
    failed_logins: {
      type:    Number,
      default: 0,
    },
    risk_score: {
      type:    Number,
      default: 0.0,
      min:     0,
      max:     1,
    },
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password_hash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
