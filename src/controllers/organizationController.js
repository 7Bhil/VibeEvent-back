import Organization from '../models/Organization.js';
import User from '../models/User.js';

export const createOrganization = async (req, res) => {
    try {
        const { name } = req.body;
        const ownerId = req.user._id;

        const organization = await Organization.create({
            name,
            owner: ownerId,
            members: [ownerId]
        });

        // Update user's organization and role
        await User.findByIdAndUpdate(ownerId, { 
            organization: organization._id,
            role: 'organizer' 
        });

        res.status(201).json(organization);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const addMember = async (req, res) => {
    try {
        const { organizationId, userEmail } = req.body;
        const organization = await Organization.findById(organizationId);

        if (!organization) return res.status(404).json({ message: 'Organization not found' });
        
        // Check if requester is owner
        if (organization.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the owner can add members' });
        }

        const newUser = await User.findOne({ email: userEmail });
        if (!newUser) return res.status(404).json({ message: 'User not found' });

        if (organization.members.includes(newUser._id)) {
            return res.status(400).json({ message: 'User already a member' });
        }

        organization.members.push(newUser._id);
        await organization.save();

        // Update user
        newUser.organization = organization._id;
        await newUser.save();

        res.json({ message: 'Member added successfully', organization });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const dissolveOrganization = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const organization = await Organization.findById(organizationId);

        if (!organization) return res.status(404).json({ message: 'Organization not found' });
        
        if (organization.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the owner can dissolve the organization' });
        }

        organization.isDissolved = true;
        await organization.save();

        // Optionally remove organization from all members
        await User.updateMany(
            { organization: organizationId },
            { $unset: { organization: "" } }
        );

        res.json({ message: 'Organization dissolved successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
