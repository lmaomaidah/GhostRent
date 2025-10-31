const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-haunted-key-change-this-in-production';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, images)

// In-memory database (replace with real database later)
const users = [];

// Helper function to find user by email
const findUserByEmail = (email) => {
  return users.find(user => user.email === email);
};

// ====================================
// US-1: USER REGISTRATION
// ====================================
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ All fields are required to join the estate!'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '❌ Please provide a valid ghostly email address!'
      });
    }

    // Password strength check
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '❌ Your incantation must be at least 6 characters long!'
      });
    }

    // Check if user already exists
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '👻 This spirit already haunts our estate! Please login instead.'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = {
      id: users.length + 1,
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    console.log(`✅ New spirit registered: ${email}`);

    res.status(201).json({
      success: true,
      message: `🎃 Welcome to the Ghostly Estate, ${firstName}! Your spirit has been summoned.`
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: '⚰️ The spirits are restless. Please try again later.'
    });
  }
});

// ====================================
// US-2: LOGIN AUTHENTICATION
// ====================================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ Email and password are required to reawaken!'
      });
    }

    // Find user
    const user = findUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '👻 No spirit found with this email. Perhaps you need to summon an account first?'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '🔮 Incorrect incantation! Please try again.'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: `${user.firstName} ${user.lastName}`
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.cookie('ghostToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    });

    console.log(`✅ Spirit reawakened: ${email}`);

    res.status(200).json({
      success: true,
      message: `🌙 Welcome back, ${user.firstName}! Your spirit has been reawakened.`,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '⚰️ The spirits are restless. Please try again later.'
    });
  }
});

// ====================================
// MIDDLEWARE: Verify JWT Token
// ====================================
const authenticateToken = (req, res, next) => {
  const token = req.cookies.ghostToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '👻 You must be logged in to access the haunted manor!'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: '⚰️ Your session has expired. Please reawaken your spirit.'
    });
  }
};

// ====================================
// LOGOUT
// ====================================
app.post('/api/logout', (req, res) => {
  res.clearCookie('ghostToken');
  res.status(200).json({
    success: true,
    message: '👋 Your spirit has departed. Until next time...'
  });
});

// ====================================
// PROTECTED ROUTE EXAMPLE (Dashboard)
// ====================================
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '👻 Spirit not found!'
    });
  }

  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      memberSince: user.createdAt
    }
  });
});

// ====================================
// SERVER START
// ====================================
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   👻 GhostRent Backend Server 👻    ║
  ║                                       ║
  ║   🌙 Server haunting port ${PORT}     ║
  ║   🎃 Visit: http://localhost:${PORT}   ║
  ║                                       ║
  ║   Registered Spirits: ${users.length}              ║
  ╚═══════════════════════════════════════╝
  `);
});