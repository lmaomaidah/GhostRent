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

// ====================================
// IN-MEMORY DATABASES
// ====================================
const defaultAdminPassword = bcrypt.hashSync('admin123', 10);

const users = [
  // Default admin account for testing
  {
    id: 1,
    firstName: 'Admin',
    lastName: 'Spirit',
    email: 'admin@ghostrent.com',
    password: defaultAdminPassword, // now matches "admin123"
    role: 'admin',
    verified: true,
    createdAt: new Date().toISOString()
  }
];

const hosts = []; // Store host verification requests
const properties = []; // Store property listings
const bookings = []; // Store user bookings

// ====================================
// HELPER FUNCTIONS
// ====================================
const findUserByEmail = (email) => {
  return users.find(user => user.email === email.toLowerCase());
};

const findUserById = (id) => {
  return users.find(user => user.id === id);
};

const findHostByUserId = (userId) => {
  return hosts.find(host => host.userId === userId);
};

const generateId = (array) => {
  return array.length > 0 ? Math.max(...array.map(item => item.id)) + 1 : 1;
};

// ====================================
// AUTHENTICATION MIDDLEWARE
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

// Role-based middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '🚫 You do not have permission to access this spectral realm!'
      });
    }
    next();
  };
};

// ====================================
// US-1: USER REGISTRATION
// ====================================
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password || !role) {
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

    // Role validation
    if (!['user', 'lister'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid role selected!'
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
      id: generateId(users),
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      verified: role === 'user' ? true : false, // Users auto-verified, listers need approval
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // If registering as lister, create pending host entry
    if (role === 'lister') {
      hosts.push({
        id: generateId(hosts),
        userId: newUser.id,
        verified: false,
        properties: [],
        createdAt: new Date().toISOString()
      });
    }

    console.log(`✅ New spirit registered: ${email} (${role})`);

    res.status(201).json({
      success: true,
      message: `🎃 Welcome to the Ghostly Estate, ${firstName}! Your spirit has been summoned.${role === 'lister' ? ' An admin will verify your host status soon.' : ''}`
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
    const user = findUserByEmail(email);
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
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        verified: user.verified
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.cookie('ghostToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    });

    console.log(`✅ Spirit reawakened: ${email}`);

    res.status(200).json({
      success: true,
      message: `🌙 Welcome back, ${user.firstName}! Your spirit has been reawakened.`,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        verified: user.verified
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
// US-3: ROLE-BASED DASHBOARD DATA
// ====================================
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const user = findUserById(req.user.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '👻 Spirit not found!'
    });
  }

  // Base user data
  const dashboardData = {
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      verified: user.verified,
      memberSince: user.createdAt
    }
  };

  // Add role-specific data
  switch (user.role) {
    case 'admin':
      dashboardData.stats = {
        totalUsers: users.filter(u => u.role === 'user').length,
        totalListers: users.filter(u => u.role === 'lister').length,
        pendingHosts: hosts.filter(h => !h.verified).length,
        totalProperties: properties.length,
        totalBookings: bookings.length
      };
      break;

    case 'lister':
      const host = findHostByUserId(user.id);
      dashboardData.hostStatus = {
        verified: host ? host.verified : false,
        properties: properties.filter(p => p.ownerId === user.id),
        totalBookings: bookings.filter(b => 
          properties.some(p => p.id === b.propertyId && p.ownerId === user.id)
        ).length
      };
      break;

    case 'user':
      dashboardData.userActivity = {
        bookings: bookings.filter(b => b.userId === user.id),
        savedProperties: [], // Can be implemented later
        recentlyViewed: [] // Can be implemented later
      };
      break;
  }

  res.status(200).json(dashboardData);
});

// ====================================
// US-4: ADMIN HOST VERIFICATION
// ====================================

// Get all pending hosts (Admin only)
app.get('/api/admin/pending-hosts', authenticateToken, requireRole('admin'), (req, res) => {
  const pendingHosts = hosts
    .filter(host => !host.verified)
    .map(host => {
      const user = findUserById(host.userId);
      return {
        hostId: host.id,
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        registeredAt: user.createdAt
      };
    });

  res.status(200).json({
    success: true,
    pendingHosts
  });
});

// Verify a host (Admin only)
app.post('/api/admin/verify-host/:userId', authenticateToken, requireRole('admin'), (req, res) => {
  const userId = parseInt(req.params.userId);
  
  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '👻 User not found!'
    });
  }

  const host = findHostByUserId(userId);
  if (!host) {
    return res.status(404).json({
      success: false,
      message: '🏚️ Host record not found!'
    });
  }

  if (host.verified) {
    return res.status(400).json({
      success: false,
      message: '✅ This host is already verified!'
    });
  }

  // Verify the host
  host.verified = true;
  user.verified = true;

  console.log(`✅ Admin verified host: ${user.email}`);

  res.status(200).json({
    success: true,
    message: `✅ ${user.firstName} ${user.lastName} has been verified as a trusted host!`
  });
});

// Reject a host (Admin only)
app.post('/api/admin/reject-host/:userId', authenticateToken, requireRole('admin'), (req, res) => {
  const userId = parseInt(req.params.userId);
  
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({
      success: false,
      message: '👻 User not found!'
    });
  }

  const hostIndex = hosts.findIndex(h => h.userId === userId);
  if (hostIndex === -1) {
    return res.status(404).json({
      success: false,
      message: '🏚️ Host record not found!'
    });
  }

  const user = users[userIndex];
  
  // Remove host and user
  hosts.splice(hostIndex, 1);
  users.splice(userIndex, 1);

  console.log(`❌ Admin rejected host: ${user.email}`);

  res.status(200).json({
    success: true,
    message: `❌ Host application for ${user.firstName} ${user.lastName} has been rejected.`
  });
});

