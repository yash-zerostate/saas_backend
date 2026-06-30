const mongoose = require('mongoose');

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected:', mongoose.connection.host);
}

module.exports = { connectDB };
