const ApiError = require('../utils/apiError');
const { verifyAuthToken } = require('../utils/token');

const authenticate = (req, res, next) => {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing bearer token.'));
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return next(ApiError.unauthorized('Missing bearer token.'));
  }

  try {
    const payload = verifyAuthToken(token);

    if (!payload?.sub) {
      return next(ApiError.unauthorized('Invalid token payload.'));
    }

    req.auth = {
      userId: payload.sub,
      email: payload.email,
      plan: payload.plan,
    };

    return next();
  } catch (error) {
    return next(ApiError.unauthorized('Invalid or expired token.'));
  }
};

module.exports = authenticate;
