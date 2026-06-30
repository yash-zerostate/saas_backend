const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    user_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    token_hash: {
      type:     String,
      required: true,
      unique:   true,
    },
    expires_at: {
      type:     Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-delete expired tokens
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
