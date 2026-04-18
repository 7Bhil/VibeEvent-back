import express from 'express';
import { createEvent, getEvents, getMyEvents, deleteEvent, getEventById } from '../controllers/eventController.js';
import { protect, organizer } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getEvents);
router.get('/:id', getEventById);
router.post('/', protect, organizer, createEvent);

router.get('/my-events', protect, organizer, getMyEvents);
router.delete('/:id', protect, organizer, deleteEvent);

export default router;
