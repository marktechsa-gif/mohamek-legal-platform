export type UserRole = "owner" | "receptionist" | "technician" | "accountant" | "warehouse_supervisor";

export type WorkOrderStatus =
  | "checked_in"
  | "awaiting_part"
  | "in_progress"
  | "ready_for_pickup"
  | "closed";

export type ItemType = "labor" | "new_part" | "used_part";

export interface AuthUser {
  id: string;
  email: string;
  workshopId: string;
  role: UserRole;
}

export interface DiagnosticSuggestion {
  dtc_code: string;
  likely_causes: string[];
  recommended_steps: string[];
  confidence: "low" | "medium" | "high";
}
