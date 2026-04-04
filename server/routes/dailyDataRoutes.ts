import express from 'express';
import { getDailyData, getDailyDataByDate, createOrUpdateDailyData } from '../controllers/dailyDataController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getDailyData);
router.get('/:date', protect, getDailyDataByDate);
router.post('/', protect, createOrUpdateDailyData);

export default router;
