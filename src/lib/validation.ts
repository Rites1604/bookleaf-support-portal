import { z } from "zod";
import { CATEGORIES, PRIORITIES, STATUSES } from "./domain";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export const createTicketSchema = z.object({
  /** null = "General / Account Level" */
  bookId: z.string().min(1).nullable(),
  subject: z.string().trim().min(5, "Subject should be at least 5 characters").max(150),
  description: z.string().trim().min(20, "Please describe the issue in at least 20 characters").max(5000),
  attachmentName: z.string().max(255).optional(),
});

export const listTicketsQuery = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum([...CATEGORIES, "UNCLASSIFIED"]).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.enum(["me", "unassigned"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["urgency", "newest", "oldest"]).default("urgency"),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES),
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    /** "me" assigns to the caller; null unassigns. */
    assigneeId: z.union([z.literal("me"), z.string().min(1), z.null()]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(10000),
  isInternal: z.boolean().default(false),
  /** Id of the AI draft the admin started from, so we can track edit rates. */
  draftId: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuery>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
