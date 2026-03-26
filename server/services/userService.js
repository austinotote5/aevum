const db = require('../db');

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  dateOfBirth: row.date_of_birth,
  biologicalSex: row.biological_sex,
  heightCm: row.height_cm,
  weightKg: row.weight_kg,
  timezone: row.timezone,
  plan: row.plan,
  isActive: row.is_active,
  emailVerified: row.email_verified,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const findUserByEmail = async (email) => {
  const query = `
    SELECT *
    FROM users
    WHERE email = $1
    LIMIT 1
  `;

  const { rows } = await db.query(query, [email.toLowerCase()]);
  return rows[0] || null;
};

const findUserById = async (id) => {
  const query = `
    SELECT *
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

const updateUserPlan = async (id, plan) => {
  const query = `
    UPDATE users
    SET
      plan = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(query, [id, plan]);
  return rows[0] || null;
};

const createUser = async ({
  email,
  passwordHash,
  firstName,
  lastName,
  dateOfBirth = null,
  biologicalSex = null,
  heightCm = null,
  weightKg = null,
  timezone = 'UTC',
  plan = 'free',
}) => {
  const query = `
    INSERT INTO users (
      email,
      password_hash,
      first_name,
      last_name,
      date_of_birth,
      biological_sex,
      height_cm,
      weight_kg,
      timezone,
      plan
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

  const values = [
    email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    dateOfBirth,
    biologicalSex,
    heightCm,
    weightKg,
    timezone,
    plan,
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

module.exports = {
  mapUser,
  findUserByEmail,
  findUserById,
  updateUserPlan,
  createUser,
};
