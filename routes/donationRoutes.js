import express from 'express';
import {
  createDonation,
  getAllDonations,
  getDonationById,
  verifyDonation,
  distributeDonation,
  getDonationsByAanganwadi,
  getDonationStats,
  processDonationsToInventory
} from '../controllers/donationController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import upload from '../utils/multer.js';

const router = express.Router();

// Public route for creating donations with file upload support
router.post('/create', upload.array('images', 5), createDonation);

// Routes for coordinators
router.get('/', authMiddleware(['coordinator']), getAllDonations);
router.get('/stats', authMiddleware(['coordinator']), getDonationStats);
router.post('/process-to-inventory', authMiddleware(['coordinator', 'admin']), processDonationsToInventory);
router.get('/:donationId', authMiddleware(['coordinator']), getDonationById);
router.put('/:donationId/verify', authMiddleware(['coordinator']), verifyDonation);
router.put('/:donationId/distribute', authMiddleware(['coordinator']), distributeDonation);

// Routes for aanganwadi staff to see their received donations
router.get('/aanganwadi/:aanganwadiCode', authMiddleware(['aanganwadi_staff', 'coordinator']), getDonationsByAanganwadi);

export default router;