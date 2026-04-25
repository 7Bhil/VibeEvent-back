import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Nightlife', 'Concert', 'Festival', 'Workshop', 'Sport', 'Other'],
        default: 'Other'
    },
    tickets: [{
        tier: {
            type: String,
            enum: ['Standard', 'VIP', 'Early Bird', 'Premium'],
            required: true
        },
        price: {
            type: Number,
            required: true,
            default: 0
        },
        limit: {
            type: Number, // Si null ou undefined = illimité
        }
    }],
    currency: {
        type: String,
        default: 'EUR'
    },
    googleMapsLink: {
        type: String
    },
    image: {
        type: String,
        default: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80'
    },
    hypeUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'cancelled'],
        default: 'published'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Event = mongoose.model('Event', eventSchema);
export default Event;
