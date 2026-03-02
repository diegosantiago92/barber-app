import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  time,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // superadmin = dono da plataforma; admin = legado (não usado); user = cliente
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Barbershops (Multi-tenant) ───────────────────────────────────────────────

export const barbershops = mysqlTable("barbershops", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  address: varchar("address", { length: 500 }),
  phone: varchar("phone", { length: 20 }),
  logoUrl: varchar("logoUrl", { length: 500 }),
  // active = visível; blocked = admin bloqueado pelo super-admin; trial = período de teste
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "blocked", "trial"])
    .default("trial")
    .notNull(),
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
  ownerId: int("ownerId").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Barbershop = typeof barbershops.$inferSelect;
export type InsertBarbershop = typeof barbershops.$inferInsert;

// ─── Barbershop Members ───────────────────────────────────────────────────────
// Relaciona usuários a barbearias com papel específico

export const barbershopMembers = mysqlTable("barbershop_members", {
  id: int("id").autoincrement().primaryKey(),
  barbershopId: int("barbershopId").notNull(),
  userId: int("userId").notNull(),
  // owner = criador da barbearia; admin = barbeiro adicional; client = cliente
  role: mysqlEnum("role", ["owner", "admin", "client"]).default("client").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BarbershopMember = typeof barbershopMembers.$inferSelect;
export type InsertBarbershopMember = typeof barbershopMembers.$inferInsert;

// ─── Services ─────────────────────────────────────────────────────────────────

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  barbershopId: int("barbershopId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  durationMinutes: int("durationMinutes").notNull().default(30),
  priceDisplay: varchar("priceDisplay", { length: 50 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// ─── Working Hours ─────────────────────────────────────────────────────────────

export const workingHours = mysqlTable("working_hours", {
  id: int("id").autoincrement().primaryKey(),
  barbershopId: int("barbershopId").notNull(),
  dayOfWeek: int("dayOfWeek").notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime").notNull(),
  intervalMinutes: int("intervalMinutes").notNull().default(30),
  isOpen: boolean("isOpen").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkingHour = typeof workingHours.$inferSelect;
export type InsertWorkingHour = typeof workingHours.$inferInsert;

// ─── Blocked Dates ─────────────────────────────────────────────────────────────

export const blockedDates = mysqlTable("blocked_dates", {
  id: int("id").autoincrement().primaryKey(),
  barbershopId: int("barbershopId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BlockedDate = typeof blockedDates.$inferSelect;
export type InsertBlockedDate = typeof blockedDates.$inferInsert;

// ─── Appointments ──────────────────────────────────────────────────────────────

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  barbershopId: int("barbershopId").notNull(),
  userId: int("userId").notNull(),
  serviceId: int("serviceId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  time: time("time").notNull(),
  status: mysqlEnum("status", ["confirmed", "cancelled", "completed"])
    .default("confirmed")
    .notNull(),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
