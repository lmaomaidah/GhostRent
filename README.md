# GhostRent — Haunted House Rental Platform

> *"Book it if you dare."*

GhostRent is a full-stack web application that lets users browse, list, and book haunted properties. Built as a Software Engineering course project by a team of three, the platform features role-based access for regular users, property listers, and administrators — all wrapped in a spooky gothic aesthetic.

---

## Features

### For Users (Seekers)
- Register and log in to a personalized account
- Browse haunted property listings
- Book properties with check-in/check-out dates
- View booking history and status from a personal dashboard

### For Property Listers (Keepers)
- List and manage haunted properties
- Upload property images and details
- Track bookings made on their listings

### For Admins
- Full user management (view, delete, assign roles)
- Approve or reject property lister (host) applications
- Monitor all bookings across the platform
- Access analytics dashboard with platform-wide stats

### General
- JWT-based authentication with secure cookies
- Password hashing with bcrypt
- Email notifications via Nodemailer
- Responsive UI with ghost-themed animations and floating dust particles

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Auth | JSON Web Tokens (JWT), bcrypt |
| File Uploads | Multer |
| Email | Nodemailer |
| Dev Tools | Nodemon |

---

## Project Structure

```
GhostRent/
├── index.html                    # Registration page
├── loginpage.html                # Login page
├── dashboard.html                # Landing dashboard (role redirect)
├── dashboard-user.html           # User dashboard
├── dashboard-propertylister.html # Property lister dashboard
├── dashboard-admin.html          # Admin dashboard
├── admin-analytics.html          # Analytics panel
├── booking.html                  # Property booking page
├── contact.html                  # Contact page
├── dashboard.css                 # Shared dashboard styles
├── server.js                     # Express backend entry point
└── package.json
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/GhostRent.git
cd GhostRent

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will be available at `http://localhost:3000` (or whichever port your server.js specifies).

### Production

```bash
npm start
```

---

## License

This project was developed for educational purposes as part of a Software Engineering course. All rights reserved by the team.
