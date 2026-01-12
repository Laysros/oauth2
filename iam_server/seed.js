const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Client = require('./models/Client');
const connectDB = require('./config/db');

const User = require('./models/User'); // Import User model

dotenv.config();

const seed = async () => {
    await connectDB();

    try {
        await Client.deleteMany({});
        await User.deleteMany({}); // Verify this is safe for a test env!

        // Create Admin User
        const adminUser = new User({
            username: 'admin_user',
            password: 'password123', // Will be hashed by pre-save hook
            roles: ['admin', 'manager']
        });
        await adminUser.save();
        console.log('Admin user created');

        // Create Standard User for Sharing Test
        const standardUser = new User({
            username: 'standard_user',
            password: 'password123',
            roles: ['user']
        });
        await standardUser.save();
        console.log('Standard user created');

        // Create User A
        const userA = new User({
            username: 'a',
            password: 'a',
            roles: ['user']
        });
        await userA.save();
        console.log('User "a" created (password: a)');

        // Create User B
        const userB = new User({
            username: 'b',
            password: 'b',
            roles: ['user']
        });
        await userB.save();
        console.log('User "b" created (password: b)');

        const client = new Client({
            clientId: 'demo-client-id',
            clientSecret: 'demo-client-secret',
            name: 'Demo App',
            redirectUris: ['http://localhost:3001/callback', 'https://oauth.tools/callback/code'], // Port 3001 for Client App
            grants: ['authorization_code'],
            allowedScopes: ['files:read', 'files:write', 'profile:read']
        });

        await client.save();
        console.log('Client seeded successfully');

        // Seed Files for Admin
        const File = require('./models/File');
        await File.deleteMany({});

        // Share this secret file with standard_user
        await new File({
            name: 'admin_secrets.txt',
            owner: adminUser._id,
            type: 'text/plain',
            content: 'Top Secret - Shared with you',
            sharedWith: [standardUser._id]
        }).save();

        await new File({ name: 'system_log.log', owner: adminUser._id, type: 'text/plain' }).save();
        console.log('Admin files seeded');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();
