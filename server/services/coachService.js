const { randomUUID } = require('crypto');
const db = require('../db');
const { logger } = require('../utils/logger');

const FALLBACK_MODEL = 'local-fallback';
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const mapCoachMessage = (row) => ({
  id: row.id,
  userId: row.user_id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  tokensUsed: row.tokens_used,
  createdAt: row.created_at,
});

const saveCoachMessage = async ({
  userId,
  sessionId,
  role,
  content,
  tokensUsed = null,
}) => {
  const query = `
    INSERT INTO coach_messages (
      user_id,
      session_id,
      role,
      content,
      tokens_used
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const values = [userId, sessionId, role, content, tokensUsed];
  const { rows } = await db.query(query, values);
  return mapCoachMessage(rows[0]);
};

const getSessionMessages = async (userId, sessionId, limit = 50) => {
  const query = `
    SELECT *
    FROM coach_messages
    WHERE user_id = $1
      AND session_id = $2
    ORDER BY created_at ASC
    LIMIT $3
  `;

  const { rows } = await db.query(query, [userId, sessionId, limit]);
  return rows.map(mapCoachMessage);
};

const buildFallbackReply = (message, coachContext = '') => {
  const prompt = message.trim();
  const trendLine = coachContext ? `Trend intelligence: ${coachContext}` : 'Trend intelligence: baseline trend profile only.';

  return [
    'Recovery is trending positive based on your current profile.',
    trendLine,
    '',
    `Priority now: ${prompt.slice(0, 120)}`,
    '',
    'Action plan for the next 6 hours:',
    '1. Keep hydration steady (500-700ml over 2 hours).',
    '2. Complete one focused 90-minute deep-work block.',
    '3. Add a 10-15 minute walk post-meal to support glucose stability.',
    '',
    'Send your latest HRV, sleep, and resting HR for a tighter protocol.',
  ].join('\n');
};

const isAnthropicConfigured = () => {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  return key.startsWith('sk-ant-') && !key.includes('your-key-here');
};

const toAnthropicMessages = (history) => history
  .filter((item) => item.role === 'user' || item.role === 'assistant')
  .map((item) => ({
    role: item.role,
    content: item.content,
  }));

const getCoachReply = async ({ history, latestUserMessage, coachContext = '' }) => {
  if (!isAnthropicConfigured()) {
    return {
      content: buildFallbackReply(latestUserMessage, coachContext),
      model: FALLBACK_MODEL,
      tokensUsed: null,
      fallbackUsed: true,
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 15000);

  try {
    const trendContextLine = coachContext
      ? `Current biometric trend context: ${coachContext}`
      : 'Current biometric trend context: unavailable.';

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 700,
        system: `You are AEVUM, an elite health intelligence coach. Be concise, specific, and actionable.\n${trendContextLine}`,
        messages: toAnthropicMessages(history).slice(-20),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${text.slice(0, 500)}`);
    }

    const data = await response.json();
    const content = Array.isArray(data.content)
      ? data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()
      : '';

    if (!content) {
      throw new Error('Anthropic response did not include text output.');
    }

    return {
      content,
      model: data.model || DEFAULT_ANTHROPIC_MODEL,
      tokensUsed: data?.usage?.output_tokens || null,
      fallbackUsed: false,
    };
  } catch (error) {
    logger.warn('coach_fallback_response', {
      reason: error.message,
    });

    return {
      content: buildFallbackReply(latestUserMessage, coachContext),
      model: FALLBACK_MODEL,
      tokensUsed: null,
      fallbackUsed: true,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const createSessionId = () => randomUUID();

module.exports = {
  saveCoachMessage,
  getSessionMessages,
  getCoachReply,
  createSessionId,
};
