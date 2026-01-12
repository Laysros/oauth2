const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register Page
// Register Page
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register', user: null, error: null }, (err, html) => {
        if (err) return res.send(err);
        res.render('layout', { title: 'Register', body: html, user: null });
    });
});

// Register Handle
router.post('/register', async (req, res) => {
    const { username, password, confirmPassword } = req.body;
    let errors = [];

    if (!username || !password || !confirmPassword) {
        errors.push({ msg: 'Please enter all fields' });
    }

    if (password !== confirmPassword) {
        errors.push({ msg: 'Passwords do not match' });
    }

    if (errors.length > 0) {
        // Render register view with error
        return res.render('register', { title: 'Register', user: null, error: errors[0].msg }, (err, html) => {
            if (err) return res.send(err);
            res.render('layout', { title: 'Register', body: html, user: null });
        });
    }

    try {
        let user = await User.findOne({ username });
        if (user) {
            return res.render('register', { title: 'Register', user: null, error: 'User already exists' }, (err, html) => {
                if (err) return res.send(err);
                res.render('layout', { title: 'Register', body: html, user: null });
            });
        }

        user = new User({
            username,
            password
        });

        await user.save();
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Login Page
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login', user: null, error: req.query.error, redirect: req.query.redirect }, (err, html) => {
        if (err) return res.send(err);
        res.render('layout', { title: 'Login', body: html, user: null });
    });
});

// Login Handle
router.post('/login', async (req, res) => {
    const { username, password, redirect } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.redirect('/auth/login?error=Invalid credentials');
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.redirect('/auth/login?error=Invalid credentials');
        }

        // Set session
        req.session.userId = user._id;
        req.session.username = user.username;

        const returnTo = req.session.returnTo;
        delete req.session.returnTo;

        if (redirect) {
            return res.redirect(redirect);
        }
        if (returnTo) {
            return res.redirect(returnTo);
        }
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Logout Handle
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect('/auth/login');
    });
});

module.exports = router;
