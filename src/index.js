require('dotenv').config();

// Force Google DNS for SRV lookups — local DNS may not support SRV records
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./db/connect');
const authRoutes   = require('./routes/auth');
const userRoutes   = require('./routes/users');
const leadRoutes   = require('./routes/leads');

const app  = express();
const PORT = process.env.PORT || 4000;

// Security headers
app.use(helmet());

// CORS — allow the saas_nextjs frontend.
//
// Comma-separated so the deployed site and local dev can both be allowed at once. This matters
// for Preta's Direct delivery mode: the visitor's BROWSER posts the lead straight to /leads from
// the live site, so that origin must be allowed or every direct submission fails the preflight
// and silently falls back to delivery through Preta.
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  allowedOrigins.push('http://localhost:3002', 'https://saas-nextjs-flax.vercel.app');
}

app.use(cors({
  // Callback form rather than a bare array so a request with no Origin header (server-to-server,
  // curl) is allowed through.
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
  // DELETE is used by the Leads page to clear test data; without it the browser's preflight
  // rejects the request before it reaches us.
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/auth',  authRoutes);
app.use('/users', userRoutes);
app.use('/leads', leadRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// 404
app.use((_, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Saasify backend running on http://localhost:${PORT}`);
  });
}

start();
