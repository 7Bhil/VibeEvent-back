import express from 'express';
import { createEvent, getEvents, getMyEvents, deleteEvent, updateEvent, getEventById, getOrganizerStats, toggleHype } from '../controllers/eventController.js';
import { protect, organizer } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getEvents);
router.get('/stats', protect, organizer, getOrganizerStats);
router.get('/my-events', protect, organizer, getMyEvents);
router.get('/:id', getEventById);

router.post('/:id/hype', protect, toggleHype);
router.post('/', protect, organizer, createEvent);
router.put('/:id', protect, organizer, updateEvent);
router.delete('/:id', protect, organizer, deleteEvent);

export default router;
