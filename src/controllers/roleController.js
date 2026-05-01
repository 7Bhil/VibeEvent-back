import RoleUpgradeRequest from '../models/RoleUpgradeRequest.js';
import User from '../models/User.js';

export const requestUpgrade = async (req, res) => {
    try {
        const { plan, message } = req.body; // 'events_only', 'polls_only', 'premium'
        const userId = req.user._id;

        if (!['events_only', 'polls_only', 'premium'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan selected' });
        }

        // Check if there is already a pending request
        const existingRequest = await RoleUpgradeRequest.findOne({ user: userId, status: 'pending' });
        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending request.' });
        }

        // Create a pending request
        const request = await RoleUpgradeRequest.create({
            user: userId,
            plan: plan,
            status: 'pending',
            message: message || 'Subscription upgrade request'
        });

        res.status(201).json({ 
            message: 'Your upgrade request has been submitted and is pending administrator approval.', 
            request 
        });
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
            
            const updateData = { 
                role: 'organizer',
                plan: request.plan // Important: set the plan!
            };

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
