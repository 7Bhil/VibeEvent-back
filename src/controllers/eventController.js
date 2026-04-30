import Event from '../models/Event.js';
import Organization from '../models/Organization.js';

export const createEvent = async (req, res) => {
    try {
        const { title, description, date, location, category, tickets, currency, googleMapsLink, image } = req.body;
        
        // Find user's organization
        const organization = await Organization.findOne({ owner: req.user._id });
        if (!organization) {
            return res.status(403).json({ message: "You must own an organization to create an event." });
        }

        const event = await Event.create({
            title,
            description,
            date,
            location,
            category,
            tickets,
            currency,
            googleMapsLink,
            image,
            organization: organization._id,
            createdBy: req.user._id
        });

        // Add event to organization
        organization.events.push(event._id);
        await organization.save();

        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getEvents = async (req, res) => {
    try {
        const events = await Event.find({ status: 'published' }).populate('organization', 'name');
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('organization', 'name');
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const getMyEvents = async (req, res) => {
    try {
        const events = await Event.find({ createdBy: req.user._id });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

import Ticket from '../models/Ticket.js';

export const getOrganizerStats = async (req, res) => {
    try {
        // Fetch all events by this organizer
        const events = await Event.find({ createdBy: req.user._id });
        const eventIds = events.map(e => e._id);
        
        // Fetch all tickets for these events
        const tickets = await Ticket.find({ event: { $in: eventIds } });

        const totalRevenue = tickets.reduce((acc, t) => acc + (t.pricePaid || 0), 0);
        const ticketsSold = tickets.length;
        const scansIn = tickets.filter(t => t.status === 'checked_in' || t.status === 'checked_out').length;

        // Group tickets by event for chart data
        const chartData = events.map(event => {
            const eventTickets = tickets.filter(t => t.event.toString() === event._id.toString());
            return {
                name: event.title.substring(0, 15) + '...',
                sales: eventTickets.reduce((acc, t) => acc + (t.pricePaid || 0), 0),
                attendees: eventTickets.length
            };
        });

        res.json({
            totalEvents: events.length,
            totalRevenue,
            ticketsSold,
            scansIn,
            chartData
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const toggleHype = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const userIdStr = req.user._id.toString();
        const hasHyped = event.hypeUsers.some(id => id.toString() === userIdStr);

        if (hasHyped) {
            event.hypeUsers = event.hypeUsers.filter(id => id.toString() !== userIdStr);
        } else {
            event.hypeUsers.push(req.user._id);
        }

        await event.save();
        res.json({ hyped: !hasHyped, totalHype: event.hypeUsers.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        if (event.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await event.deleteOne();
        res.json({ message: 'Event removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Check authorization
        if (event.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Update fields
        const { title, description, date, location, category, tickets, currency, googleMapsLink, image } = req.body;
        
        if (title) event.title = title;
        if (description) event.description = description;
        if (date) event.date = date;
        if (location) event.location = location;
        if (category) event.category = category;
        if (tickets) event.tickets = tickets;
        if (currency) event.currency = currency;
        if (googleMapsLink !== undefined) event.googleMapsLink = googleMapsLink;
        if (image) event.image = image;

        await event.save();
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
