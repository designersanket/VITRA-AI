import express from 'express';
import {
  getJournals,
  createJournal,
  updateJournal,
  deleteJournal,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addGoalMilestone,
  toggleMilestone,
  getSnapshots,
  createDocument,
  getDocuments,
  searchDocuments,
  createShareToken,
  getSharedTwin,
  getNotifications,
  sendWeeklyDigest
} from '../controllers/productivityController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Journals
router.get('/journals', protect, getJournals);
router.post('/journals', protect, createJournal);
router.put('/journals/:id', protect, updateJournal);
router.delete('/journals/:id', protect, deleteJournal);

// Goals
router.get('/goals', protect, getGoals);
router.post('/goals', protect, createGoal);
router.put('/goals/:id', protect, updateGoal);
router.delete('/goals/:id', protect, deleteGoal);
router.post('/goals/:id/milestones', protect, addGoalMilestone);
router.put('/goals/:goalId/milestones/:index/toggle', protect, toggleMilestone);

// Twin evolution timeline
router.get('/snapshots', protect, getSnapshots);

// Documents + RAG
router.post('/documents', protect, createDocument);
router.get('/documents', protect, getDocuments);
router.get('/documents/search', protect, searchDocuments);

// Twin sharing
router.post('/share', protect, createShareToken);
router.get('/share/:token', getSharedTwin);

// Notifications and digest
router.get('/notifications', protect, getNotifications);
router.post('/notifications/digest', protect, sendWeeklyDigest);

export default router;
