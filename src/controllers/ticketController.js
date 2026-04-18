import Ticket from '../models/Ticket.js';
import Event from '../models/Event.js';
import Organization from '../models/Organization.js';
import jwt from 'jsonwebtoken';

// 1. Acheter un ticket
export const buyTicket = async (req, res) => {
    try {
        const { eventId, tier } = req.body;
        const userId = req.user._id;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const ticketTier = event.tickets.find(t => t.tier === tier);
        if (!ticketTier) return res.status(400).json({ message: 'Invalid ticket tier' });

        // Créer le ticket
        const ticket = await Ticket.create({
            event: eventId,
            user: userId,
            tier: tier,
            pricePaid: ticketTier.price
        });

        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Mes tickets (pour le participant)
export const getMyTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.user._id })
            .populate('event', 'title date location image')
            .sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Générer le Token QR Dynamique (Valide 1 minute)
export const generateQRToken = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const ticket = await Ticket.findById(ticketId);

        if (!ticket || ticket.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Token très court pour empêcher les captures d'écran
        const token = jwt.sign(
            { ticketId: ticket._id, type: 'entry_qr' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1m' }
        );

        res.json({ qrToken: token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Scanner un ticket (Staff)
export const scanTicket = async (req, res) => {
    try {
        const { qrToken, action } = req.body; // action: 'in' (entrer) ou 'out' (sortir)
        const staffId = req.user._id;

        // Déchiffrer le token
        let decoded;
        try {
            decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ message: 'Code QR expiré ou invalide. Veuillez rafraîchir.' });
        }

        if (decoded.type !== 'entry_qr') {
            return res.status(400).json({ message: 'Type de QR invalide' });
        }

        const ticket = await Ticket.findById(decoded.ticketId).populate('event');
        if (!ticket) return res.status(404).json({ message: 'Ticket introuvable' });

        // Vérifier que le staff a le droit (appartient à l'orga de l'événement)
        const org = await Organization.findOne({ _id: ticket.event.organization, members: staffId });
        if (!org) {
            return res.status(403).json({ message: "Vous n'êtes pas autorisé à scanner pour cet événement." });
        }

        // Logique de scan ENTREE / SORTIE
        if (action === 'in') {
            if (ticket.status === 'checked_in') {
                return res.status(400).json({ status: 'error', message: 'UTILISATEUR DÉJÀ À L\'INTÉRIEUR !', ticket });
            }
            ticket.status = 'checked_in';
        } else if (action === 'out') {
            if (ticket.status === 'active' || ticket.status === 'checked_out') {
                return res.status(400).json({ status: 'error', message: 'L\'utilisateur n\'est pas à l\'intérieur !', ticket });
            }
            ticket.status = 'checked_out'; // Permet de rentrer à nouveau (active)
        } else {
            return res.status(400).json({ message: "Action invalide" });
        }

        // Log du scan
        ticket.scans.push({ action, scannedBy: staffId });
        await ticket.save();

        res.json({ 
            status: 'success', 
            message: action === 'in' ? 'ACCÈS AUTORISÉ' : 'SORTIE ENREGISTRÉE',
            ticketType: ticket.tier 
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
