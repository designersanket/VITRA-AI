import express from 'express';
import { getTwin, createOrUpdateTwin, getSystemPrompt, handleFeedback } from '../controllers/twinController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getTwin);
router.post('/', protect, createOrUpdateTwin);
router.get('/system-prompt', protect, getSystemPrompt);
router.post('/feedback/:messageId', protect, handleFeedback);

export default router;
