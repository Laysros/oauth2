const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Client = require('../models/Client');
const Code = require('../models/Code');
const User = require('../models/User'); // Need for userinfo check later if expanding

// --- Middleware to check if user is logged in ---
const ensureAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    // Store original URL to redirect back after login
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login');
};

// --- Authorization Endpoint ---
// GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&state=...
router.get('/authorize', ensureAuthenticated, async (req, res) => {
    const { response_type, client_id, redirect_uri, state, scope } = req.query;

    if (response_type !== 'code') {
        return res.status(400).send('Unsupported response type');
    }

    try {
        const client = await Client.findOne({ clientId: client_id });
        if (!client) {
            return res.status(400).send('Invalid client_id');
        }

        if (!client.redirectUris.includes(redirect_uri)) {
            return res.status(400).send('Invalid or unauthorized redirect_uri');
        }

        // --- SCOPE VALIDATION ---
        let requestedScopes = [];
        if (scope) {
            requestedScopes = scope.split(' ');
            // Check if requested scopes are allowed for this client
            const invalidScopes = requestedScopes.filter(s => !client.allowedScopes.includes(s));
            if (invalidScopes.length > 0) {
                return res.status(400).send(`Invalid scope(s): ${invalidScopes.join(', ')}`);
            }
        }
        // ------------------------

        // Render consent page
        // We'll store the validated params in the session or pass them to the view
        // For simplicity, passing to view which will post them back
        // Ideally we should use a session-based transaction ID to prevent tampering

        req.session.oauthParams = { client_id, redirect_uri, state, scope: requestedScopes };



        // Let's refine the render logic to be consistent with auth.js
        // We need to render the consent form inside the layout.
        // Pass requestedScopes to Consent View
        res.render('consent', { client, transactionID: 'session_based', scopes: requestedScopes }, (err, html) => {
            res.render('layout', {
                title: 'Authorize',
                body: html,
                user: { username: req.session.username }
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Authorization Decision ---
router.post('/authorize/decision', ensureAuthenticated, async (req, res) => {
    const { allow } = req.body;
    let { scopes } = req.body; // Get granted scopes from form
    const { client_id, redirect_uri, state } = req.session.oauthParams || {};

    // Normalize scopes to array (if single checkbox checked, it's a string; if multiple, array; if none, undefined)
    if (!scopes) {
        scopes = [];
    } else if (!Array.isArray(scopes)) {
        scopes = [scopes];
    }

    if (!client_id || !redirect_uri) {
        return res.status(400).send('Session expired or invalid request');
    }

    console.log('DEBUG [OAUTH Decision]: Scopes approved by user:', scopes);

    if (allow !== 'true') {
        return res.redirect(`${redirect_uri}?error=access_denied&state=${state}`);
    }

    try {
        // Generate Authorization Code
        const code = crypto.randomBytes(20).toString('hex');

        const newCode = new Code({
            code,
            clientId: client_id,
            userId: req.session.userId,
            redirectUri: redirect_uri,
            scope: scopes, // Persist GRANTED scopes (array)
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        await newCode.save();

        // Redirect back to client with code
        let redirectUrl = `${redirect_uri}?code=${code}`;
        if (state) {
            redirectUrl += `&state=${state}`;
        }

        res.redirect(redirectUrl);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Token Endpoint ---
// POST /oauth/token
router.post('/token', async (req, res) => {
    const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    try {
        // 1. Verify Client
        const client = await Client.findOne({ clientId: client_id, clientSecret: client_secret });
        if (!client) {
            return res.status(401).json({ error: 'invalid_client' });
        }

        // 2. Verify Code
        const authCode = await Code.findOne({ code });
        if (!authCode) {
            return res.status(400).json({ error: 'invalid_grant' });
        }

        // 3. Verify Code details
        if (authCode.clientId !== client_id) {
            return res.status(400).json({ error: 'invalid_grant' });
        }
        if (authCode.redirectUri !== redirect_uri) { // simplified loose check, usually exact match
            return res.status(400).json({ error: 'invalid_grant' });
        }
        if (authCode.expiresAt < new Date()) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired' });
        }

        // 4. Generate Access Token (Standard JWT with Claims)
        const user = await User.findById(authCode.userId); // Fetch user to get current roles

        const payload = {
            user_id: user._id,
            client_id: client_id,
            roles: user.roles, // <--- IAM Logic: Embedding Authorization Data
            scope: authCode.scope // Use actual granted scopes
        };

        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'supersecret',
            { expiresIn: '1h' }
        );

        // Delete used code
        await Code.deleteOne({ _id: authCode._id });

        res.json({
            access_token: token,
            token_type: 'Bearer',
            expires_in: 3600
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server_error' });
    }
});

// --- UserInfo Endpoint ---
// GET /oauth/userinfo
router.get('/userinfo', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
        const user = await User.findById(decoded.user_id);

        if (!user) {
            return res.status(401).json({ error: 'invalid_token' });
        }

        res.json({
            sub: user._id,
            username: user.username,
            // standard claims
        });
    } catch (err) {
        return res.status(401).json({ error: 'invalid_token' });
    }
});

module.exports = router;
