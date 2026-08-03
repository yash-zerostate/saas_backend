const mongoose = require('mongoose');

/**
 * A form submission delivered by Preta.
 *
 * Preta does not store lead data — it hands each submission to this backend and keeps only
 * metadata on its own side. This collection is therefore the system of record for leads.
 */
const leadSchema = new mongoose.Schema(
  {
    // Which Preta element produced this submission. Useful for telling a pricing-page modal
    // apart from a footer newsletter form.
    element_id: { type: String, default: null },

    domain:   { type: String, default: null },
    pathname: { type: String, default: null },

    // The actual form fields. Free-form because every element defines its own fields — a
    // fixed schema here would silently drop whatever the creator added last week.
    form_data: { type: mongoose.Schema.Types.Mixed, required: true },

    // How it arrived:
    //   'direct'        — posted by the visitor's browser, straight to us
    //   'through-preta' — forwarded by Preta's server (signed)
    route: { type: String, enum: ['direct', 'through-preta'], default: 'direct' },

    // Signature outcome. Only a 'through-preta' request can be verified — a browser cannot hold
    // a signing key, so Direct submissions are always 'unsigned'.
    verification: {
      type: String,
      enum: ['verified', 'unsigned', 'no-secret-configured'],
      default: 'unsigned',
    },

    // When the visitor submitted, as reported by Preta. Kept separate from createdAt, which is
    // when WE stored it — a queued retry can arrive hours after the submission.
    submitted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
