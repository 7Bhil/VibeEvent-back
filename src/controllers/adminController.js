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

export const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.role = role;
        // Reset expiry if they are updated manually
        if (role !== 'organizer') {
             user.roleExpiresAt = null;
        }
        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.status = user.status === 'blocked' ? 'active' : 'blocked';
        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
