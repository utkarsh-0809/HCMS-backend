import express from 'express';
import {
  getChildrenByStaff,
  getChildrenByAanganwadi,
  getChildDetails,
  addChild,
  updateChild,
  addBMIRecord,
  getBMIHistory,
  deleteChild
} from '../controllers/childController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Routes for aanganwadi staff
router.get('/my-children', authMiddleware(['aanganwadi_staff']), getChildrenByStaff);
router.post('/add', authMiddleware(['aanganwadi_staff']), addChild);
router.put('/:childId', authMiddleware(['aanganwadi_staff', 'coordinator']), updateChild);
router.delete('/:childId', authMiddleware(['aanganwadi_staff', 'coordinator']), deleteChild);
router.post('/:childId/bmi', authMiddleware(['aanganwadi_staff', 'doctor']), addBMIRecord);

// Routes for coordinators and doctors
router.get('/aanganwadi/:aanganwadiCode', authMiddleware(['coordinator', 'doctor']), getChildrenByAanganwadi);

// Routes for detailed view (all roles can view with appropriate permissions)
router.get('/:childId', authMiddleware(['aanganwadi_staff', 'coordinator', 'doctor']), getChildDetails);
router.get('/:childId/bmi-history', authMiddleware(['aanganwadi_staff', 'coordinator', 'doctor']), getBMIHistory);

export default router;