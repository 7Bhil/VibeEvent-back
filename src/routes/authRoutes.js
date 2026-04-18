import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { requestUpgrade, getPendingRequests, handleRequest } from '../controllers/roleController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Role management
router.post('/upgrade-request', protect, requestUpgrade);
router.get('/pending-upgrades', protect, admin, getPendingRequests);
router.post('/handle-upgrade', protect, admin, handleRequest);

export default router;

