/**
 * Invoice API Routes
 *
 * RESTful endpoints for invoice management.
 */

import { FastifyPluginAsync } from "fastify";
import { Id } from "../../../../convex/_generated/dataModel.js";
import { api } from "../../../../convex/_generated/api.js";
import { getConvexClient, isConvexAvailable } from "../../utils/convex.js";
import { Errors } from "../../utils/errors.js";
import { requireScope } from "../../plugins/auth.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
  recordPaymentSchema,
  invoiceQuerySchema,
} from "../../schemas/invoice.js";

const invoicesRoutes: FastifyPluginAsync = async (app) => {
  // Check Convex availability
  if (!isConvexAvailable()) {
    app.log.warn("Convex not configured - invoice routes using mock data");
  }

  /**
   * List invoices
   * GET /invoices
   */
  app.get(
    "/invoices",
    {
      schema: {
        description: "List invoices for the organization",
        tags: ["Invoices"],
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["draft", "sent", "viewed", "partial", "paid", "overdue", "cancelled", "void"],
            },
            customerId: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            cursor: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array" },
              hasMore: { type: "boolean" },
              nextCursor: { type: "string" },
            },
          },
        },
      },
      preHandler: [requireScope("invoices:read")],
    },
    async (request) => {
      const query = invoiceQuerySchema.parse(request.query);
      const { auth } = request;

      if (!isConvexAvailable()) {
        return { data: [], hasMore: false };
      }

      const convex = getConvexClient();
      const invoices = await convex.query(api.invoices.list, {
        orgId: auth!.orgId as Id<"organizations">,
        status: query.status,
        customerId: query.customerId as Id<"customers"> | undefined,
        limit: query.limit,
      });

      return {
        data: invoices,
        hasMore: invoices.length === query.limit,
        nextCursor: invoices.length > 0 ? invoices[invoices.length - 1]._id : undefined,
      };
    }
  );

  /**
   * Get invoice by ID
   * GET /invoices/:id
   */
  app.get(
    "/invoices/:id",
    {
      schema: {
        description: "Get a single invoice by ID",
        tags: ["Invoices"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: { type: "object" },
          404: { $ref: "ProblemDetails#" },
        },
      },
      preHandler: [requireScope("invoices:read")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { auth } = request;

      if (!isConvexAvailable()) {
        throw Errors.notFound("Invoice", id);
      }

      const convex = getConvexClient();
      const invoice = await convex.query(api.invoices.get, {
        orgId: auth!.orgId as Id<"organizations">,
        id: id as Id<"invoices">,
      });

      if (!invoice) {
        throw Errors.notFound("Invoice", id);
      }

      return invoice;
    }
  );

  /**
   * Create invoice
   * POST /invoices
   */
  app.post(
    "/invoices",
    {
      schema: {
        description: "Create a new invoice",
        tags: ["Invoices"],
        body: {
          type: "object",
          required: ["customerId", "number", "date", "dueDate", "items"],
          properties: {
            customerId: { type: "string" },
            number: { type: "string" },
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["description", "quantity", "unitPrice"],
                properties: {
                  description: { type: "string" },
                  quantity: { type: "number", minimum: 0 },
                  unitPrice: { type: "number", minimum: 0 },
                  incomeAccountId: { type: "string" },
                },
              },
            },
            taxRate: { type: "number", minimum: 0, maximum: 100 },
            notes: { type: "string" },
            terms: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              _id: { type: "string" },
              number: { type: "string" },
            },
          },
        },
      },
      preHandler: [requireScope("invoices:write")],
    },
    async (request, reply) => {
      const data = createInvoiceSchema.parse(request.body);
      const { auth } = request;

      if (!isConvexAvailable()) {
        throw Errors.serviceUnavailable("database");
      }

      const convex = getConvexClient();

      // Check for duplicate invoice number
      const existing = await convex.query(api.invoices.getByNumber, {
        orgId: auth!.orgId as Id<"organizations">,
        number: data.number,
      });

      if (existing) {
        throw Errors.duplicateEntry("invoice number", data.number);
      }

      const invoice = await convex.mutation(api.invoices.create, {
        orgId: auth!.orgId as Id<"organizations">,
        customerId: data.customerId as Id<"customers">,
        number: data.number,
        date: data.date,
        dueDate: data.dueDate,
        items: data.items.map((item) => ({
          ...item,
          incomeAccountId: item.incomeAccountId as Id<"accounts"> | undefined,
        })),
        taxRate: data.taxRate,
        notes: data.notes,
        terms: data.terms,
      });

      return reply.status(201).send(invoice);
    }
  );

  /**
   * Update invoice
   * PATCH /invoices/:id
   */
  app.patch(
    "/invoices/:id",
    {
      schema: {
        description: "Update an invoice (draft only)",
        tags: ["Invoices"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            customerId: { type: "string" },
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            taxRate: { type: "number", minimum: 0, maximum: 100 },
            notes: { type: "string" },
            terms: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
      preHandler: [requireScope("invoices:write")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = updateInvoiceSchema.parse(request.body);
      const { auth } = request;

      if (!isConvexAvailable()) {
        throw Errors.serviceUnavailable("database");
      }

      const convex = getConvexClient();

      try {
        await convex.mutation(api.invoices.update, {
          id: id as Id<"invoices">,
          orgId: auth!.orgId as Id<"organizations">,
          customerId: data.customerId as Id<"customers"> | undefined,
          date: data.date,
          dueDate: data.dueDate,
          taxRate: data.taxRate,
          notes: data.notes,
          terms: data.terms,
        });
      } catch (error) {
        if ((error as Error).message.includes("not found")) {
          throw Errors.notFound("Invoice", id);
        }
        if ((error as Error).message.includes("draft")) {
          throw Errors.businessRuleViolation("Can only update draft invoices");
        }
        throw error;
      }

      return { success: true };
    }
  );

  /**
   * Update invoice status
   * PUT /invoices/:id/status
   */
  app.put(
    "/invoices/:id/status",
    {
      schema: {
        description: "Update invoice status",
        tags: ["Invoices"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["draft", "sent", "viewed", "partial", "paid", "overdue", "cancelled", "void"],
            },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
      preHandler: [requireScope("invoices:write")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = updateInvoiceStatusSchema.parse(request.body);
      const { auth } = request;

      if (!isConvexAvailable()) {
        throw Errors.serviceUnavailable("database");
      }

      const convex = getConvexClient();

      try {
        await convex.mutation(api.invoices.updateStatus, {
          id: id as Id<"invoices">,
          orgId: auth!.orgId as Id<"organizations">,
          status: data.status,
        });
      } catch (error) {
        if ((error as Error).message.includes("not found")) {
          throw Errors.notFound("Invoice", id);
        }
        throw error;
      }

      return { success: true };
    }
  );

  /**
   * Record payment
   * POST /invoices/:id/payments
   */
  app.post(
    "/invoices/:id/payments",
    {
      schema: {
        description: "Record a payment against an invoice",
        tags: ["Invoices"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["amount"],
          properties: {
            amount: { type: "number", minimum: 0.01 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              newStatus: { type: "string" },
              amountPaid: { type: "number" },
              balanceDue: { type: "number" },
            },
          },
        },
      },
      preHandler: [requireScope("invoices:write")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = recordPaymentSchema.parse(request.body);
      const { auth } = request;

      if (!isConvexAvailable()) {
        throw Errors.serviceUnavailable("database");
      }

      const convex = getConvexClient();

      try {
        const result = await convex.mutation(api.invoices.recordPayment, {
          id: id as Id<"invoices">,
          orgId: auth!.orgId as Id<"organizations">,
          amount: data.amount,
        });
        return result;
      } catch (error) {
        if ((error as Error).message.includes("not found")) {
          throw Errors.notFound("Invoice", id);
        }
        throw error;
      }
    }
  );

  /**
   * Delete invoice
   * DELETE /invoices/:id
   */
  app.delete(
    "/invoices/:id",
    {
      schema: {
        description: "Delete a draft invoice",
        tags: ["Invoices"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
      preHandler: [requireScope("invoices:delete")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { auth } = request;

      if (!isConvexAvailable()) {
        throw Errors.serviceUnavailable("database");
      }

      const convex = getConvexClient();

      try {
        await convex.mutation(api.invoices.remove, {
          id: id as Id<"invoices">,
          orgId: auth!.orgId as Id<"organizations">,
        });
      } catch (error) {
        if ((error as Error).message.includes("not found")) {
          throw Errors.notFound("Invoice", id);
        }
        if ((error as Error).message.includes("draft")) {
          throw Errors.businessRuleViolation("Can only delete draft invoices");
        }
        throw error;
      }

      return { success: true };
    }
  );
};

export default invoicesRoutes;
