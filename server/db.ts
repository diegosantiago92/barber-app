import { eq, and, ne, asc, desc, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  barbershops, InsertBarbershop,
  barbershopMembers, InsertBarbershopMember,
  services, InsertService,
  workingHours, InsertWorkingHour,
  blockedDates, InsertBlockedDate,
  appointments, InsertAppointment,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
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
    else if (user.openId === ENV.ownerOpenId) { values.role = "superadmin"; updateSet.role = "superadmin"; }
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

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function setUserRole(userId: number, role: "user" | "admin" | "superadmin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Barbershops ──────────────────────────────────────────────────────────────

export async function createBarbershop(data: Omit<InsertBarbershop, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check slug uniqueness
  const existing = await db.select().from(barbershops).where(eq(barbershops.slug, data.slug)).limit(1);
  if (existing.length > 0) throw new Error("Este identificador (slug) já está em uso");
  const result = await db.insert(barbershops).values(data);
  const id = result[0].insertId;
  // Add owner as member with role 'owner'
  await db.insert(barbershopMembers).values({ barbershopId: id, userId: data.ownerId, role: "owner" });
  return id;
}

export async function getBarbershopById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbershops).where(eq(barbershops.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBarbershopBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbershops).where(eq(barbershops.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllBarbershops() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(barbershops).orderBy(desc(barbershops.createdAt));
}

export async function getActiveBarbershops() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(barbershops)
    .where(and(eq(barbershops.active, true), ne(barbershops.subscriptionStatus, "blocked")))
    .orderBy(asc(barbershops.name));
}

export async function updateBarbershop(id: number, data: Partial<InsertBarbershop>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(barbershops).set(data).where(eq(barbershops.id, id));
}

export async function setBarbershopSubscription(
  id: number,
  status: "active" | "blocked" | "trial",
  expiresAt?: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(barbershops).set({
    subscriptionStatus: status,
    subscriptionExpiresAt: expiresAt ?? null,
  }).where(eq(barbershops.id, id));
}

// ─── Barbershop Members ───────────────────────────────────────────────────────

export async function getUserBarbershops(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: barbershops.id,
    name: barbershops.name,
    slug: barbershops.slug,
    description: barbershops.description,
    address: barbershops.address,
    phone: barbershops.phone,
    logoUrl: barbershops.logoUrl,
    subscriptionStatus: barbershops.subscriptionStatus,
    subscriptionExpiresAt: barbershops.subscriptionExpiresAt,
    active: barbershops.active,
    ownerId: barbershops.ownerId,
    createdAt: barbershops.createdAt,
    updatedAt: barbershops.updatedAt,
    memberRole: barbershopMembers.role,
  }).from(barbershopMembers)
    .innerJoin(barbershops, eq(barbershopMembers.barbershopId, barbershops.id))
    .where(eq(barbershopMembers.userId, userId))
    .orderBy(asc(barbershops.name));
}

export async function getMemberRole(barbershopId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbershopMembers)
    .where(and(eq(barbershopMembers.barbershopId, barbershopId), eq(barbershopMembers.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0].role : undefined;
}

export async function addMember(data: Omit<InsertBarbershopMember, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if already a member
  const existing = await db.select().from(barbershopMembers)
    .where(and(eq(barbershopMembers.barbershopId, data.barbershopId), eq(barbershopMembers.userId, data.userId)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(barbershopMembers).set({ role: data.role })
      .where(and(eq(barbershopMembers.barbershopId, data.barbershopId), eq(barbershopMembers.userId, data.userId)));
  } else {
    await db.insert(barbershopMembers).values(data);
  }
}

export async function getBarbershopMembers(barbershopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: barbershopMembers.id,
    userId: barbershopMembers.userId,
    role: barbershopMembers.role,
    createdAt: barbershopMembers.createdAt,
    name: users.name,
    email: users.email,
    phone: users.phone,
  }).from(barbershopMembers)
    .innerJoin(users, eq(barbershopMembers.userId, users.id))
    .where(eq(barbershopMembers.barbershopId, barbershopId))
    .orderBy(asc(barbershopMembers.role));
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getActiveServices(barbershopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services)
    .where(and(eq(services.barbershopId, barbershopId), eq(services.active, true)))
    .orderBy(asc(services.name));
}

export async function getAllServices(barbershopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services)
    .where(eq(services.barbershopId, barbershopId))
    .orderBy(asc(services.name));
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

export async function getWorkingHours(barbershopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workingHours)
    .where(eq(workingHours.barbershopId, barbershopId))
    .orderBy(asc(workingHours.dayOfWeek));
}

