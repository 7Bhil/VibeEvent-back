import RoleUpgradeRequest from '../models/RoleUpgradeRequest.js';
import User from '../models/User.js';

export const requestUpgrade = async (req, res) => {
    try {
        const { plan } = req.body; // 'events_only', 'polls_only', 'premium'
        const userId = req.user._id;

        if (!['events_only', 'polls_only', 'premium'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan selected' });
        }

        // Apply simulated subscription upgrade
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // 30 days subscription

        const updateData = { 
            role: 'organizer', 
            plan: plan, 
            roleExpiresAt: expiryDate 
        };

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');

        // Log the transaction
        await RoleUpgradeRequest.create({
            user: userId,
            plan: plan,
            status: 'approved',
            message: 'Simulated Subscription Purchase'
        });

        res.status(200).json({ message: 'Subscription activated', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPendingRequests = async (req, res) => {
    try {
        const requests = await RoleUpgradeRequest.find({ status: 'pending' }).populate('user', 'name email');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const handleRequest = async (req, res) => {
    try {
        const { requestId, action, durationDays } = req.body; // action: 'approve' or 'reject', durationDays: number
        const request = await RoleUpgradeRequest.findById(requestId);

        if (!request) return res.status(404).json({ message: 'Request not found' });

        if (action === 'approve') {
            request.status = 'approved';
            
            const updateData = { role: 'organizer' };
            if (durationDays) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + parseInt(durationDays));
                updateData.roleExpiresAt = expiryDate;
            } else {
                updateData.roleExpiresAt = null; // Permanent if not specified
            }

            await User.findByIdAndUpdate(request.user, updateData);
        } else {
            request.status = 'rejected';
        }

        request.reviewedBy = req.user._id;
        await request.save();

        res.json({ message: `Request ${action}d successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
