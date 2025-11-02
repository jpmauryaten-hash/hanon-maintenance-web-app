import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users, type User } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";

const PgStore = connectPgSimple(session);

// Configure passport local strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        return done(null, false, { message: "Invalid username or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return done(null, false, { message: "Invalid username or password" });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

// Serialize user to session
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as User).id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});

export function setupAuth(app: Express) {
  // Session configuration with PostgreSQL store
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "breakdown-tracker-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: new PgStore({
        conObject: {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === "production",
        },
        tableName: "session",
        createTableIfMissing: true,
      }),
      cookie: {
        secure: false, // Set to true only if you have HTTPS
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

// Middleware to check user role
export function hasRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = req.user as User;
    const allowedRoles = roles.map((role) => role.toLowerCase());
    const userRole = (user.role || "").toLowerCase();

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    res.status(403).json({ error: "Forbidden: Insufficient permissions" });
  };
}

export { passport };
