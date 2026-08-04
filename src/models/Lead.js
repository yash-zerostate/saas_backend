const mongoose = require('mongoose');

/**
 * A form submission delivered by Preta.
 *
 * Preta runs this element's form in `direct` mode: the visitor's browser posts the payload
 * straight here and Preta keeps only metadata (which element, which page, did it succeed). This
 * collection is therefore the system of record for the leads themselves.
 */
const leadSchema = new mongoose.Schema(
  {
    // Which Preta element produced this submission. The id is stable and is what ties old leads
    // to new ones; the name and type are what a human reads. Keep all three — a form can be
    // renamed, but its id will not change.
    element_id:   { type: String, default: null },
    element_type: { type: String, default: null },   // modal | clone | banner | wizard | …
    form_name:    { type: String, default: null },   // whatever the creator titled the form

    domain:   { type: String, default: null },
    pathname: { type: String, default: null },

    // The actual form fields. Free-form because every element defines its own fields — a
    // fixed schema here would silently drop whatever the creator added last week.
    form_data: { type: mongoose.Schema.Types.Mixed, required: true },

    // When the visitor submitted, as reported by the browser. Kept separate from createdAt,
    // which is when WE stored it.
    submitted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
