import express from 'express';
import { verifyAanganwadiCode, getAanganwadiByCode } from '../controllers/aanganwadiController.js';

const router = express.Router();

// Public verification
router.get('/verify/:code', verifyAanganwadiCode);
router.get('/:code', getAanganwadiByCode);

export default router;
