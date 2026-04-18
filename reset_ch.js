import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const resetUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const result = await User.updateMany(
            { $or: [{ name: /ch/i }, { email: /ch/i }] },
            { $set: { role: 'attendee', roleExpiresAt: null } }
        );

        console.log(`Updated ${result.modifiedCount} users.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

resetUser();