export async function upsertWorkingHour(data: Omit<InsertWorkingHour, "id" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(workingHours)
    .where(and(eq(workingHours.barbershopId, data.barbershopId), eq(workingHours.dayOfWeek, data.dayOfWeek)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(workingHours)
      .set({ startTime: data.startTime, endTime: data.endTime, intervalMinutes: data.intervalMinutes, isOpen: data.isOpen })
      .where(and(eq(workingHours.barbershopId, data.barbershopId), eq(workingHours.dayOfWeek, data.dayOfWeek)));
  } else {
    await db.insert(workingHours).values(data);
  }
}

// ─── Blocked Dates ─────────────────────────────────────────────────────────────

export async function getBlockedDates(barbershopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blockedDates)
    .where(eq(blockedDates.barbershopId, barbershopId))
    .orderBy(asc(blockedDates.date));
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
  const existing = await db.select().from(appointments)
    .where(and(
      eq(appointments.barbershopId, data.barbershopId),
      eq(appointments.date, data.date),
      eq(appointments.time, data.time),
      ne(appointments.status, "cancelled")
    )).limit(1);
  if (existing.length > 0) throw new Error("Este horário já está reservado");
  const result = await db.insert(appointments).values(data);
  return result[0].insertId;
}

export async function getUserAppointments(userId: number, barbershopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appointments.id, userId: appointments.userId, serviceId: appointments.serviceId,
    barbershopId: appointments.barbershopId,
    date: appointments.date, time: appointments.time, status: appointments.status,
    notificationSent: appointments.notificationSent, createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt, serviceName: services.name,
    serviceDuration: services.durationMinutes, servicePrice: services.priceDisplay,
  }).from(appointments).leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.userId, userId), eq(appointments.barbershopId, barbershopId)))
    .orderBy(desc(appointments.date), desc(appointments.time));
}

export async function getAppointmentsByDate(barbershopId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appointments.id, userId: appointments.userId, serviceId: appointments.serviceId,
    barbershopId: appointments.barbershopId,
    date: appointments.date, time: appointments.time, status: appointments.status,
    notificationSent: appointments.notificationSent, createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt, serviceName: services.name,
    serviceDuration: services.durationMinutes, servicePrice: services.priceDisplay,
    clientName: users.name, clientEmail: users.email, clientPhone: users.phone,
  }).from(appointments).leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(users, eq(appointments.userId, users.id))
    .where(and(eq(appointments.barbershopId, barbershopId), eq(appointments.date, date)))
    .orderBy(asc(appointments.time));
}

export async function getBookedSlots(barbershopId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ time: appointments.time }).from(appointments)
    .where(and(
      eq(appointments.barbershopId, barbershopId),
      eq(appointments.date, date),
      ne(appointments.status, "cancelled")
    ));
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

export async function getAllAppointmentsForBarbershop(barbershopId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appointments.id, userId: appointments.userId, serviceId: appointments.serviceId,
    barbershopId: appointments.barbershopId,
    date: appointments.date, time: appointments.time, status: appointments.status,
    notificationSent: appointments.notificationSent, createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt, serviceName: services.name,
    serviceDuration: services.durationMinutes, clientName: users.name, clientEmail: users.email,
  }).from(appointments).leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(users, eq(appointments.userId, users.id))
    .where(eq(appointments.barbershopId, barbershopId))
    .orderBy(desc(appointments.date), desc(appointments.time));
}

// Super-admin: all appointments across all barbershops
export async function getAllAppointments() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appointments.id, userId: appointments.userId, serviceId: appointments.serviceId,
    barbershopId: appointments.barbershopId,
    date: appointments.date, time: appointments.time, status: appointments.status,
    createdAt: appointments.createdAt, serviceName: services.name,
    clientName: users.name, barbershopName: barbershops.name,
  }).from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(users, eq(appointments.userId, users.id))
    .leftJoin(barbershops, eq(appointments.barbershopId, barbershops.id))
    .orderBy(desc(appointments.createdAt));
}

// ─── Super-Admin helpers ──────────────────────────────────────────────────────

export async function getUserByEmailForAdmin(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllBarbershopsWithStats() {
  const db = await getDb();
  if (!db) return [];

  const shops = await db.select().from(barbershops).orderBy(desc(barbershops.createdAt));

  const results = await Promise.all(
    shops.map(async (shop) => {
      const memberRows = await db!
        .select({ count: barbershopMembers.id })
        .from(barbershopMembers)
        .where(eq(barbershopMembers.barbershopId, shop.id));

      const apptRows = await db!
        .select({ count: appointments.id })
        .from(appointments)
        .where(eq(appointments.barbershopId, shop.id));

      // Get owner email
      let ownerEmail: string | null = null;
      if (shop.ownerId) {
        const ownerRows = await db!
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, shop.ownerId))
          .limit(1);
        ownerEmail = ownerRows.length > 0 ? ownerRows[0].email : null;
      }

      return {
        ...shop,
        memberCount: memberRows.length,
        appointmentCount: apptRows.length,
        ownerEmail,
      };
    })
  );

  return results;
}

export async function deleteBarbershopById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete in order to respect foreign key constraints
  await db.delete(appointments).where(eq(appointments.barbershopId, id));
  await db.delete(services).where(eq(services.barbershopId, id));
  await db.delete(workingHours).where(eq(workingHours.barbershopId, id));
  await db.delete(blockedDates).where(eq(blockedDates.barbershopId, id));
  await db.delete(barbershopMembers).where(eq(barbershopMembers.barbershopId, id));
  await db.delete(barbershops).where(eq(barbershops.id, id));
}
