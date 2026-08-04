const express = require('express');

const Lead = require('../models/Lead');

const router = express.Router();

/**
 * Lead intake for Preta form submissions.
 *
 * Preta offers two delivery modes, and only one of them reaches this endpoint:
 *
 *   direct  — the visitor's browser POSTs the form straight here. This is what we receive.
 *   stored  — Preta keeps the lead in its own dashboard and never contacts us at all.
 *
 * So every request here comes from a browser. It cannot be signed — a browser cannot hold a
 * secret without publishing it — which makes this a PUBLIC, unauthenticated endpoint. Treat it
 * exactly like any other public form endpoint on the site: validate the shape, rate-limit it,
 * and do not trust anything in the body.
 *
 * (An earlier design had Preta forward submissions server-to-server with an HMAC signature. That
 * mode is gone, and with it the signature verification, the raw-body parsing it required, and the
 * mount-ordering constraint in index.js.)
 */

router.post('/', express.json({ limit: '128kb' }), async (req, res) => {
    const { form_data, element_id, element_type, form_name, domain, pathname, timestamp } = req.body || {};

    // Array is rejected explicitly: `typeof [] === 'object'`, so without this an array would slip
    // through and be stored as a lead with no fields.
    if (!form_data || typeof form_data !== 'object' || Array.isArray(form_data)) {
        return res.status(400).json({ error: 'form_data is required' });
    }

    try {
        const lead = await Lead.create({
            element_id: element_id || null,
            element_type: element_type || null,
            form_name: form_name || null,
            domain: domain || null,
            pathname: pathname || null,
            form_data: form_data,
            submitted_at: timestamp ? new Date(timestamp) : null,
        });

        console.log(`[leads] stored ${lead._id}`);
        return res.status(201).json({ ok: true, id: lead._id });
    } catch (err) {
        console.error('[leads] store failed:', err.message);
        return res.status(500).json({ error: 'could not store lead' });
    }
});

/**
 * GET /leads — recent submissions, newest first.
 *
 * Deliberately open, matching the demo nature of this app. Real lead data is customer PII and
 * would sit behind requireAuth like /users/me does.
 */
router.get('/', async (req, res) => {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

    // More than one site delivers here, so each one asks for its own leads by domain. Without
    // the filter every site's Leads page would show every other site's submissions.
    const filter = {};
    if (typeof req.query.domain === 'string' && req.query.domain.trim()) {
        filter.domain = req.query.domain.trim();
    }

    try {
        const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
        return res.json({
            leads: leads.map((l) => ({
                id: String(l._id),
                receivedAt: l.createdAt,
                submittedAt: l.submitted_at,
                elementId: l.element_id,
                elementType: l.element_type,
                formName: l.form_name,
                domain: l.domain,
                pathname: l.pathname,
                formData: l.form_data,
            })),
            count: leads.length,
        });
    } catch (err) {
        console.error('[leads] fetch failed:', err.message);
        return res.status(500).json({ error: 'could not fetch leads' });
    }
});

/**
 * DELETE /leads/:id — remove one lead.
 *
 * Open like the GET above, matching the demo nature of this app. On anything real this is a
 * destructive operation on customer PII and would sit behind requireAuth.
 */
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Lead.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'lead not found' });

        console.log(`[leads] deleted ${req.params.id}`);
        return res.json({ ok: true });
    } catch (err) {
        // An id that is not a valid ObjectId throws here rather than returning null.
        console.error('[leads] delete failed:', err.message);
        return res.status(400).json({ error: 'invalid id' });
    }
});

/**
 * DELETE /leads — remove every lead.
 *
 * Requires ?confirm=yes so a stray DELETE on the collection URL cannot wipe the table by
 * accident. Exists to clear test data between runs.
 */
router.delete('/', async (req, res) => {
    if (req.query.confirm !== 'yes') {
        return res.status(400).json({ error: 'add ?confirm=yes to delete all leads' });
    }

    // Scoped by domain when one is given. More than one site delivers here, so an unscoped
    // "delete all" from one site's Leads page would wipe every other site's leads too.
    const filter = {};
    if (typeof req.query.domain === 'string' && req.query.domain.trim()) {
        filter.domain = req.query.domain.trim();
    }

    try {
        const { deletedCount } = await Lead.deleteMany(filter);
        console.log(`[leads] deleted ${deletedCount}${filter.domain ? ` for ${filter.domain}` : ' (ALL domains)'}`);
        return res.json({ ok: true, deleted: deletedCount });
    } catch (err) {
        console.error('[leads] delete all failed:', err.message);
        return res.status(500).json({ error: 'could not delete leads' });
    }
});

module.exports = router;
