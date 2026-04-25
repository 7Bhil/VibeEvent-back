import Poll from '../models/Poll.js';
import Ticket from '../models/Ticket.js';
import Event from '../models/Event.js';

export const createPoll = async (req, res) => {
    try {
        const { eventId, question, description, options, expiresAt } = req.body;
        
        if (eventId) {
            const event = await Event.findById(eventId);
            if (!event || event.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Vous ne pouvez créer des sondages que pour vos propres événements." });
            }
        }

        const poll = await Poll.create({
            event: eventId,
            question,
            description,
            options: options.map(opt => ({ text: opt })),
            expiresAt,
            createdBy: req.user._id
        });

        res.status(201).json(poll);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPollsByEvent = async (req, res) => {
    try {
        const polls = await Poll.find({ event: req.params.eventId }).sort({ createdAt: -1 });
        res.json(polls);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const voteInPoll = async (req, res) => {
    try {
        const { pollId, optionId } = req.body;
        const userId = req.user._id;

        const poll = await Poll.findById(pollId);
        if (!poll) return res.status(404).json({ message: "Sondage introuvable." });

        if (poll.status === 'closed' || (poll.expiresAt && new Date() > poll.expiresAt)) {
            return res.status(400).json({ message: "Ce sondage est terminé." });
        }

        // Vérifier si déjà voté
        if (poll.voters.includes(userId)) {
            return res.status(400).json({ message: "Vous avez déjà voté pour ce sondage." });
        }

        // Vérifier si l'utilisateur possède un ticket pour cet événement (si le sondage est lié à un événement)
        if (poll.event) {
            const hasTicket = await Ticket.findOne({ event: poll.event, user: userId });
            if (!hasTicket && req.user.role !== 'admin') {
                return res.status(403).json({ message: "Seuls les détenteurs de billets peuvent voter pour ce sondage lié à un événement." });
            }
        }

        // Enregistrer le vote
        const option = poll.options.id(optionId);
        if (!option) return res.status(400).json({ message: "Option de vote invalide." });

        option.votes += 1;
        poll.voters.push(userId);
        await poll.save();

        res.json({ message: "Vote enregistré avec succès.", poll });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getMyPolls = async (req, res) => {
    try {
        const polls = await Poll.find({ createdBy: req.user._id }).populate('event', 'title');
        res.json(polls);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const closePoll = async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll || poll.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Non autorisé" });
        }
        poll.status = 'closed';
        await poll.save();
        res.json(poll);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
