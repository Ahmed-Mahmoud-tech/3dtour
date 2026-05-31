import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/photovideo360';

  // Try the configured URI first
  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return;
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('MongoDB connection error:', err.message);
      process.exit(1);
    }
    console.warn(`Local MongoDB unavailable (${err.message})`);
    console.log('Starting mongodb-memory-server for development...');
  }

  // Dev fallback: in-memory MongoDB
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const memUri = mongod.getUri();
    await mongoose.connect(memUri);
    console.log(`MongoDB (in-memory) connected: ${memUri}`);
    console.warn('WARNING: Data is not persisted — for dev/testing only.');
  } catch (memErr) {
    console.error('Failed to start in-memory MongoDB:', memErr.message);
    process.exit(1);
  }
};
