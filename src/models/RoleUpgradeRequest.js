import mongoose from 'mongoose';

const roleUpgradeRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    plan: {
        type: String,
        enum: ['events_only', 'polls_only', 'premium'],
        required: true,
        default: 'premium'
    },
    message: {
        type: String,
        trim: true
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const RoleUpgradeRequest = mongoose.model('RoleUpgradeRequest', roleUpgradeRequestSchema);
export default RoleUpgradeRequest;
