import express from 'express';
import { getTwin, createOrUpdateTwin, getSystemPrompt, handleFeedback, getDashboardSummary } from '../controllers/twinController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getTwin);
router.post('/', protect, createOrUpdateTwin);
router.patch('/', protect, createOrUpdateTwin);
router.get('/system-prompt', protect, getSystemPrompt);
router.get('/dashboard-summary', protect, getDashboardSummary);
router.post('/feedback/:messageId', protect, handleFeedback);

export default router;