// Get all users (Admin only)
app.get('/api/admin/users', authenticateToken, requireRole('admin'), (req, res) => {
  const allUsers = users.map(user => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    verified: user.verified,
    createdAt: user.createdAt
  }));

  res.status(200).json({
    success: true,
    users: allUsers
  });
});

// ====================================
// PROPERTY MANAGEMENT (For Listers)
// ====================================

// Get lister's properties
app.get('/api/lister/properties', authenticateToken, requireRole('lister'), (req, res) => {
  const host = findHostByUserId(req.user.userId);
  
  if (!host.verified) {
    return res.status(403).json({
      success: false,
      message: '⏳ Your host account is pending verification. Please wait for admin approval.'
    });
  }

  const userProperties = properties.filter(p => p.ownerId === req.user.userId);

  res.status(200).json({
    success: true,
    properties: userProperties
  });
});

// Add new property
app.post('/api/lister/properties', authenticateToken, requireRole('lister'), (req, res) => {
  const host = findHostByUserId(req.user.userId);
  
  if (!host.verified) {
    return res.status(403).json({
      success: false,
      message: '⏳ Your host account is pending verification. Please wait for admin approval.'
    });
  }

  const { title, description, location, price, haunting_level } = req.body;

  if (!title || !description || !location || !price) {
    return res.status(400).json({
      success: false,
      message: '❌ All property fields are required!'
    });
  }

  const newProperty = {
    id: generateId(properties),
    ownerId: req.user.userId,
    title,
    description,
    location,
    price: parseFloat(price),
    haunting_level: haunting_level || 'moderate',
    available: true,
    createdAt: new Date().toISOString()
  };

  properties.push(newProperty);
  host.properties.push(newProperty.id);

  console.log(`🏚️ New property added: ${title} by ${req.user.name}`);

  res.status(201).json({
    success: true,
    message: '🏚️ Your haunted property has been listed!',
    property: newProperty
  });
});

// ====================================
// BOOKING MANAGEMENT (For Users)
// ====================================

// Get all available properties
app.get('/api/properties', authenticateToken, (req, res) => {
  const availableProperties = properties
    .filter(p => p.available)
    .map(p => {
      const owner = findUserById(p.ownerId);
      return {
        ...p,
        ownerName: `${owner.firstName} ${owner.lastName}`
      };
    });

  res.status(200).json({
    success: true,
    properties: availableProperties
  });
});

// Create booking
app.post('/api/bookings', authenticateToken, requireRole('user'), (req, res) => {
  const { propertyId, checkIn, checkOut } = req.body;

  if (!propertyId || !checkIn || !checkOut) {
    return res.status(400).json({
      success: false,
      message: '❌ Property ID, check-in and check-out dates are required!'
    });
  }

  const property = properties.find(p => p.id === parseInt(propertyId));
  if (!property) {
    return res.status(404).json({
      success: false,
      message: '👻 Property not found!'
    });
  }

  if (!property.available) {
    return res.status(400).json({
      success: false,
      message: '🚫 This property is not available for booking!'
    });
  }

  const newBooking = {
    id: generateId(bookings),
    userId: req.user.userId,
    propertyId: property.id,
    checkIn,
    checkOut,
    status: 'confirmed',
    totalPrice: property.price,
    createdAt: new Date().toISOString()
  };

  bookings.push(newBooking);

  console.log(`📅 New booking created by ${req.user.name} for property ${property.title}`);

  res.status(201).json({
    success: true,
    message: '🎃 Your haunted stay has been booked!',
    booking: newBooking
  });
});

// Get user bookings
app.get('/api/bookings', authenticateToken, requireRole('user'), (req, res) => {
  const userBookings = bookings
    .filter(b => b.userId === req.user.userId)
    .map(b => {
      const property = properties.find(p => p.id === b.propertyId);
      return {
        ...b,
        propertyTitle: property ? property.title : 'Unknown',
        propertyLocation: property ? property.location : 'Unknown'
      };
    });

  res.status(200).json({
    success: true,
    bookings: userBookings
  });
});

// ====================================
// UTILITY ENDPOINTS
// ====================================

// Check authentication status
app.get('/api/auth/status', authenticateToken, (req, res) => {
  const user = findUserById(req.user.userId);
  
  res.status(200).json({
    success: true,
    authenticated: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      verified: user.verified
    }
  });
});

// Get stats (for debugging)
app.get('/api/stats', authenticateToken, requireRole('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    stats: {
      users: users.length,
      hosts: hosts.length,
      properties: properties.length,
      bookings: bookings.length,
      verifiedHosts: hosts.filter(h => h.verified).length,
      pendingHosts: hosts.filter(h => !h.verified).length
    }
  });
});

// ====================================
// ERROR HANDLING
// ====================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: '⚰️ Something went wrong in the spectral realm!'
  });
});

// ====================================
// SERVER START
// ====================================
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   👻 GhostRent Backend Server 👻      ║
  ║                                       ║
  ║   🌙 Server haunting port ${PORT}        ║
  ║   🎃 Visit: http://localhost:${PORT}     ║
  ║                                       ║
  ║   📊 Current Database Status:         ║
  ║   • Users: ${users.length}                          ║
  ║   • Hosts: ${hosts.length}                          ║
  ║   • Properties: ${properties.length}                     ║
  ║   • Bookings: ${bookings.length}                       ║
  ║                                       ║
  ║   🔐 Default Admin Account:           ║
  ║   Email: admin@ghostrent.com          ║
  ║   Password: admin123                  ║
  ╚═══════════════════════════════════════╝
  `);
});