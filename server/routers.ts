import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
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

  services: router({
    list: publicProcedure.query(async () => db.getActiveServices()),
    listAll: adminProcedure.query(async () => db.getAllServices()),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1).max(255), description: z.string().optional(), durationMinutes: z.number().min(5).max(480), priceDisplay: z.string().max(50).optional() }))
      .mutation(async ({ input }) => { const id = await db.createService(input); return { id }; }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(255).optional(), description: z.string().optional(), durationMinutes: z.number().min(5).max(480).optional(), priceDisplay: z.string().max(50).optional(), active: z.boolean().optional() }))
      .mutation(async ({ input }) => { const { id, ...data } = input; await db.updateService(id, data); return { success: true }; }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteService(input.id); return { success: true }; }),
  }),

  workingHours: router({
    list: publicProcedure.query(async () => db.getWorkingHours()),
    upsert: adminProcedure
      .input(z.object({ dayOfWeek: z.number().min(0).max(6), startTime: z.string(), endTime: z.string(), intervalMinutes: z.number().min(5).max(120), isOpen: z.boolean() }))
      .mutation(async ({ input }) => { await db.upsertWorkingHour(input); return { success: true }; }),
  }),

  blockedDates: router({
    list: publicProcedure.query(async () => db.getBlockedDates()),
    add: adminProcedure
      .input(z.object({ date: z.string(), reason: z.string().max(255).optional() }))
      .mutation(async ({ input }) => { await db.addBlockedDate(input); return { success: true }; }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.removeBlockedDate(input.id); return { success: true }; }),
  }),

  appointments: router({
    availableSlots: publicProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        const blocked = await db.getBlockedDates();
        if (blocked.some((b) => b.date === input.date)) return [];
        const dateObj = new Date(input.date + "T12:00:00");
        const dayOfWeek = dateObj.getDay();
        const hours = await db.getWorkingHours();
        const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
        if (!dayHours || !dayHours.isOpen) return [];
        const slots: string[] = [];
        const [startH, startM] = dayHours.startTime.split(":").map(Number);
        const [endH, endM] = dayHours.endTime.split(":").map(Number);
        const interval = dayHours.intervalMinutes;
        let cur = startH * 60 + startM;
        const end = endH * 60 + endM;
        while (cur < end) {
          const h = Math.floor(cur / 60);
          const m = cur % 60;
          slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
          cur += interval;
        }
        const booked = await db.getBookedSlots(input.date);
        const bookedTimes = new Set(booked.map((b) => { const t = String(b.time); return t.length > 5 ? t.substring(0, 5) : t; }));
        return slots.filter((s) => !bookedTimes.has(s));
      }),

    create: protectedProcedure
      .input(z.object({ serviceId: z.number(), date: z.string(), time: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        if (input.date < todayStr) throw new Error("Não é possível agendar em datas passadas");
        if (input.date === todayStr) {
          const now = today.getHours() * 60 + today.getMinutes();
          const [h, m] = input.time.split(":").map(Number);
          if (h * 60 + m <= now) throw new Error("Não é possível agendar em horários passados");
        }
        const id = await db.createAppointment({ userId: ctx.user.id, serviceId: input.serviceId, date: input.date, time: input.time, status: "confirmed", notificationSent: false });
        try {
          const service = await db.getServiceById(input.serviceId);
          await notifyOwner({ title: "Novo Agendamento", content: `${ctx.user.name || "Cliente"} agendou ${service?.name || "serviço"} para ${input.date} às ${input.time}.` });
        } catch (e) { console.warn("[Notification] Failed to notify owner:", e); }
        return { id };
      }),

    mine: protectedProcedure.query(async ({ ctx }) => db.getUserAppointments(ctx.user.id)),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const appointment = await db.getAppointmentById(input.id);
        if (!appointment) throw new Error("Agendamento não encontrado");
        if (appointment.userId !== ctx.user.id && ctx.user.role !== "admin") throw new Error("Sem permissão para cancelar este agendamento");
        await db.cancelAppointment(input.id);
        return { success: true };
      }),

    complete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.completeAppointment(input.id); return { success: true }; }),

    byDate: adminProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => db.getAppointmentsByDate(input.date)),

    all: adminProcedure.query(async () => db.getAllAppointments()),
  }),
});

export type AppRouter = typeof appRouter;
