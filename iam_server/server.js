const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');

const cors = require('cors'); // Import CORS

dotenv.config();

connectDB();

const app = express();

// Middleware
app.use(cors()); // Enable CORS for ALL routes (Simulating public API)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const MongoStore = require('connect-mongo').default;

app.use(session({
    name: 'iam_sid', // Unique name to avoid localhost conflict
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/oauth2' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 Week
}));

app.set('view engine', 'ejs');

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/oauth', require('./routes/oauth'));
app.use('/api', require('./routes/api'));

app.get('/', (req, res) => {
    // UX Refactor: Conditional Landing Page
    const user = req.session.userId ? { username: req.session.username } : null;

    let content = '';

    if (!user) {
        // Guest View
        content = `
            <div style="text-align: center; margin-top: 50px;">
                <h1>Secure Cloud Storage</h1>
                <p style="font-size: 1.2em; color: #666;">Enterprise-grade file management with OAuth2 Security.</p>
                <div style="margin-top: 30px;">
                    <a href="/auth/login" style="padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login</a>
                    <a href="/auth/register" style="padding: 15px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">Get Started</a>
                </div>
            </div>
        `;
    } else {
        // Logged In View
        content = `
            <div style="text-align: center; margin-top: 50px;">
                <h1>Welcome back, ${user.username}!</h1>
                <p>Your secure vault is ready.</p>
                
                <div style="margin-top: 30px; padding: 20px; border: 1px solid #eee; display: inline-block; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <h3>Identity Provider Dashboard</h3>
                    <p>You are logged in.</p>
                    <a href="http://localhost:3001" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #17a2b8; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">
                        Open Client App (Port 3001) ↗
                    </a>
                </div>
            </div>
        `;
    }

    res.render('layout', {
        title: 'Home',
        body: content,
        user: user
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
