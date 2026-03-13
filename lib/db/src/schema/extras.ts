import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const ideasTable = pgTable("ideas", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("idea"),
  content: text("content").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checklistItemsTable = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  backgroundUrl: text("background_url"),
  backgroundType: text("background_type").notNull().default("default"),
});

export type Idea = typeof ideasTable.$inferSelect;
export type ChecklistItem = typeof checklistItemsTable.$inferSelect;
export type UserSetting = typeof userSettingsTable.$inferSelect;
