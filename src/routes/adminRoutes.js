import express from 'express';
import { getAdminStats, getAllUsers, getAllOrganizations, updateUserRole, toggleUserStatus } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', protect, admin, getAdminStats);
router.get('/users', protect, admin, getAllUsers);
router.get('/organizations', protect, admin, getAllOrganizations);

// User Management Routes
router.put('/users/:id/role', protect, admin, updateUserRole);
router.put('/users/:id/status', protect, admin, toggleUserStatus);

export default router;
