import { z } from "zod"

// Zod schemas for validation
export const CreateTicketSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters long"),
  body: z.string().min(10, "Body must be at least 10 characters long"),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().min(1, "Category is required"),
})

export const UpdateTicketSchema = z.object({
  id: z.string().min(1, "Ticket ID is required"),
  status: z.string().min(1, "Status is required"),
  priority: z.enum(["low", "medium", "high"]).optional(),
})

export const EscalateTicketSchema = z.object({
  id: z.string().min(1, "Ticket ID is required"),
  reason: z.string().min(5, "Reason must explain escalation reasons"),
})

export const CloseTicketSchema = z.object({
  id: z.string().min(1, "Ticket ID is required"),
  resolutionNotes: z.string().min(10, "Resolution notes must be at least 10 characters"),
})

export interface ToolResponse {
  status: "Success" | "Error"
  message: string
  data?: any
}

/**
 * Route and execute support tools dynamically. Performs parameter validation
 * and returns detailed statuses to the LLM agent.
 */
export async function executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResponse> {
  try {
    switch (toolName) {
      case "create_ticket": {
        const parsed = CreateTicketSchema.safeParse(args)
        if (!parsed.success) {
          return getValidationErrorResponse(parsed.error)
        }
        const ticketId = `TCK-${Math.floor(Math.random() * 9000) + 1000}`
        return {
          status: "Success",
          message: `Ticket '${parsed.data.title}' created successfully under ID ${ticketId}.`,
          data: { id: ticketId, ...parsed.data },
        }
      }

      case "update_ticket": {
        const parsed = UpdateTicketSchema.safeParse(args)
        if (!parsed.success) {
          return getValidationErrorResponse(parsed.error)
        }
        return {
          status: "Success",
          message: `Ticket ${parsed.data.id} status updated to '${parsed.data.status}' successfully.`,
          data: parsed.data,
        }
      }

      case "escalate_ticket": {
        const parsed = EscalateTicketSchema.safeParse(args)
        if (!parsed.success) {
          return getValidationErrorResponse(parsed.error)
        }
        return {
          status: "Success",
          message: `Ticket ${parsed.data.id} escalated successfully. Reason: ${parsed.data.reason}.`,
          data: parsed.data,
        }
      }

      case "close_ticket": {
        const parsed = CloseTicketSchema.safeParse(args)
        if (!parsed.success) {
          return getValidationErrorResponse(parsed.error)
        }
        return {
          status: "Success",
          message: `Ticket ${parsed.data.id} closed successfully. Notes: ${parsed.data.resolutionNotes}.`,
          data: parsed.data,
        }
      }

      default:
        return {
          status: "Error",
          message: `UnknownToolException: The tool name '${toolName}' is not defined in this system.`,
        }
    }
  } catch (err: unknown) {
    console.error(`Tool '${toolName}' execution exception:`, err)
    return {
      status: "Error",
      message: `ExecutionException: Failed to run tool '${toolName}'. Detail: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Formats Zod validation issues into structured error response messages.
 */
function getValidationErrorResponse(error: z.ZodError): ToolResponse {
  const issuesText = error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ")
  return {
    status: "Error",
    message: `ValidationException: Input parameters failed constraints check. Detail: ${issuesText}`,
  }
}
