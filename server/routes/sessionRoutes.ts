import express from 'express';
import { getSessions, createSession, updateSession, deleteSession } from '../controllers/sessionController';
import { protect } from '../middleware/authMiddleware';
import { getMessages, createMessage, updateMessage } from '../controllers/messageController';

const router = express.Router();

router.get('/', protect, getSessions);
router.post('/', protect, createSession);
router.put('/:id', protect, updateSession);
router.delete('/:id', protect, deleteSession);

// Nested message routes
router.get('/:sessionId/messages', protect, getMessages);
router.post('/:sessionId/messages', protect, createMessage);
router.put('/:sessionId/messages/:id', protect, updateMessage);
router.patch('/:sessionId/messages/:id', protect, updateMessage);

export default router;
