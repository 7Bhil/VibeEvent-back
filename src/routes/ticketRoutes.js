import express from 'express';
import { buyTicket, getMyTickets, generateQRToken, scanTicket, getEventAttendees } from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/buy', protect, buyTicket);
router.get('/my-tickets', protect, getMyTickets);
router.get('/:ticketId/qr', protect, generateQRToken);
router.post('/scan', protect, scanTicket);
router.get('/event/:eventId/attendees', protect, getEventAttendees);

export default router;
