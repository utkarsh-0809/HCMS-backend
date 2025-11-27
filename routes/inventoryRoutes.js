import express from 'express';
import {
  createInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  allocateInventory,
  releaseInventory,
  getLowStockAlerts,
  getInventoryStats,
  deleteInventoryItem
} from '../controllers/inventoryController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Routes for admins and coordinators
router.post('/create', authMiddleware(['admin', 'coordinator']), createInventoryItem);
router.get('/', authMiddleware(['admin', 'coordinator']), getAllInventoryItems);
router.get('/stats', authMiddleware(['admin', 'coordinator']), getInventoryStats);
router.get('/low-stock', authMiddleware(['admin', 'coordinator']), getLowStockAlerts);

// Routes for specific inventory items
router.get('/:itemId', authMiddleware(['admin', 'coordinator']), getInventoryItemById);
router.put('/:itemId', authMiddleware(['admin', 'coordinator']), updateInventoryItem);
router.delete('/:itemId', authMiddleware(['admin']), deleteInventoryItem);

// Routes for allocation management (admin only)
router.post('/:itemId/allocate', authMiddleware(['admin']), allocateInventory);
router.post('/:itemId/release', authMiddleware(['admin']), releaseInventory);

export default router;