import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/domain";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ "application/json": { schema } });
const ok = (description: string, schema: object) => ({ description, content: json(schema) });
const err = (description: string) => ({ description, content: json(ref("Error")) });
const idParam = { name: "id", in: "path", required: true, schema: { type: "string" } };

const commonErrors = {
  401: err("Not logged in or session expired"),
  403: err("Role not allowed"),
  422: err("Validation failed; `details` lists each invalid field"),
};

/** OpenAPI 3.1 description of the v1 API. Served at /api/v1/openapi and rendered at /api-docs. */
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "BookLeaf Author Support API",
    version: "1.0.0",
    description:
      "REST API behind the author and admin portals. Authenticate with POST /auth/login; the session is an httpOnly cookie sent automatically by the browser. Every error has the shape `{ error: { code, message, details? } }`.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "bl_session" } },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", enum: ["VALIDATION_FAILED", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "AI_UNAVAILABLE", "INTERNAL"] },
              message: { type: "string" },
              details: { type: "array", items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } } },
            },
          },
        },
      },
      Book: {
        type: "object",
        properties: {
          id: { type: "string" },
          bookCode: { type: "string", example: "BK001" },
          title: { type: "string" },
          isbn: { type: "string" },
          genre: { type: "string" },
          status: { type: "string", example: "Published & Live" },
          publicationDate: { type: ["string", "null"], format: "date" },
          mrp: { type: ["integer", "null"] },
          royaltyPerCopy: { type: ["integer", "null"] },
          copiesSold: { type: "integer" },
          royaltyEarned: { type: "integer" },
          royaltyPaid: { type: "integer" },
          royaltyPending: { type: "integer" },
          lastPayoutDate: { type: ["string", "null"], format: "date" },
          printPartner: { type: ["string", "null"] },
          availableOn: { type: "array", items: { type: "string" } },
          inProduction: { type: "boolean" },
          productionStage: { type: ["string", "null"] },
          royalty: {
            type: ["object", "null"],
            description: "Derived payout facts; null for books still in production.",
            properties: {
              pending: { type: "integer" },
              belowThreshold: { type: "boolean" },
              nextPayoutBy: { type: "string", format: "date" },
              neverPaid: { type: "boolean" },
              likelyOverdue: { type: "boolean" },
            },
          },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string" },
          body: { type: "string" },
          isInternal: { type: "boolean", description: "Admin-only notes; never returned to authors." },
          fromAiDraft: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          sender: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, role: { type: "string", enum: ["AUTHOR", "ADMIN"] } } },
        },
      },
      Ticket: {
        type: "object",
        properties: {
          id: { type: "string" },
          subject: { type: "string" },
          description: { type: "string" },
          attachmentName: { type: ["string", "null"] },
          status: { type: "string", enum: STATUSES },
          category: { type: "string", enum: ["UNCLASSIFIED", ...CATEGORIES] },
          priority: { type: "string", enum: PRIORITIES },
          categorySource: { type: "string", enum: ["PENDING", "AI", "FALLBACK", "ADMIN"], description: "Admin only" },
          prioritySource: { type: "string", enum: ["PENDING", "AI", "FALLBACK", "ADMIN"], description: "Admin only" },
          aiConfidence: { type: ["number", "null"], description: "Admin only" },
          aiReasoning: { type: ["string", "null"], description: "Admin only" },
          assignee: { type: ["object", "null"], description: "Admin only" },
          book: { type: ["object", "null"] },
          author: { type: "object" },
          messages: { type: "array", items: ref("Message"), description: "Only on GET /tickets/{id}" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Draft: {
        oneOf: [
          {
            type: "object",
            properties: {
              status: { const: "ready" },
              draft: { type: "object", properties: { id: { type: "string" }, body: { type: "string" }, model: { type: "string" }, createdAt: { type: "string" }, cached: { type: "boolean" } } },
            },
          },
          {
            type: "object",
            properties: {
              status: { const: "unavailable" },
              reason: { type: "string", enum: ["not_configured", "rate_limited", "timeout", "provider_error", "bad_output", "refused"] },
            },
          },
        ],
      },
    },
  },
  security: [{ session: [] }],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        security: [],
        requestBody: { content: json({ type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } }) },
        responses: { 200: ok("Session cookie set", { type: "object" }), 401: err("Wrong email or password"), 422: commonErrors[422] },
      },
    },
    "/auth/logout": { post: { tags: ["Auth"], summary: "Clear the session cookie", security: [], responses: { 204: { description: "Logged out" } } } },
    "/auth/me": { get: { tags: ["Auth"], summary: "Current user (admins also get `aiEnabled`)", responses: { 200: ok("Current user", { type: "object" }), 401: commonErrors[401] } } },
    "/books": {
      get: {
        tags: ["Books"],
        summary: "Books for the caller (authors: own; admins: all or ?authorId=)",
        parameters: [{ name: "authorId", in: "query", schema: { type: "string" }, description: "Admin only" }],
        responses: { 200: ok("Books", { type: "object", properties: { data: { type: "array", items: ref("Book") } } }), 401: commonErrors[401] },
      },
    },
    "/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "List tickets (authors: own; admins: all)",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: STATUSES } },
          { name: "category", in: "query", schema: { type: "string", enum: ["UNCLASSIFIED", ...CATEGORIES] } },
          { name: "priority", in: "query", schema: { type: "string", enum: PRIORITIES } },
          { name: "assignee", in: "query", schema: { type: "string", enum: ["me", "unassigned"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "q", in: "query", schema: { type: "string" }, description: "Search subject, description and author name" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["urgency", "newest", "oldest"], default: "urgency" } },
        ],
        responses: { 200: ok("Tickets", { type: "object", properties: { data: { type: "array", items: ref("Ticket") } } }), ...commonErrors },
      },
      post: {
        tags: ["Tickets"],
        summary: "Raise a ticket (authors). AI classification runs after the response.",
        requestBody: {
          content: json({
            type: "object",
            required: ["bookId", "subject", "description"],
            properties: {
              bookId: { type: ["string", "null"], description: "null = General / Account Level" },
              subject: { type: "string", minLength: 5, maxLength: 150 },
              description: { type: "string", minLength: 20, maxLength: 5000 },
              attachmentName: { type: "string" },
            },
          }),
        },
        responses: { 201: ok("Created", { type: "object", properties: { data: ref("Ticket") } }), ...commonErrors },
      },
    },
    "/tickets/{id}": {
      get: {
        tags: ["Tickets"],
        summary: "Ticket with its thread (internal notes and triage fields only for admins)",
        parameters: [idParam],
        responses: { 200: ok("Ticket", { type: "object", properties: { data: ref("Ticket") } }), 404: err("Not found or not yours"), 401: commonErrors[401] },
      },
      patch: {
        tags: ["Tickets"],
        summary: "Update status, category, priority or assignee (admins). Category/priority set here are never overwritten by AI.",
        parameters: [idParam],
        requestBody: {
          content: json({
            type: "object",
            minProperties: 1,
            properties: {
              status: { type: "string", enum: STATUSES },
              category: { type: "string", enum: CATEGORIES },
              priority: { type: "string", enum: PRIORITIES },
              assigneeId: { type: ["string", "null"], description: '"me", an admin user id, or null to unassign' },
            },
          }),
        },
        responses: { 200: ok("Updated", { type: "object", properties: { data: ref("Ticket") } }), 404: err("Not found"), ...commonErrors },
      },
    },
    "/tickets/{id}/messages": {
      post: {
        tags: ["Tickets"],
        summary: "Reply (authors and admins) or add an internal note (admins)",
        parameters: [idParam],
        requestBody: {
          content: json({
            type: "object",
            required: ["body"],
            properties: { body: { type: "string" }, isInternal: { type: "boolean", default: false }, draftId: { type: "string", description: "AI draft the reply started from" } },
          }),
        },
        responses: { 201: ok("Created", { type: "object", properties: { data: ref("Message") } }), 404: err("Not found"), 409: err("Ticket is closed"), ...commonErrors },
      },
    },
    "/tickets/{id}/draft": {
      get: {
        tags: ["AI"],
        summary: "AI draft for the next reply (admins). Reuses a stored draft when the ticket hasn't changed.",
        parameters: [idParam],
        responses: { 200: ok("Draft or the reason AI is unavailable", { type: "object", properties: { data: ref("Draft") } }), 404: err("Not found"), ...commonErrors },
      },
      post: {
        tags: ["AI"],
        summary: "Generate a fresh draft (admins)",
        parameters: [idParam],
        responses: { 200: ok("Draft or the reason AI is unavailable", { type: "object", properties: { data: ref("Draft") } }), 404: err("Not found"), ...commonErrors },
      },
    },
    "/tickets/{id}/classify": {
      post: {
        tags: ["AI"],
        summary: "Re-run AI classification (admins). Keeps admin overrides unless ?force=true.",
        parameters: [idParam, { name: "force", in: "query", schema: { type: "boolean" } }],
        responses: { 200: ok("Updated ticket", { type: "object", properties: { data: ref("Ticket") } }), 404: err("Not found"), ...commonErrors },
      },
    },
    "/events": {
      get: {
        tags: ["Realtime"],
        summary: "Server-Sent Events stream of ticket changes visible to the caller",
        description: "Emits `event: tickets` with `data: {\"ids\": [...]}`. Streams close after ~50s; EventSource reconnects and resumes from Last-Event-ID.",
        responses: { 200: { description: "text/event-stream" }, 401: commonErrors[401] },
      },
    },
    "/admin/ai-usage": {
      get: { tags: ["AI"], summary: "Token usage, failures and estimated spend by task (admins)", responses: { 200: ok("Usage summary", { type: "object" }), ...commonErrors } },
    },
  },
};
