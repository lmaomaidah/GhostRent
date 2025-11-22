const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-haunted-key-change-this-in-production';

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'uploads', 'properties');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ====================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ====================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/properties/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `property-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed! 👻'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

// ====================================
// MIDDLEWARE
// ====================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// ====================================
// IN-MEMORY DATABASES
// ====================================
const defaultAdminPassword = bcrypt.hashSync('admin123', 10);

const users = [
  {
    id: 1,
    firstName: 'Admin',
    lastName: 'Spirit',
    email: 'admin@ghostrent.com',
    password: defaultAdminPassword,
    role: 'admin',
    verified: true,
    createdAt: new Date().toISOString()
  }
];

const hosts = [];
const properties = [];
const bookings = [];

// Track property views for popularity (US-15)
const propertyViews = {};

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

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: '❌ All fields are required to join the estate!'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '❌ Please provide a valid ghostly email address!'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '❌ Your incantation must be at least 6 characters long!'
      });
    }

    if (!['user', 'lister'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '❌ Invalid role selected!'
      });
    }

    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '👻 This spirit already haunts our estate! Please login instead.'
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = {
      id: generateId(users),
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      verified: role === 'user' ? true : false,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

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

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ Email and password are required to reawaken!'
      });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '👻 No spirit found with this email. Perhaps you need to summon an account first?'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '🔮 Incorrect incantation! Please try again.'
      });
    }

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

    res.cookie('ghostToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
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
        savedProperties: [],
        recentlyViewed: []
      };
      break;
  }

  res.status(200).json(dashboardData);
});

// ====================================
// US-4: ADMIN HOST VERIFICATION
// ====================================
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

  host.verified = true;
  user.verified = true;

  console.log(`✅ Admin verified host: ${user.email}`);

  res.status(200).json({
    success: true,
    message: `✅ ${user.firstName} ${user.lastName} has been verified as a trusted host!`
  });
});

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
  
  hosts.splice(hostIndex, 1);
  users.splice(userIndex, 1);

  console.log(`❌ Admin rejected host: ${user.email}`);

  res.status(200).json({
    success: true,
    message: `❌ Host application for ${user.firstName} ${user.lastName} has been rejected.`
  });
});

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
// US-5: CREATE PROPERTY LISTING
// ====================================
app.post('/api/lister/properties', authenticateToken, requireRole('lister'), (req, res) => {
  const host = findHostByUserId(req.user.userId);
  
  if (!host || !host.verified) {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  properties.push(newProperty);
  host.properties.push(newProperty.id);
  propertyViews[newProperty.id] = 0; // Initialize view count

  console.log(`🏚️ New property added: ${title} by ${req.user.name}`);

  res.status(201).json({
    success: true,
    message: '🏚️ Your haunted property has been listed!',
    property: newProperty
  });
});

// ====================================
// US-6: UPLOAD PROPERTY IMAGES
// ====================================
app.post('/api/lister/properties/:propertyId/images', 
  authenticateToken, 
  requireRole('lister'), 
  upload.single('image'),
  (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    const property = properties.find(p => p.id === propertyId);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: '👻 Property not found!'
      });
    }
    
    if (property.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: '🚫 You can only upload images to your own properties!'
      });
    }
    
    const imagePath = `/uploads/properties/${req.file.filename}`;
    property.image = imagePath;
    property.updatedAt = new Date().toISOString();
    
    console.log(`📸 Image uploaded for property: ${property.title}`);
    
    res.status(200).json({
      success: true,
      message: '📸 Haunted image uploaded successfully!',
      imagePath
    });
  }
);

// ====================================
// US-7: EDIT PROPERTY LISTING
// ====================================
app.put('/api/lister/properties/:propertyId', 
  authenticateToken, 
  requireRole('lister'),
  (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    const property = properties.find(p => p.id === propertyId);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: '👻 Property not found!'
      });
    }
    
    if (property.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: '🚫 You can only edit your own properties!'
      });
    }
    
    const { title, description, location, price, haunting_level, available } = req.body;
    
    if (title) property.title = title;
    if (description) property.description = description;
    if (location) property.location = location;
    if (price) property.price = parseFloat(price);
    if (haunting_level) property.haunting_level = haunting_level;
    if (typeof available !== 'undefined') property.available = available;
    
    property.updatedAt = new Date().toISOString();
    
    console.log(`✏️ Property updated: ${property.title}`);
    
    res.status(200).json({
      success: true,
      message: '✅ Property updated successfully!',
      property
    });
  }
);

// ====================================
// US-8: DELETE PROPERTY LISTING
// ====================================
app.delete('/api/lister/properties/:propertyId', 
  authenticateToken, 
  requireRole('lister'),
  (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    const propertyIndex = properties.findIndex(p => p.id === propertyId);
    
    if (propertyIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '👻 Property not found!'
      });
    }
    
    const property = properties[propertyIndex];
    
    if (property.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: '🚫 You can only delete your own properties!'
      });
    }
    
    // Delete associated image if exists
    if (property.image) {
      const imagePath = path.join(__dirname, property.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    properties.splice(propertyIndex, 1);
    delete propertyViews[propertyId];
    
    console.log(`🗑️ Property deleted: ${property.title}`);
    
    res.status(200).json({
      success: true,
      message: '🗑️ Property deleted successfully!'
    });
  }
);

// ====================================
// US-9: BROWSE ALL PROPERTIES
// ====================================
app.get('/api/properties', authenticateToken, (req, res) => {
  const availableProperties = properties
    .filter(p => p.available)
    .map(p => {
      const owner = findUserById(p.ownerId);
      return {
        ...p,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        views: propertyViews[p.id] || 0
      };
    });

  res.status(200).json({
    success: true,
    properties: availableProperties
  });
});

// ====================================
// US-10: VIEW PROPERTY DETAILS
// ====================================
app.get('/api/properties/:propertyId', authenticateToken, (req, res) => {
  const propertyId = parseInt(req.params.propertyId);
  const property = properties.find(p => p.id === propertyId);
  
  if (!property) {
    return res.status(404).json({
      success: false,
      message: '👻 Property not found!'
    });
  }
  
  // Increment view count for popularity tracking (US-15, US-23)
  if (!propertyViews[propertyId]) {
    propertyViews[propertyId] = 0;
  }
  propertyViews[propertyId]++;
  
  const owner = findUserById(property.ownerId);
  
  res.status(200).json({
    success: true,
    property: {
      ...property,
      ownerName: `${owner.firstName} ${owner.lastName}`,
      views: propertyViews[propertyId]
    }
  });
});

// ====================================
// LISTER: GET OWN PROPERTIES
// ====================================
app.get('/api/lister/properties', authenticateToken, requireRole('lister'), (req, res) => {
  const host = findHostByUserId(req.user.userId);
  
  if (!host || !host.verified) {
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

// ====================================
// US-17: CREATE BOOKING
// ====================================
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

  // Calculate nights and total price
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  
  if (nights <= 0) {
    return res.status(400).json({
      success: false,
      message: '❌ Check-out date must be after check-in date!'
    });
  }

  const newBooking = {
    id: generateId(bookings),
    userId: req.user.userId,
    propertyId: property.id,
    checkIn,
    checkOut,
    nights: nights,
    status: 'confirmed',
    totalPrice: property.price * nights,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  bookings.push(newBooking);

  console.log(`📅 New booking created by ${req.user.name} for property ${property.title}`);

  res.status(201).json({
    success: true,
    message: '🎃 Your haunted stay has been booked!',
    booking: newBooking
  });
});

// ====================================
// US-18: VIEW BOOKING STATUS
// ====================================
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
// US-19: CANCEL BOOKING
// ====================================
app.delete('/api/bookings/:bookingId', 
  authenticateToken, 
  requireRole('user'),
  (req, res) => {
    const bookingId = parseInt(req.params.bookingId);
    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
    
    if (bookingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '👻 Booking not found!'
      });
    }
    
    const booking = bookings[bookingIndex];
    
    if (booking.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: '🚫 You can only cancel your own bookings!'
      });
    }
    
    bookings.splice(bookingIndex, 1);
    
    console.log(`❌ Booking cancelled: ID ${bookingId}`);
    
    res.status(200).json({
      success: true,
      message: '❌ Booking cancelled successfully!'
    });
  }
);

// ====================================
// US-20, US-21, US-22: ADMIN PROPERTY MANAGEMENT
// ====================================
app.get('/api/admin/properties', 
  authenticateToken, 
  requireRole('admin'),
  (req, res) => {
    const allProperties = properties.map(p => {
      const owner = findUserById(p.ownerId);
      return {
        ...p,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        views: propertyViews[p.id] || 0
      };
    });
    
    res.status(200).json({
      success: true,
      properties: allProperties
    });
  }
);

app.put('/api/admin/properties/:propertyId', 
  authenticateToken, 
  requireRole('admin'),
  (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    const property = properties.find(p => p.id === propertyId);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: '👻 Property not found!'
      });
    }
    
    const { title, description, location, price, haunting_level, available } = req.body;
    
    if (title) property.title = title;
    if (description) property.description = description;
    if (location) property.location = location;
    if (price) property.price = parseFloat(price);
    if (haunting_level) property.haunting_level = haunting_level;
    if (typeof available !== 'undefined') property.available = available;
    
    property.updatedAt = new Date().toISOString();
    
    console.log(`✏️ Admin edited property: ${property.title}`);
    
    res.status(200).json({
      success: true,
      message: '✅ Property updated by admin!',
      property
    });
  }
);

app.delete('/api/admin/properties/:propertyId', 
  authenticateToken, 
  requireRole('admin'),
  (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    const propertyIndex = properties.findIndex(p => p.id === propertyId);
    
    if (propertyIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '👻 Property not found!'
      });
    }
    
    const property = properties[propertyIndex];
    
    // Delete associated image if exists
    if (property.image) {
      const imagePath = path.join(__dirname, property.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    properties.splice(propertyIndex, 1);
    delete propertyViews[propertyId];
    
    console.log(`🗑️ Admin deleted property: ${property.title}`);
    
    res.status(200).json({
      success: true,
      message: '🗑️ Property deleted by admin!'
    });
  }
);

// ====================================
// US-24: ADMIN BOOKING OVERSIGHT
// ====================================
app.get('/api/admin/bookings', 
  authenticateToken, 
  requireRole('admin'),
  (req, res) => {
    const allBookings = bookings.map(b => {
      const user = findUserById(b.userId);
      const property = properties.find(p => p.id === b.propertyId);
      return {
        ...b,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        propertyTitle: property ? property.title : 'Unknown',
        propertyLocation: property ? property.location : 'Unknown'
      };
    });
    
    res.status(200).json({
      success: true,
      bookings: allBookings
    });
  }
);

// ====================================
// US-23: MONITOR ACTIVITY (Property Views/Popularity)
// ====================================
app.get('/api/admin/analytics', 
  authenticateToken, 
  requireRole('admin'),
  (req, res) => {
    // Property popularity stats
    const propertyStats = properties.map(p => {
      const owner = findUserById(p.ownerId);
      const bookingCount = bookings.filter(b => b.propertyId === p.id).length;
      return {
        id: p.id,
        title: p.title,
        owner: `${owner.firstName} ${owner.lastName}`,
        views: propertyViews[p.id] || 0,
        bookings: bookingCount,
        price: p.price,
        location: p.location
      };
    }).sort((a, b) => b.views - a.views); // Sort by most viewed

    // User activity stats
    const userStats = users.map(u => {
      if (u.role === 'user') {
        const userBookingCount = bookings.filter(b => b.userId === u.id).length;
        return {
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          role: u.role,
          bookings: userBookingCount,
          joinedAt: u.createdAt
        };
      }
      return null;
    }).filter(Boolean);

    // Lister activity stats
    const listerStats = users.filter(u => u.role === 'lister').map(u => {
      const listerProperties = properties.filter(p => p.ownerId === u.id);
      const totalViews = listerProperties.reduce((sum, p) => sum + (propertyViews[p.id] || 0), 0);
      const totalBookings = bookings.filter(b => 
        listerProperties.some(p => p.id === b.propertyId)
      ).length;
      
      return {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        properties: listerProperties.length,
        totalViews: totalViews,
        totalBookings: totalBookings,
        verified: u.verified
      };
    });

    res.status(200).json({
      success: true,
      analytics: {
        propertyStats,
        userStats,
        listerStats,
        totalViews: Object.values(propertyViews).reduce((sum, views) => sum + views, 0),
        totalBookings: bookings.length,
        totalRevenue: bookings.reduce((sum, b) => sum + b.totalPrice, 0)
      }
    });
  }
);

// ====================================
// UTILITY ENDPOINTS
// ====================================
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

app.get('/api/stats', authenticateToken, requireRole('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    stats: {
      users: users.length,
      hosts: hosts.length,
      properties: properties.length,
      bookings: bookings.length,
      verifiedHosts: hosts.filter(h => h.verified).length,
      pendingHosts: hosts.filter(h => !h.verified).length,
      totalViews: Object.values(propertyViews).reduce((sum, views) => sum + views, 0)
    }
  });
});

// ====================================
// SEARCH & FILTER ENDPOINTS (Enhanced)
// ====================================
app.get('/api/properties/search', authenticateToken, (req, res) => {
  const { 
    query, 
    type, 
    minPrice, 
    maxPrice, 
    location, 
    haunting_level,
    sortBy 
  } = req.query;

  let filtered = properties.filter(p => p.available);

  // Search by query (title, description, location)
  if (query) {
    const searchLower = query.toLowerCase();
    filtered = filtered.filter(p => 
      (p.title || '').toLowerCase().includes(searchLower) ||
      (p.description || '').toLowerCase().includes(searchLower) ||
      (p.location || '').toLowerCase().includes(searchLower)
    );
  }

  // Filter by type (based on title keywords)
  if (type) {
    const typeLower = type.toLowerCase();
    filtered = filtered.filter(p => 
      (p.title || '').toLowerCase().includes(typeLower)
    );
  }

  // Filter by price range
  if (minPrice) {
    filtered = filtered.filter(p => p.price >= parseFloat(minPrice));
  }
  if (maxPrice) {
    filtered = filtered.filter(p => p.price <= parseFloat(maxPrice));
  }

  // Filter by location
  if (location) {
    filtered = filtered.filter(p => 
      (p.location || '').toLowerCase().includes(location.toLowerCase())
    );
  }

  // Filter by haunting level
  if (haunting_level) {
    filtered = filtered.filter(p => p.haunting_level === haunting_level);
  }

  // Add owner names and view counts
  filtered = filtered.map(p => {
    const owner = findUserById(p.ownerId);
    return {
      ...p,
      ownerName: `${owner.firstName} ${owner.lastName}`,
      views: propertyViews[p.id] || 0
    };
  });

  // Sort results
  if (sortBy === 'priceAsc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'priceDesc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === 'popular') {
    filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
  }

  res.status(200).json({
    success: true,
    properties: filtered,
    count: filtered.length
  });
});

// ====================================
// ERROR HANDLING
// ====================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '📸 Image too large! Maximum size is 5MB.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: '⚰️ Something went wrong in the spectral realm!'
  });
});

// ====================================
// 404 HANDLER
// ====================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '👻 This path leads to nowhere in the haunted manor...'
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
  ║                                       ║
  ║   ✅ All User Stories Implemented:    ║
  ║   • US-1 to US-24 ✓                   ║
  ║   • Search & Filter ✓                 ║
  ║   • Analytics & Monitoring ✓          ║
  ║   • Image Upload ✓                    ║
  ╚═══════════════════════════════════════╝
  `);
});