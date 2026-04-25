import mongoose from 'mongoose';

const PollSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: false
    },
    question: {
        type: String,
        required: true
    },
    description: String,
    options: [{
        text: { type: String, required: true },
        votes: { type: Number, default: 0 }
    }],
    voters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    expiresAt: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

export default mongoose.model('Poll', PollSchema);
