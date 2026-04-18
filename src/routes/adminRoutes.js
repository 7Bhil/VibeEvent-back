import express from 'express';
import { getAdminStats, getAllUsers, getAllOrganizations } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', protect, admin, getAdminStats);
router.get('/users', protect, admin, getAllUsers);
router.get('/organizations', protect, admin, getAllOrganizations);

export default router;
