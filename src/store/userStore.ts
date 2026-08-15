import { v4 as uuid } from "uuid";
import { User, UserPreferences } from "../types";

/**
 * In-memory mock user store shared by routes and jobs.
 * Swap for a real DB layer later without changing callers' signatures.
 */

const users = new Map<string, User>();

function seed() {
  const demo: User = {
    id: "user-demo",
    name: "Troy Evans",
    email: "troy.evans@outlook.com",
    active: true,
    preferences: {
      mood: "relaxed",
      budgetBand: "medium",
      favoriteLocations: ["Austin", "Lisbon"],
    },
    createdAt: new Date().toISOString(),
  };
  users.set(demo.id, demo);
}
seed();

export function listUsers(): User[] {
  return Array.from(users.values());
}

export function listActiveUsers(): User[] {
  return listUsers().filter((u) => u.active);
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function createUser(input: {
  name: string;
  email: string;
  preferences?: UserPreferences;
  active?: boolean;
}): User {
  const user: User = {
    id: uuid(),
    name: input.name,
    email: input.email,
    active: input.active ?? true,
    preferences: input.preferences ?? {},
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  return user;
}

export function updateUser(id: string, patch: Partial<Omit<User, "id" | "createdAt">>): User | undefined {
  const existing = users.get(id);
  if (!existing) return undefined;
  const updated: User = {
    ...existing,
    ...patch,
    preferences: { ...existing.preferences, ...(patch.preferences ?? {}) },
  };
  users.set(id, updated);
  return updated;
}

export function deleteUser(id: string): boolean {
  return users.delete(id);
}
