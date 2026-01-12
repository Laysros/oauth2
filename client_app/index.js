const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const IAM_URL = process.env.IAM_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.CLIENT_ID || 'demo-client-id';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'demo-client-secret';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const MongoStore = require('connect-mongo').default;

app.use(session({
    name: 'client_sid', // Unique name to avoid localhost conflict
    secret: process.env.SESSION_SECRET || 'client-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/client_app_db',
        collectionName: 'client_sessions'
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 Week
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Home Page (Client App)
app.get('/', (req, res) => {
    if (req.session.accessToken) {
        return res.redirect('/dashboard');
    }
    res.send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h1>My Photo Editor App (Port 3001)</h1>
            <p>This is a 3rd Party App. It needs access to your files on the IAM System.</p>
            <div style="margin-top: 20px;">
            <div style="margin-top: 20px;">
                <a href="${IAM_URL}/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=http://localhost:3001/callback&scope=files:read+files:write+profile:read&state=xyz" 
                   style="display: inline-block; background: #6610f2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 1.2em;">
                   Connect with IAM System
                </a>
            </div>
            <div style="margin-top: 20px;">
                <a href="${IAM_URL}" target="_blank" style="color: #666; text-decoration: underline;">
                    Go to IAM System (Port 3000) ↗
                </a>
            </div>
        </div>
    `);
});

// Callback Route (Handles Redirect from IAM)
app.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) return res.send('Error: No code returned from IAM');

    try {
        console.log(`Received Code: ${code}. Exchanging for Token...`);

        // Exchange Code for Token (Server-to-Server request to IAM)
        const tokenResponse = await fetch(`${IAM_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'http://localhost:3001/callback', // MUST match what we sent in /authorize
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return res.send(`<h2>Error exchanging token</h2><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
        }

        // Store Token
        req.session.accessToken = tokenData.access_token;
        res.redirect('/dashboard');

    } catch (err) {
        console.error(err);
        res.send('Internal Server Error during Token Exchange');
    }
});

// Dashboard (Protected by Client App Session)
app.get('/dashboard', async (req, res) => {
    if (!req.session.accessToken) return res.redirect('/');

    try {
        // Fetch User Info from IAM
        const userRes = await fetch(`${IAM_URL}/oauth/userinfo`, {
            headers: { 'Authorization': `Bearer ${req.session.accessToken}` }
        });
        const userData = await userRes.json();

        let error = null;

        // Fetch Files from IAM
        const filesRes = await fetch(`${IAM_URL}/api/files`, {
            headers: { 'Authorization': `Bearer ${req.session.accessToken}` }
        });
        const filesData = await filesRes.json();

        if (filesRes.status !== 200) {
            console.error('Files API Error:', filesRes.status, filesData);
            error = `Files API Error: ${filesRes.status} - ${filesData.error || 'Unknown Error'}`;
        }

        // Fetch Debug Info
        const debugRes = await fetch(`${IAM_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${req.session.accessToken}` }
        });
        const debugData = await debugRes.json();

        // Render the View (we reuse the existing dashboard.ejs for convenience)
        // In a real world, this app would have its own completely different UI.
        res.render('dashboard', {
            user: userData,
            files: filesData.files || [],
            accessToken: req.session.accessToken,
            debugInfo: debugData,
            error: error
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        // If error (e.g. IAM down, Token Invalid), clear session so user can try again
        req.session.destroy(() => {
            res.send(`
                <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                    <h1>Connection Error</h1>
                    <p>Could not fetch data from IAM System.</p>
                    <p>Details: ${err.message}</p>
                    <a href="/" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Try Again</a>
                </div>
            `);
        });
    }
});

// Proxy for creating files (Client App -> IAM API)
app.post('/api/files', async (req, res) => {
    if (!req.session.accessToken) return res.status(401).json({ error: 'Unauthorized' });

    // Forward request to IAM
    const response = await fetch(`${IAM_URL}/api/files`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${req.session.accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
});

// Proxy for sharing files (Client App -> IAM API)
app.post('/api/files/:id/share', async (req, res) => {
    if (!req.session.accessToken) return res.status(401).json({ error: 'Unauthorized' });

    const response = await fetch(`${IAM_URL}/api/files/${req.params.id}/share`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${req.session.accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
});

// Proxy for revoking file access (Client App -> IAM API)
app.post('/api/files/:id/revoke', async (req, res) => {
    if (!req.session.accessToken) return res.status(401).json({ error: 'Unauthorized' });

    const response = await fetch(`${IAM_URL}/api/files/${req.params.id}/revoke`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${req.session.accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
});

// Proxy for deleting files (Client App -> IAM API)
app.delete('/api/files/:id', async (req, res) => {
    if (!req.session.accessToken) return res.status(401).json({ error: 'Unauthorized' });

    const response = await fetch(`${IAM_URL}/api/files/${req.params.id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${req.session.accessToken}`
        }
    });

    const data = await response.json();
    res.status(response.status).json(data);
});

// Logout Route (Clears Client Session)
app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(PORT, () => console.log(`Client App running on http://localhost:${PORT}`));
