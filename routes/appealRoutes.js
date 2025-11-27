import express from 'express';
import {
  createAppeal,
  getAllAppeals,
  getAppealById,
  updateAppealStatus,
  uploadSupportingDocuments,
  updateFulfillmentStatus,
  submitCoordinatorFeedback,
  getAppealStats
} from '../controllers/appealController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Routes for coordinators
router.post('/create', authMiddleware(['coordinator']), createAppeal);
router.get('/my-appeals', authMiddleware(['coordinator']), getAllAppeals);
router.post('/:appealId/feedback', authMiddleware(['coordinator']), submitCoordinatorFeedback);

// Routes for admins
router.get('/', authMiddleware(['admin']), getAllAppeals);
router.get('/stats', authMiddleware(['admin']), getAppealStats);
router.put('/:appealId/status', authMiddleware(['admin']), updateAppealStatus);
router.put('/:appealId/fulfillment', authMiddleware(['admin']), updateFulfillmentStatus);

// Routes accessible by both coordinators and admins
router.get('/:appealId', authMiddleware(['coordinator', 'admin']), getAppealById);
router.post('/:appealId/documents', authMiddleware(['coordinator', 'admin']), uploadSupportingDocuments);

export default router;