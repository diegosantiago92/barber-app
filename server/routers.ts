import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

// ─── Helper: ensure user is admin/owner of a barbershop ──────────────────────

async function ensureBarbershopAdmin(userId: number, barbershopId: number) {
  const role = await db.getMemberRole(barbershopId, userId);
  if (!role || (role !== "owner" && role !== "admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao administrador da barbearia" });
  }
  const shop = await db.getBarbershopById(barbershopId);
  if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Barbearia não encontrada" });
  if (shop.subscriptionStatus === "blocked") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso bloqueado. Entre em contato com o suporte." });
  }
  return shop;
}

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ─────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  profile: router({
    update: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100).optional(), phone: z.string().max(20).optional() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Barbershops (multi-tenant) ───────────────────────────────────────────
  barbershops: router({
    // Public: list active barbershops for client selection
    list: publicProcedure.query(async () => db.getActiveBarbershops()),

    // Public: get by slug
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const shop = await db.getBarbershopBySlug(input.slug);
        if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Barbearia não encontrada" });
        if (shop.subscriptionStatus === "blocked") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Esta barbearia está temporariamente indisponível" });
        }
        return shop;
      }),

    // Authenticated: barbershops the logged user belongs to
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return db.getUserBarbershops(ctx.user.id);
    }),

    // Authenticated: create a new barbershop (user becomes owner)
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(255),
        slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
        description: z.string().max(500).optional(),
        address: z.string().max(500).optional(),
        phone: z.string().max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const id = await db.createBarbershop({ ...input, ownerId: ctx.user.id, subscriptionStatus: "trial" });
        return { id };
      }),

    // Admin: update barbershop info
    update: protectedProcedure
      .input(z.object({
        barbershopId: z.number(),
        name: z.string().min(2).max(255).optional(),
        description: z.string().max(500).optional(),
        address: z.string().max(500).optional(),
        phone: z.string().max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        const { barbershopId, ...data } = input;
        await db.updateBarbershop(barbershopId, data);
        return { success: true };
      }),

    // Admin: get members
    members: protectedProcedure
      .input(z.object({ barbershopId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        return db.getBarbershopMembers(input.barbershopId);
      }),

    // Super-admin: list ALL barbershops
    adminList: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user || ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getAllBarbershops();
    }),

    // Super-admin: set subscription status (active/blocked/trial)
    setSubscription: protectedProcedure
      .input(z.object({
        barbershopId: z.number(),
        status: z.enum(["active", "blocked", "trial"]),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
        const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
        await db.setBarbershopSubscription(input.barbershopId, input.status, expiresAt);
        return { success: true };
      }),

    // Super-admin: create barbershop on behalf of a client (by email)
    adminCreate: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(255),
        slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
        description: z.string().max(500).optional(),
        address: z.string().max(500).optional(),
        phone: z.string().max(20).optional(),
        ownerEmail: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
        const allUsers = await db.getAllUsers();
        const owner = allUsers.find((u) => u.email === input.ownerEmail);
        if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário com este e-mail não encontrado. O barbeiro deve fazer login no app primeiro." });
        const { ownerEmail, ...shopData } = input;
        const id = await db.createBarbershop({ ...shopData, ownerId: owner.id, subscriptionStatus: "trial" });
        return { id };
      }),

    // Super-admin: list all users
    adminUsers: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user || ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getAllUsers();
    }),

    // Super-admin: set user role
    setUserRole: protectedProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "superadmin"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.setUserRole(input.userId, input.role);
        return { success: true };
      }),

    // Super-admin: all appointments across platform
    adminAllAppointments: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user || ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getAllAppointments();
    }),
  }),

  // ─── Services ─────────────────────────────────────────────────────────────
  services: router({
    list: protectedProcedure
      .input(z.object({ barbershopId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) return db.getActiveServices(input.barbershopId);
        const role = await db.getMemberRole(input.barbershopId, ctx.user.id);
        if (role === "owner" || role === "admin") return db.getAllServices(input.barbershopId);
        return db.getActiveServices(input.barbershopId);
      }),

    listPublic: publicProcedure
      .input(z.object({ barbershopId: z.number() }))
      .query(async ({ input }) => db.getActiveServices(input.barbershopId)),

    create: protectedProcedure
      .input(z.object({
        barbershopId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().max(500).optional(),
        durationMinutes: z.number().min(5).max(480).default(30),
        priceDisplay: z.string().max(50).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        const id = await db.createService(input);
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        barbershopId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(500).optional(),
        durationMinutes: z.number().min(5).max(480).optional(),
        priceDisplay: z.string().max(50).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        const { id, barbershopId, ...data } = input;
        await db.updateService(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number(), barbershopId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        await db.deleteService(input.id);
        return { success: true };
      }),
  }),

  // ─── Working Hours & Blocked Dates ────────────────────────────────────────
  workingHours: router({
    list: publicProcedure
      .input(z.object({ barbershopId: z.number() }))
      .query(async ({ input }) => db.getWorkingHours(input.barbershopId)),

    upsert: protectedProcedure
      .input(z.object({
        barbershopId: z.number(),
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        intervalMinutes: z.number().min(5).max(120),
        isOpen: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        await db.upsertWorkingHour(input);
        return { success: true };
      }),
  }),

  blockedDates: router({
    list: publicProcedure
      .input(z.object({ barbershopId: z.number() }))
      .query(async ({ input }) => db.getBlockedDates(input.barbershopId)),

    add: protectedProcedure
      .input(z.object({ barbershopId: z.number(), date: z.string(), reason: z.string().max(255).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        await db.addBlockedDate(input);
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number(), barbershopId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        await db.removeBlockedDate(input.id);
        return { success: true };
      }),
  }),

  // ─── Appointments ─────────────────────────────────────────────────────────
  appointments: router({
    availableSlots: publicProcedure
      .input(z.object({ barbershopId: z.number(), date: z.string() }))
      .query(async ({ input }) => {
        const { barbershopId, date } = input;
        const today = new Date().toISOString().split("T")[0];
        if (date < today) return [];

        const [y, m, d] = date.split("-").map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const hours = await db.getWorkingHours(barbershopId);
        const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
        if (!dayHours || !dayHours.isOpen) return [];

        const blocked = await db.getBlockedDates(barbershopId);
        if (blocked.some((b) => b.date === date)) return [];

        const booked = await db.getBookedSlots(barbershopId, date);
        const bookedSet = new Set(booked.map((b) => String(b.time).substring(0, 5)));

        const slots: string[] = [];
        const [sh, sm] = String(dayHours.startTime).split(":").map(Number);
        const [eh, em] = String(dayHours.endTime).split(":").map(Number);
        let cur = sh * 60 + sm;
        const end = eh * 60 + em;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        while (cur < end) {
          const h = Math.floor(cur / 60);
          const min = cur % 60;
          const timeStr = `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
          const isToday = date === today;
          const isPast = isToday && cur <= nowMinutes;
          if (!bookedSet.has(timeStr) && !isPast) slots.push(timeStr);
          cur += dayHours.intervalMinutes;
        }
        return slots;
      }),

    create: protectedProcedure
      .input(z.object({ barbershopId: z.number(), serviceId: z.number(), date: z.string(), time: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const shop = await db.getBarbershopById(input.barbershopId);
        if (!shop || shop.subscriptionStatus === "blocked") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Esta barbearia está temporariamente indisponível" });
        }
        const today = new Date().toISOString().split("T")[0];
        if (input.date < today) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível agendar em datas passadas" });
        if (input.date === today) {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const [h, m] = input.time.split(":").map(Number);
          if (h * 60 + m <= nowMinutes) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível agendar em horários passados" });
        }
        const id = await db.createAppointment({
          barbershopId: input.barbershopId,
          userId: ctx.user.id,
          serviceId: input.serviceId,
          date: input.date,
          time: input.time,
          status: "confirmed",
          notificationSent: false,
        });
        try {
          const service = await db.getServiceById(input.serviceId);
          await notifyOwner({ title: "Novo Agendamento 💈", content: `${ctx.user.name || "Cliente"} agendou ${service?.name || "serviço"} em ${shop.name} para ${input.date} às ${input.time}.` });
        } catch (e) { console.warn("[Notification] Failed:", e); }
        return { id };
      }),

    mine: protectedProcedure
      .input(z.object({ barbershopId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return db.getUserAppointments(ctx.user.id, input.barbershopId);
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number(), barbershopId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const appt = await db.getAppointmentById(input.id);
        if (!appt) throw new TRPCError({ code: "NOT_FOUND" });
        const role = await db.getMemberRole(input.barbershopId, ctx.user.id);
        if (appt.userId !== ctx.user.id && role !== "owner" && role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.cancelAppointment(input.id);
        return { success: true };
      }),

    complete: protectedProcedure
      .input(z.object({ id: z.number(), barbershopId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        await db.completeAppointment(input.id);
        return { success: true };
      }),

    byDate: protectedProcedure
      .input(z.object({ barbershopId: z.number(), date: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        return db.getAppointmentsByDate(input.barbershopId, input.date);
      }),

    all: protectedProcedure
      .input(z.object({ barbershopId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ensureBarbershopAdmin(ctx.user.id, input.barbershopId);
        return db.getAllAppointmentsForBarbershop(input.barbershopId);
      }),
  }),

  // ─── Super Admin ─────────────────────────────────────────────────────────
  superAdmin: router({
    listBarbershops: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user || ctx.user.role !== "superadmin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao super-administrador" });
      }
      return db.getAllBarbershopsWithStats();
    }),

    updateSubscriptionStatus: protectedProcedure
      .input(z.object({ shopId: z.number(), status: z.enum(["trial", "active", "blocked"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.setBarbershopSubscription(input.shopId, input.status);
        return { success: true };
      }),

    addAdminToShop: protectedProcedure
      .input(z.object({ shopId: z.number(), email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const targetUser = await db.getUserByEmailForAdmin(input.email);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado. O usuário precisa ter feito login no app ao menos uma vez." });
        await db.addMember({ barbershopId: input.shopId, userId: targetUser.id, role: "admin" });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
