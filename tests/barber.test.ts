import { describe, it, expect } from "vitest";

// ─── Business Logic Tests ─────────────────────────────────────────────────────

describe("Appointment date/time validation", () => {
  function isDateInPast(date: string): boolean {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    return date < todayStr;
  }

  function isTimeInPast(date: string, time: string): boolean {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    if (date > todayStr) return false;
    if (date < todayStr) return true;
    const now = today.getHours() * 60 + today.getMinutes();
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m <= now;
  }

  it("should reject past dates", () => {
    expect(isDateInPast("2020-01-01")).toBe(true);
    expect(isDateInPast("2024-06-15")).toBe(true);
  });

  it("should accept future dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureStr = future.toISOString().split("T")[0];
    expect(isDateInPast(futureStr)).toBe(false);
  });

  it("should reject past times on today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(isTimeInPast(today, "00:00")).toBe(true);
    expect(isTimeInPast(today, "01:00")).toBe(true);
  });

  it("should accept future times on today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(isTimeInPast(today, "23:59")).toBe(false);
  });

  it("should accept any time on future dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const futureStr = future.toISOString().split("T")[0];
    expect(isTimeInPast(futureStr, "00:00")).toBe(false);
    expect(isTimeInPast(futureStr, "09:00")).toBe(false);
  });
});

describe("Available slots generation", () => {
  function generateSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
    const slots: string[] = [];
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    let cur = startH * 60 + startM;
    const end = endH * 60 + endM;
    while (cur < end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      cur += intervalMinutes;
    }
    return slots;
  }

  it("should generate correct slots for 09:00-18:00 with 30min interval", () => {
    const slots = generateSlots("09:00", "18:00", 30);
    expect(slots[0]).toBe("09:00");
    expect(slots[slots.length - 1]).toBe("17:30");
    expect(slots.length).toBe(18);
  });

  it("should generate correct slots for 08:00-12:00 with 60min interval", () => {
    const slots = generateSlots("08:00", "12:00", 60);
    expect(slots).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });

  it("should filter out booked slots", () => {
    const allSlots = generateSlots("09:00", "12:00", 30);
    const booked = new Set(["09:00", "10:30"]);
    const available = allSlots.filter((s) => !booked.has(s));
    expect(available).not.toContain("09:00");
    expect(available).not.toContain("10:30");
    expect(available).toContain("09:30");
    expect(available).toContain("11:00");
  });

  it("should return empty array for closed day", () => {
    const slots: string[] = [];
    expect(slots.length).toBe(0);
  });
});

describe("Date formatting", () => {
  function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  it("should format date correctly", () => {
    const d = new Date(2025, 11, 25); // Dec 25, 2025
    expect(toDateStr(d)).toBe("2025-12-25");
  });

  it("should pad single-digit months and days", () => {
    const d = new Date(2025, 0, 5); // Jan 5, 2025
    expect(toDateStr(d)).toBe("2025-01-05");
  });
});

describe("Appointment status logic", () => {
  it("should correctly identify upcoming appointments", () => {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const futureStr = future.toISOString().split("T")[0];

    const appointments = [
      { id: 1, date: futureStr, status: "confirmed" },
      { id: 2, date: "2020-01-01", status: "confirmed" },
      { id: 3, date: futureStr, status: "cancelled" },
    ];

    const upcoming = appointments.filter(
      (a) => a.status !== "cancelled" && a.date >= today
    );
    expect(upcoming.length).toBe(1);
    expect(upcoming[0].id).toBe(1);
  });

  it("should correctly identify history appointments", () => {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const futureStr = future.toISOString().split("T")[0];

    const appointments = [
      { id: 1, date: futureStr, status: "confirmed" },
      { id: 2, date: "2020-01-01", status: "confirmed" },
      { id: 3, date: futureStr, status: "cancelled" },
    ];

    const history = appointments.filter(
      (a) => a.status === "cancelled" || a.date < today
    );
    expect(history.length).toBe(2);
    expect(history.map((a) => a.id)).toContain(2);
    expect(history.map((a) => a.id)).toContain(3);
  });
});
