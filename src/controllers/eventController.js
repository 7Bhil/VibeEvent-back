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
