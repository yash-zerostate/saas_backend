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
    const { form_data, element_id, domain, pathname, timestamp } = req.body || {};

    // Array is rejected explicitly: `typeof [] === 'object'`, so without this an array would slip
    // through and be stored as a lead with no fields.
    if (!form_data || typeof form_data !== 'object' || Array.isArray(form_data)) {
        return res.status(400).json({ error: 'form_data is required' });
    }

    try {
        const lead = await Lead.create({
            element_id: element_id || null,
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

    try {
        const leads = await Lead.find().sort({ createdAt: -1 }).limit(limit).lean();
        return res.json({
            leads: leads.map((l) => ({
                id: String(l._id),
                receivedAt: l.createdAt,
                submittedAt: l.submitted_at,
                elementId: l.element_id,
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

module.exports = router;
