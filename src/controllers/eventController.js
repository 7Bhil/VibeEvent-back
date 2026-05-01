import Event from '../models/Event.js';
import Organization from '../models/Organization.js';

export const createEvent = async (req, res) => {
    try {
        const { title, description, startAt, endAt, date, location, category, tickets, currency, googleMapsLink, image } = req.body;
        
        // Find user's organization
        const organization = await Organization.findOne({ owner: req.user._id });
        if (!organization) {
            return res.status(403).json({ message: "You must own an organization to create an event." });
        }

        // Backward compatibility: accept legacy "date" as both start/end
        const normalizedStartAt = startAt || date;
        const normalizedEndAt = endAt || date;

        if (!normalizedStartAt || !normalizedEndAt) {
            return res.status(400).json({ message: 'startAt and endAt are required' });
        }

        if (new Date(normalizedEndAt) < new Date(normalizedStartAt)) {
            return res.status(400).json({ message: 'endAt must be after startAt' });
        }

        const event = await Event.create({
            title,
            description,
            date: normalizedStartAt,
            startAt: normalizedStartAt,
            endAt: normalizedEndAt,
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
        const parseDateParam = (value) => {
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const rangeFrom = parseDateParam(req.query.from);
        const rangeTo = parseDateParam(req.query.to);
        const groupBy = req.query.groupBy === 'day' || req.query.groupBy === 'month' ? req.query.groupBy : 'day';

        // Fetch all events by this organizer
        const events = await Event.find({ createdBy: req.user._id });
        const eventIds = events.map(e => e._id);
        
        // Fetch all tickets for these events (optionally filtered by purchase date)
        const ticketQuery = { event: { $in: eventIds } };
        if (rangeFrom || rangeTo) {
            ticketQuery.createdAt = {};
            if (rangeFrom) ticketQuery.createdAt.$gte = rangeFrom;
            if (rangeTo) ticketQuery.createdAt.$lte = rangeTo;
        }

        const tickets = await Ticket.find(ticketQuery);

        const totalRevenue = tickets.reduce((acc, t) => acc + (t.pricePaid || 0), 0);
        const ticketsSold = tickets.length;

        // Scans IN count within range (based on scan logs, not current status)
        const scansMatch = {
            event: { $in: eventIds },
            'scans.action': 'in'
        };
        if (rangeFrom || rangeTo) {
            scansMatch['scans.timestamp'] = {};
            if (rangeFrom) scansMatch['scans.timestamp'].$gte = rangeFrom;
            if (rangeTo) scansMatch['scans.timestamp'].$lte = rangeTo;
        }

        const scansInAgg = await Ticket.aggregate([
            { $match: { event: { $in: eventIds } } },
            { $unwind: '$scans' },
            { $match: scansMatch },
            { $count: 'count' }
        ]);
        const scansIn = scansInAgg?.[0]?.count || 0;

        // Group tickets by event for chart data
        const chartData = events.map(event => {
            const eventTickets = tickets.filter(t => t.event.toString() === event._id.toString());
            return {
                name: event.title.substring(0, 15) + '...',
                sales: eventTickets.reduce((acc, t) => acc + (t.pricePaid || 0), 0),
                attendees: eventTickets.length
            };
        });

        // Time series for revenue + tickets
        const dateFormat =
            groupBy === 'month'
                ? { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
                : { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

        const timeSeries = await Ticket.aggregate([
            { $match: ticketQuery },
            {
                $group: {
                    _id: dateFormat,
                    revenue: { $sum: { $ifNull: ['$pricePaid', 0] } },
                    ticketsSold: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            totalEvents: events.length,
            totalRevenue,
            ticketsSold,
            scansIn,
            chartData,
            timeSeries,
            range: {
                from: rangeFrom ? rangeFrom.toISOString() : null,
                to: rangeTo ? rangeTo.toISOString() : null,
                groupBy
            }
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
        const { title, description, startAt, endAt, date, location, category, tickets, currency, googleMapsLink, image } = req.body;
        
        if (title) event.title = title;
        if (description) event.description = description;
        // Backward compatibility: if "date" is sent, treat it as start/end
        if (date) {
            event.startAt = date;
            event.endAt = date;
            event.date = date;
        }
        if (startAt) event.startAt = startAt;
        if (endAt) event.endAt = endAt;
        if (startAt || endAt) {
            // Keep legacy date aligned to startAt for older clients
            event.date = event.startAt;
        }
        if (location) event.location = location;
        if (category) event.category = category;
        if (tickets) event.tickets = tickets;
        if (currency) event.currency = currency;
        if (googleMapsLink !== undefined) event.googleMapsLink = googleMapsLink;
        if (image) event.image = image;

        if (!event.startAt || !event.endAt) {
            return res.status(400).json({ message: 'startAt and endAt are required' });
        }
        if (new Date(event.endAt) < new Date(event.startAt)) {
            return res.status(400).json({ message: 'endAt must be after startAt' });
        }

        await event.save();
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
