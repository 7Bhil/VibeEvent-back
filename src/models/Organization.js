import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    events: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    }],
    isDissolved: {
        type: Boolean,
        default: false
    },
    dissolvingAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
