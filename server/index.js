require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/auth/login', (req, res) => res.send('OAuth not yet wired'));
app.get('/auth/callback', (req, res) => res.send('Callback not yet wired'));
app.get('/auth/logout', (req, res) => res.redirect('/'));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
