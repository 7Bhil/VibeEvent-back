import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['attendee', 'organizer', 'admin'],
        default: 'attendee'
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    },
    roleExpiresAt: {
        type: Date,
        default: null
    },
    plan: {
        type: String,
        enum: ['none', 'events_only', 'polls_only', 'premium'],
        default: 'none'
    },
    status: {
        type: String,
        enum: ['active', 'blocked'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

// Middleware to hash password before saving
userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});


// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
