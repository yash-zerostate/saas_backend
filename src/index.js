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

const app  = express();
const PORT = process.env.PORT || 4000;

// Security headers
app.use(helmet());

// CORS — allow saas_nextjs frontend
app.use(cors({
  origin:      process.env.ALLOWED_ORIGIN || 'http://localhost:3002',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/auth',  authRoutes);
app.use('/users', userRoutes);

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
