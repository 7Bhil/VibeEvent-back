import express from 'express';
import { createPoll, getPollsByEvent, voteInPoll, getMyPolls, closePoll } from '../controllers/pollController.js';
import { protect, organizer } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, organizer, createPoll);
router.get('/my-polls', protect, organizer, getMyPolls);
router.post('/vote', protect, voteInPoll);
router.get('/event/:eventId', protect, getPollsByEvent);
router.patch('/:id/close', protect, organizer, closePoll);

export default router;
