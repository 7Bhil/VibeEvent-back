import User from '../models/User.js';
import Organization from '../models/Organization.js';
import RoleUpgradeRequest from '../models/RoleUpgradeRequest.js';

export const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrganizations = await Organization.countDocuments();
        const pendingRequests = await RoleUpgradeRequest.countDocuments({ status: 'pending' });

        res.json({
            totalUsers,
            totalOrganizations,
            pendingRequests
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllOrganizations = async (req, res) => {
    try {
        const organizations = await Organization.find().populate('owner', 'name email').sort({ createdAt: -1 });
        res.json(organizations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
