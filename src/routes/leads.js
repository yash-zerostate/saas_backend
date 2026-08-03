const express = require('express');
const crypto  = require('crypto');

const Lead = require('../models/Lead');

const router = express.Router();

/**
 * Lead intake for Preta form submissions.
 *
 * Preta never stores lead data — it delivers each submission here. Two ways it can arrive, and
 * this one route handles both:
 *
 *   Direct        — the visitor's browser POSTs straight here. No signature is possible (a
 *                   browser cannot hold a secret), so treat it like any public form endpoint.
 *   Through Preta — Preta's server POSTs here and signs the request. Verifying the signature
 *                   proves it genuinely came from Preta.
 *
 * Unsigned requests are accepted — that is exactly what Direct mode looks like — but recorded as
 * unverified so the dashboard can show which path each lead took.
 */

/** Returns 'verified' | 'bad-signature' | 'unsigned' | 'no-secret-configured'. */
function checkSignature(rawBody, timestamp, signature) {
  if (!signature) return 'unsigned';

  const secret = process.env.PRETA_SIGNING_SECRET;
  if (!secret) return 'no-secret-configured';

  // The timestamp is inside the signed string, so a captured request cannot be replayed
  // forever. Five minutes is the window Preta documents.
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return 'bad-signature';
  }

  const expected = 'v1=' + crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  // timingSafeEqual, not === : a plain compare leaks the signature one byte at a time.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'bad-signature';

  return 'verified';
}

/**
 * POST /leads — receive one submission.
 *
 * express.raw so the RAW bytes are available: the signature covers exactly what Preta sent, and
 * re-serialising a parsed object would produce a different string that never matches.
 */
router.post('/', express.raw({ type: '*/*', limit: '128kb' }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');

  const signature = req.get('X-Preta-Signature');
  const timestamp = req.get('X-Preta-Timestamp');
  const verification = checkSignature(raw, timestamp, signature);

  if (verification === 'bad-signature') {
    console.warn('[leads] rejected: signature did not verify');
    return res.status(401).json({ error: 'bad signature' });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'invalid JSON' });
  }

  const { form_data, element_id, domain, pathname, timestamp: submittedAt } = payload || {};

  if (!form_data || typeof form_data !== 'object' || Array.isArray(form_data)) {
    return res.status(400).json({ error: 'form_data is required' });
  }

  try {
    const lead = await Lead.create({
      element_id:   element_id || null,
      domain:       domain || null,
      pathname:     pathname || null,
      form_data:    form_data,
      route:        signature ? 'through-preta' : 'direct',
      verification,
      submitted_at: submittedAt ? new Date(submittedAt) : null,
    });

    console.log(`[leads] stored ${lead._id} via ${lead.route} (${verification})`);
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
        id:           String(l._id),
        receivedAt:   l.createdAt,
        submittedAt:  l.submitted_at,
        route:        l.route,
        verification: l.verification,
        elementId:    l.element_id,
        domain:       l.domain,
        pathname:     l.pathname,
        formData:     l.form_data,
      })),
      count: leads.length,
      signingSecretConfigured: !!process.env.PRETA_SIGNING_SECRET,
    });
  } catch (err) {
    console.error('[leads] fetch failed:', err.message);
    return res.status(500).json({ error: 'could not fetch leads' });
  }
});

module.exports = router;
