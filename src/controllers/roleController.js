import RoleUpgradeRequest from '../models/RoleUpgradeRequest.js';
import User from '../models/User.js';

export const requestUpgrade = async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user._id;

        const existingRequest = await RoleUpgradeRequest.findOne({ user: userId, status: 'pending' });
        if (existingRequest) {
            return res.status(400).json({ message: 'A request is already pending' });
        }

        const request = await RoleUpgradeRequest.create({
            user: userId,
            message
        });

        res.status(201).json(request);
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
        const { requestId, action } = req.body; // action: 'approve' or 'reject'
        const request = await RoleUpgradeRequest.findById(requestId);

        if (!request) return res.status(404).json({ message: 'Request not found' });

        if (action === 'approve') {
            request.status = 'approved';
            await User.findByIdAndUpdate(request.user, { role: 'organizer' });
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
