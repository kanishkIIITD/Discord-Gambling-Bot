const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, requireSuperAdmin, requireGuildId } = require('../middleware/auth');

// Apply requireGuildId to all routes
router.use(requireGuildId);

// PATCH /api/admin/users/:id/role
// Body: { role: 'user' | 'admin' | 'superadmin' }
// Only superadmin can access
router.patch('/users/:id/role', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }
    const user = await User.findOne({ _id: req.params.id, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    user.role = role;
    await user.save();
    // Exclude sensitive fields
    const { password, ...userObj } = user.toObject();
    res.json({ message: `User role updated to ${role}.`, user: userObj });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating user role.', error: error.message });
  }
});

module.exports = router; 