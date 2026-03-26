const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { signAuthToken } = require('../utils/token');
const {
  mapUser,
  findUserByEmail,
  findUserById,
  createUser,
} = require('../services/userService');

const register = asyncHandler(async (req, res) => {
  const email = String(req.body.email).trim().toLowerCase();
  const password = String(req.body.password);
  const firstName = String(req.body.firstName).trim();
  const lastName = String(req.body.lastName).trim();

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userRow = await createUser({
    email,
    passwordHash,
    firstName,
    lastName,
    dateOfBirth: req.body.dateOfBirth || null,
    biologicalSex: req.body.biologicalSex || null,
    heightCm: req.body.heightCm || null,
    weightKg: req.body.weightKg || null,
    timezone: req.body.timezone || 'UTC',
    // Prevent privilege escalation through public registration.
    plan: 'free',
  });

  const user = mapUser(userRow);
  const token = signAuthToken(user);

  res.status(201).json({
    data: {
      token,
      user,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email).trim().toLowerCase();
  const password = String(req.body.password);

  const userRow = await findUserByEmail(email);
  if (!userRow) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, userRow.password_hash);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const user = mapUser(userRow);
  const token = signAuthToken(user);

  res.status(200).json({
    data: {
      token,
      user,
    },
  });
});

const me = asyncHandler(async (req, res) => {
  const userRow = await findUserById(req.auth.userId);
  if (!userRow) {
    throw ApiError.notFound('Authenticated user was not found.');
  }

  res.status(200).json({
    data: mapUser(userRow),
  });
});

module.exports = {
  register,
  login,
  me,
};
