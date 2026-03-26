const LOCALHOST_URL_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const validateCriticalEnv = () => {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required.');
  }

  if (jwtSecret.length < (isProduction ? 64 : 32)) {
    throw new Error(
      isProduction
        ? 'JWT_SECRET must be at least 64 characters in production.'
        : 'JWT_SECRET must be at least 32 characters.'
    );
  }

  if (isProduction) {
    const clientUrl = String(process.env.CLIENT_URL || '').trim();
    if (!clientUrl) {
      throw new Error('CLIENT_URL is required in production.');
    }

    if (LOCALHOST_URL_PATTERN.test(clientUrl)) {
      throw new Error('CLIENT_URL cannot be localhost in production.');
    }

    if (!clientUrl.startsWith('https://')) {
      throw new Error('CLIENT_URL must use https:// in production.');
    }

    const dbPassword = String(process.env.DB_PASSWORD || '').trim();
    if (!dbPassword) {
      throw new Error('DB_PASSWORD is required in production.');
    }
  }
};

module.exports = {
  validateCriticalEnv,
};
