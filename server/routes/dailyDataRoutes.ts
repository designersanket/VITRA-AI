import express from 'express';
import {
  getDailyData,
  getDailyDataByDate,
  createOrUpdateDailyData,
  processAndSaveDailyLog,
  getBehaviorAnalysis,
} from '../controllers/dailyDataController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getDailyData);
router.get('/behavior', protect, getBehaviorAnalysis);
router.get('/:date', protect, getDailyDataByDate);
router.post('/', protect, createOrUpdateDailyData);
router.post('/process', protect, processAndSaveDailyLog);

export default router;
