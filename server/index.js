const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const biometricRoutes = require('./routes/biometrics');
const coachRoutes = require('./routes/coach');
const protocolRoutes = require('./routes/protocols');
const contraindicationRoutes = require('./routes/contraindications');
const wearableRoutes = require('./routes/wearables');
const outcomeRoutes = require('./routes/outcomes');
const platformRoutes = require('./routes/platform');
const clinicianRoutes = require('./routes/clinician');
const billingRoutes = require('./routes/billing');
const complianceRoutes = require('./routes/compliance');
const opsRoutes = require('./routes/ops');
const requestContext = require('./middleware/requestContext');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { logger, serializeError } = require('./utils/logger');
const { validateCriticalEnv } = require('./utils/env');
const db = require('./db');

validateCriticalEnv();

const app = express();
const PORT = process.env.PORT || 4000;
const configuredClientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (origin === configuredClientUrl) {
      return callback(null, true);
    }

    const isLocalhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin);
    if (isDev && isLocalhostOrigin) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(requestContext);
app.use(requestLogger);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 3000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
});

const coachLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 300 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many coach requests. Please slow down and try again shortly.' },
});

const protocolMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 900 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many protocol updates. Please try again later.' },
});

const wearableSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 900 : 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many wearable sync requests. Please retry in a few minutes.' },
});

const outcomesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 900 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many outcomes requests. Please retry shortly.' },
});

const enterpriseReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 900 : 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enterprise analytics requests. Please retry shortly.' },
});

app.use(globalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
  });
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1 AS ok');
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/biometrics', biometricRoutes);
app.use('/api/coach', coachLimiter, coachRoutes);
app.use('/api/protocols', protocolMutationLimiter, protocolRoutes);
app.use('/api/contraindications', contraindicationRoutes);
app.use('/api/wearables', wearableSyncLimiter, wearableRoutes);
app.use('/api/outcomes', outcomesLimiter, outcomeRoutes);
app.use('/api/platform', enterpriseReadLimiter, platformRoutes);
app.use('/api/clinician', enterpriseReadLimiter, clinicianRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/compliance', enterpriseReadLimiter, complianceRoutes);
app.use('/api/ops', enterpriseReadLimiter, opsRoutes);

app.use(notFound);
app.use(errorHandler);

if (!global.__AEVUM_PROCESS_ERROR_HOOKS__) {
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', {
      error: serializeError(reason),
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('uncaught_exception', {
      error: serializeError(error),
    });
  });

  global.__AEVUM_PROCESS_ERROR_HOOKS__ = true;
}

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info('server_started', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      health: `http://localhost:${PORT}/health`,
    });
  });
}

module.exports = app;
