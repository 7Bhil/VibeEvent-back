import express from 'express';
import { createOrganization, addMember, dissolveOrganization } from '../controllers/organizationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createOrganization);
router.post('/add-member', protect, addMember);
router.delete('/:organizationId', protect, dissolveOrganization);

export default router;
