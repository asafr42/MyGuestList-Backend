const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Guest = require('./models/Guest');
const User = require('./models/User');
const authMiddleware = require('./middleware/auth');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'myguestlist-secret-key';

// If we are not running tests, connect to the real DB and start listening
if (process.env.NODE_ENV !== 'test') {
    mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myguestlist', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => console.log('MongoDB Connected'))
        .catch(err => console.error(err));

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ error: 'Email already registered.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, email: user.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password.' });

        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, email: user.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GUEST ROUTES (protected) ─────────────────────────────────────────────────

// GET /api/guests/stats - MUST be before /:id to avoid conflict
app.get('/api/guests/stats', authMiddleware, async (req, res) => {
    try {
        const guests = await Guest.find({ userId: req.user.id });
        const stats = {
            totalInvited: guests.reduce((sum, g) => sum + g.invitedCount, 0),
            totalConfirmed: guests.reduce((sum, g) => sum + g.confirmedCount, 0)
        };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/guests
app.get('/api/guests', authMiddleware, async (req, res) => {
    try {
        const guests = await Guest.find({ userId: req.user.id });
        res.json(guests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/guests
app.post('/api/guests', authMiddleware, async (req, res) => {
    try {
        const newGuest = new Guest({ ...req.body, userId: req.user.id });
        const savedGuest = await newGuest.save();
        res.status(201).json(savedGuest);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/guests/:id
app.put('/api/guests/:id', authMiddleware, async (req, res) => {
    try {
        const updatedGuest = await Guest.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true }
        );
        if (!updatedGuest) return res.status(404).json({ error: 'Guest not found.' });
        res.json(updatedGuest);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/guests/:id
app.delete('/api/guests/:id', authMiddleware, async (req, res) => {
    try {
        const deletedGuest = await Guest.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deletedGuest) return res.status(404).json({ error: 'Guest not found.' });
        res.json({ message: 'Guest deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/guests/:id
app.get('/api/guests/:id', authMiddleware, async (req, res) => {
    try {
        const guest = await Guest.findOne({ _id: req.params.id, userId: req.user.id });
        if (!guest) return res.status(404).json({ error: 'Guest not found' });
        res.json(guest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;
