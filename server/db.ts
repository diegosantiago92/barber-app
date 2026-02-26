import { eq, and, ne, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  services,
  workingHours,
  blockedDates,
  appointments,
  InsertService,
  InsertWorkingHour,
  InsertBlockedDate,
  InsertAppointment,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "phone"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as any)[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { name?: string; phone?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getActiveServices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.name));
}

export async function getAllServices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services).orderBy(asc(services.name));
}

export async function getServiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createService(data: Omit<InsertService, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(services).values(data);
  return result[0].insertId;
}

export async function updateService(id: number, data: Partial<InsertService>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set(data).where(eq(services.id, id));
}

export async function deleteService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set({ active: false }).where(eq(services.id, id));
}

// ─── Working Hours ─────────────────────────────────────────────────────────────

export async function getWorkingHours() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workingHours).orderBy(asc(workingHours.dayOfWeek));
}

export async function upsertWorkingHour(data: Omit<InsertWorkingHour, "id" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(workingHours).where(eq(workingHours.dayOfWeek, data.dayOfWeek)).limit(1);
  if (existing.length > 0) {
    await db.update(workingHours).set({ startTime: data.startTime, endTime: data.endTime, intervalMinutes: data.intervalMinutes, isOpen: data.isOpen }).where(eq(workingHours.dayOfWeek, data.dayOfWeek));
  } else {
    await db.insert(workingHours).values(data);
  }
}

// ─── Blocked Dates ─────────────────────────────────────────────────────────────

export async function getBlockedDates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blockedDates).orderBy(asc(blockedDates.date));
}

export async function addBlockedDate(data: Omit<InsertBlockedDate, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(blockedDates).values(data);
}

export async function removeBlockedDate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blockedDates).where(eq(blockedDates.id, id));
}

// ─── Appointments ──────────────────────────────────────────────────────────────

export async function createAppointment(data: Omit<InsertAppointment, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(appointments).where(and(eq(appointments.date, data.date), eq(appointments.time, data.time), ne(appointments.status, "cancelled"))).limit(1);
  if (existing.length > 0) throw new Error("Este horário já está reservado");
  const result = await db.insert(appointments).values(data);
  return result[0].insertId;
}

export async function getUserAppointments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appointments.id, userId: appointments.userId, serviceId: appointments.serviceId,
    date: appointments.date, time: appointments.time, status: appointments.status,
    notificationSent: appointments.notificationSent, createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt, serviceName: services.name,
    serviceDuration: services.durationMinutes, servicePrice: services.priceDisplay,
  }).from(appointments).leftJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(appointments.userId, userId)).orderBy(desc(appointments.date), desc(appointments.time));
}

export async function getAppointmentsByDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appointments.id, userId: appointments.userId, serviceId: appointments.serviceId,
    date: appointments.date, time: appointments.time, status: appointments.status,
    notificationSent: appointments.notificationSent, createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt, serviceName: services.name,
    serviceDuration: services.durationMinutes, servicePrice: services.priceDisplay,
    clientName: users.name, clientEmail: users.email, clientPhone: users.phone,
  }).from(appointments).leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(users, eq(appointments.userId, users.id))
    .where(eq(appointments.date, date)).orderBy(asc(appointments.time));
}

export async function getBookedSlots(date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ time: appointments.time }).from(appointments)
    .where(and(eq(appointments.date, date), ne(appointments.status, "cancelled")));
}

export async function cancelAppointment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, id));
}

export async function completeAppointment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, id));
}

export async function getAppointmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllAppointments() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appointments.id, userId: appointments.userId, serviceId: appointments.serviceId,
    date: appointments.date, time: appointments.time, status: appointments.status,
    notificationSent: appointments.notificationSent, createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt, serviceName: services.name,
    serviceDuration: services.durationMinutes, clientName: users.name, clientEmail: users.email,
  }).from(appointments).leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(users, eq(appointments.userId, users.id))
    .orderBy(desc(appointments.date), desc(appointments.time));
}
