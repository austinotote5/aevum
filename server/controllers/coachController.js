const asyncHandler = require('../utils/asyncHandler');
const {
  saveCoachMessage,
  getSessionMessages,
  getCoachReply,
  createSessionId,
} = require('../services/coachService');

const sendMessage = asyncHandler(async (req, res) => {
  const sessionId = req.body.sessionId || createSessionId();
  const message = String(req.body.message).trim();
  const userId = req.auth.userId;

  await saveCoachMessage({
    userId,
    sessionId,
    role: 'user',
    content: message,
  });

  const history = await getSessionMessages(userId, sessionId, 40);
  const assistant = await getCoachReply({
    history,
    latestUserMessage: message,
    coachContext: req.body.context || '',
  });

  const assistantMessage = await saveCoachMessage({
    userId,
    sessionId,
    role: 'assistant',
    content: assistant.content,
    tokensUsed: assistant.tokensUsed,
  });

  res.status(201).json({
    data: {
      sessionId,
      message: assistantMessage,
      model: assistant.model,
      fallbackUsed: assistant.fallbackUsed,
    },
  });
});

const getMessages = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { sessionId } = req.params;
  const messages = await getSessionMessages(userId, sessionId, 200);

  res.status(200).json({
    data: {
      sessionId,
      messages,
    },
  });
});

module.exports = {
  sendMessage,
  getMessages,
};
