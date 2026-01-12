const express = require('express');
const router = express.Router();
const { verifyToken, checkScope } = require('../middleware/auth');

// GET /api/me - Debug endpoint to see token details
router.get('/me', verifyToken, (req, res) => {
    res.json({
        user: req.user,
        message: 'Token checks out. Here is your payload.'
    });
});

// GET /api/files - Requires 'files:read' scope
router.get('/files', verifyToken, checkScope('files:read'), async (req, res) => {
    // Note: The try/catch block below handles the logic


    try {
        const File = require('../models/File');

        // STRICT FILTERING: Find files owned by this user OR shared with this user
        console.log('DEBUG [GET /files]: Querying files for User ID:', req.user.user_id);

        let userFiles = await File.find({
            $or: [
                { owner: req.user.user_id },
                { sharedWith: req.user.user_id }
            ]
        }).populate('sharedWith', 'username');

        console.log(`DEBUG [GET /files]: Found ${userFiles.length} files.`);

        // AUTO-GENERATE: If user has NO files, generate some defaults for testing
        if (userFiles.length === 0) {
            const defaultFiles = [
                { name: 'Welcome_Doc.txt', type: 'text/plain', content: 'Welcome to your secure file storage! This file was auto-generated.', owner: req.user.user_id },
                { name: `Random_Notes_${Math.floor(Math.random() * 1000)}.txt`, type: 'text/plain', content: `Some random content: ${Math.random().toString(36).substring(7)}`, owner: req.user.user_id },
                { name: 'Project_Alpha.pdf', type: 'application/pdf', content: 'Mock PDF Content', owner: req.user.user_id }
            ];

            userFiles = await File.insertMany(defaultFiles);
        }

        res.json({
            message: 'Access granted to YOUR files (from Database)',
            user_id: req.user.user_id,
            count: userFiles.length,
            files: userFiles
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/files - Requires 'files:write' scope
router.post('/files', verifyToken, checkScope('files:write'), async (req, res) => {
    try {
        const File = require('../models/File');

        // Create new file, strictly assigning owner to current user
        const newFile = new File({
            name: req.body.name || 'uploaded_file.txt',
            type: req.body.type || 'text/plain',
            owner: req.user.user_id, // <--- Ownership forced by system
            content: req.body.content || 'New content'
        });

        await newFile.save();

        res.json({
            message: 'File created successfully',
            file: newFile
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// POST /api/files/:id/share - Share a file with another user
router.post('/files/:id/share', verifyToken, checkScope('files:write'), async (req, res) => {
    try {
        const { username } = req.body;
        const fileId = req.params.id;

        if (!username) {
            return res.status(400).json({ error: 'Target username is required' });
        }

        const File = require('../models/File');
        const User = require('../models/User');

        // 1. Find the file
        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // 2. SECURITY CHECK: Ensure I am the owner
        if (file.owner.toString() !== req.user.user_id) {
            return res.status(403).json({ error: 'You do not have permission to share this file' });
        }

        // 3. Find the target user
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // 4. Update the ACL
        // $addToSet ensures no duplicates
        file.sharedWith.addToSet(targetUser._id);
        await file.save();

        res.json({
            message: `File shared with ${username}`,
            file: file
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/files/:id/revoke - Revoke access from a user
router.post('/files/:id/revoke', verifyToken, checkScope('files:write'), async (req, res) => {
    try {
        const { username } = req.body;
        const fileId = req.params.id;

        if (!username) {
            return res.status(400).json({ error: 'Target username is required' });
        }

        const File = require('../models/File');
        const User = require('../models/User');

        // 1. Find the file
        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // 2. SECURITY CHECK: Ensure I am the owner
        if (file.owner.toString() !== req.user.user_id) {
            return res.status(403).json({ error: 'You do not have permission to modify this file' });
        }

        // 3. Find the target user
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // 4. Update the ACL
        // $pull removes the item from array
        file.sharedWith.pull(targetUser._id);
        await file.save();

        res.json({
            message: `Access revoked for ${username}`,
            file: file
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/files/:id - Delete a file
router.delete('/files/:id', verifyToken, checkScope('files:write'), async (req, res) => {
    try {
        const fileId = req.params.id;
        const File = require('../models/File');

        // 1. Find the file
        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // 2. SECURITY CHECK: Ensure I am the owner
        if (file.owner.toString() !== req.user.user_id) {
            return res.status(403).json({ error: 'You do not have permission to delete this file' });
        }

        // 3. Delete the file
        await File.deleteOne({ _id: fileId });

        res.json({
            message: 'File deleted successfully',
            fileId: fileId
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
