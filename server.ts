import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("parking.db");
const JWT_SECRET = "parking-secret-key-123";

// Force reset database for new schema if needed
const tableInfo = db.prepare("PRAGMA table_info(customers)").all() as any[];
if (tableInfo.length === 0) {
  db.exec(`
    DROP TABLE IF EXISTS bookings;
    DROP TABLE IF EXISTS slots;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS admins;
  `);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT,
    location TEXT,
    tier TEXT CHECK(tier IN ('gold', 'silver', 'bronze')),
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'booked', 'occupied')),
    UNIQUE(label, location)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    slot_id INTEGER,
    vehicle_number TEXT,
    vehicle_type TEXT,
    start_time TEXT,
    duration INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES customers(id),
    FOREIGN KEY(slot_id) REFERENCES slots(id)
  );
`);

// Seed slots if empty
const slotCount = db.prepare("SELECT COUNT(*) as count FROM slots").get() as { count: number };
if (slotCount.count === 0) {
  const locations = ["Trichy LA Cinema", "Trichy Bus Stand", "Trichy Railway Station"];
  const tiers: ('gold' | 'silver' | 'bronze')[] = ['gold', 'silver', 'bronze'];
  const insertSlot = db.prepare("INSERT INTO slots (label, location, tier, status) VALUES (?, ?, ?, ?)");

  locations.forEach(loc => {
    tiers.forEach(tier => {
      const count = tier === 'gold' ? 4 : tier === 'silver' ? 6 : 8;
      for (let i = 1; i <= count; i++) {
        const label = `${tier[0].toUpperCase()}-${i.toString().padStart(2, '0')}`;
        // Randomly fill some slots
        const status = Math.random() > 0.7 ? 'booked' : 'available';
        insertSlot.run(label, loc, tier, status);
      }
    });
  });
}

// Seed admin if empty
const adminCount = db.prepare("SELECT COUNT(*) as count FROM admins").get() as { count: number };
if (adminCount.count === 0) {
  db.prepare("INSERT INTO admins (email, password) VALUES (?, ?)").run("manish@gmail.com", "2005");
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.use(express.json());

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // API Routes
  app.post("/api/auth/register", (req, res) => {
    const { email, password, role = 'customer' } = req.body;
    
    if (role === 'admin') {
      return res.status(403).json({ error: "Admin registration is not allowed" });
    }

    try {
      const info = db.prepare("INSERT INTO customers (email, password) VALUES (?, ?)").run(email, password);
      const token = jwt.sign({ id: info.lastInsertRowid, email, role: 'customer' }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, email, role: 'customer' } });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password, role = 'customer' } = req.body;
    
    let user;
    if (role === 'admin') {
      // Strict check for Manish
      if (email !== 'manish@gmail.com' || password !== '2005') {
        return res.status(401).json({ error: "Invalid in-charger credentials" });
      }
      user = db.prepare("SELECT * FROM admins WHERE email = ? AND password = ?").get(email, password) as any;
    } else {
      user = db.prepare("SELECT * FROM customers WHERE email = ? AND password = ?").get(email, password) as any;
    }

    if (user) {
      const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email, role } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/slots", (req, res) => {
    const { location } = req.query;
    let slots;
    if (location) {
      slots = db.prepare("SELECT * FROM slots WHERE location = ?").all(location);
    } else {
      slots = db.prepare("SELECT * FROM slots").all();
    }
    res.json(slots);
  });

  app.post("/api/bookings", authenticateToken, (req: any, res) => {
    const { slotId, vehicleNumber, vehicleType, startTime, duration } = req.body;

    // Check if vehicle already has an overlapping active booking
    const existingBookings = db.prepare("SELECT * FROM bookings WHERE vehicle_number = ? AND status = 'active'").all(vehicleNumber) as any[];
    
    const requestedStart = new Date(startTime).getTime();
    const requestedEnd = requestedStart + (duration * 60 * 60 * 1000);

    const hasOverlap = existingBookings.some(booking => {
      const existingStart = new Date(booking.start_time).getTime();
      const existingEnd = existingStart + (booking.duration * 60 * 60 * 1000);
      return requestedStart < existingEnd && existingStart < requestedEnd;
    });

    if (hasOverlap) {
      return res.status(400).json({ error: "already the vechile is registred" });
    }

    const bookingId = `BK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const transaction = db.transaction(() => {
      db.prepare("INSERT INTO bookings (id, user_id, slot_id, vehicle_number, vehicle_type, start_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(bookingId, req.user.id, slotId, vehicleNumber, vehicleType, startTime, duration);
      db.prepare("UPDATE slots SET status = 'booked' WHERE id = ?").run(slotId);
    });

    try {
      transaction();
      // Broadcast update
      const updatedSlot = db.prepare("SELECT * FROM slots WHERE id = ?").get(slotId);
      broadcast({ type: 'SLOT_UPDATE', slot: updatedSlot });
      res.json({ bookingId });
    } catch (e) {
      res.status(500).json({ error: "Booking failed" });
    }
  });

  app.get("/api/bookings/my", authenticateToken, (req: any, res) => {
    const bookings = db.prepare(`
      SELECT b.*, s.label as slot_label, s.location, s.tier
      FROM bookings b 
      JOIN slots s ON b.slot_id = s.id 
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);
    res.json(bookings);
  });

  app.get("/api/admin/bookings", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const bookings = db.prepare(`
      SELECT b.*, s.label as slot_label, s.location, s.tier, u.email as user_email
      FROM bookings b 
      JOIN slots s ON b.slot_id = s.id 
      JOIN customers u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `).all();
    res.json(bookings);
  });

  app.post("/api/admin/slots/:id/status", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { status } = req.body;
    db.prepare("UPDATE slots SET status = ? WHERE id = ?").run(status, req.params.id);
    
    // Broadcast update
    const updatedSlot = db.prepare("SELECT * FROM slots WHERE id = ?").get(req.params.id);
    broadcast({ type: 'SLOT_UPDATE', slot: updatedSlot });
    
    res.json({ success: true });
  });

  app.post("/api/admin/verify-ticket", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { bookingId } = req.body;

    const booking = db.prepare(`
      SELECT b.*, s.label as slot_label, s.location, s.tier, u.email as user_email, s.status as slot_status
      FROM bookings b 
      JOIN slots s ON b.slot_id = s.id 
      JOIN customers u ON b.user_id = u.id
      WHERE b.id = ?
    `).get(bookingId) as any;

    if (!booking) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({ error: "Ticket is already completed or cancelled" });
    }

    // If slot is booked, mark as occupied
    if (booking.slot_status === 'booked') {
      db.prepare("UPDATE slots SET status = 'occupied' WHERE id = ?").run(booking.slot_id);
      
      // Broadcast update
      const updatedSlot = db.prepare("SELECT * FROM slots WHERE id = ?").get(booking.slot_id);
      broadcast({ type: 'SLOT_UPDATE', slot: updatedSlot });
    }

    res.json(booking);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
