import express from 'express';
import { storeChatMessage, storeDailyLog, getFullMemory } from '../controllers/memoryController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/chat', protect, storeChatMessage);
router.post('/daily', protect, storeDailyLog);
router.get('/:userId', protect, getFullMemory);

export default router;
