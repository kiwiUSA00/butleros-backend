import { v4 as uuid } from "uuid";
import { googleCalendarClient, eventbriteClient, ticketmasterClient } from "../apiClients";
import { CalendarEvent, DateRange } from "../types";

/**
 * Calendar integration module.
 * Writes/reads a real Google Calendar (via a service account) when
 * configured. The in-memory store below is NOT fabricated demo content —
 * it's the durable record of events *you actually add* through the app,
 * kept locally so the feature still works without a Google Calendar
 * connected. No events are seeded on boot.
 */

const eventStore = new Map<string, CalendarEvent[]>();

export async function addEvent(
  userId: string,
  event: { title: string; start: string; end: string; location?: string; type: CalendarEvent["type"] }
): Promise<CalendarEvent & { live: boolean }> {
  let liveId: string | null = null;
  if (googleCalendarClient.configured) {
    const result = await googleCalendarClient.addEvent(userId, event);
    if (result.live) liveId = result.id;
  } else {
    console.log("[calendar] Google Calendar not configured — storing event locally only");
  }

  const newEvent: CalendarEvent = { id: liveId ?? uuid(), ...event };
  const existing = eventStore.get(userId) ?? [];
  eventStore.set(userId, [...existing, newEvent]);

  return { ...newEvent, live: liveId !== null };
}

export async function listEvents(userId: string, range: DateRange): Promise<CalendarEvent[]> {
  if (googleCalendarClient.configured) {
    const result = await googleCalendarClient.listEvents(userId, range);
    if (result.live) {
      return result.items.map((e: any) => ({
        id: e.id ?? uuid(),
        title: e.title,
        start: e.start,
        end: e.end,
        location: e.location,
        type: (e.type as CalendarEvent["type"]) ?? "personal",
      }));
    }
  }

  const events = eventStore.get(userId) ?? [];
  return events.filter((e) => e.start >= range.from && e.start <= range.to);
}

/** Local public event discovery via Eventbrite/Ticketmaster. */
export async function findEvents(location?: string, date?: string) {
  const [eventbrite, ticketmaster] = await Promise.all([
    eventbriteClient.findEvents({ location, date }),
    ticketmasterClient.findEvents({ location, date }),
  ]);

  return [
    ...eventbrite.events.map((e: any) => ({ ...e, source: "eventbrite" as const, live: eventbrite.live })),
    ...ticketmaster.events.map((e: any) => ({ ...e, source: "ticketmaster" as const, live: ticketmaster.live })),
  ];
}
