import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
    event: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Event', 
        required: true 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    tier: { 
        type: String, 
        enum: ['Standard', 'VIP', 'Early Bird', 'Premium'], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['active', 'checked_in', 'checked_out', 'cancelled'], 
        default: 'active' 
    },
    pricePaid: {
        type: Number,
        default: 0
    },
    scans: [{
        action: { 
            type: String, 
            enum: ['in', 'out'] 
        },
        timestamp: { 
            type: Date, 
            default: Date.now 
        },
        scannedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        }
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
