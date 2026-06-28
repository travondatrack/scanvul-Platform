export const SCAN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export const FINDING_STATUSES = [
  "open",
  "confirmed",
  "in_progress",
  "fixed",
  "accepted_risk",
  "false_positive",
  "ignored",
  "reopened",
] as const;
export const VERIFICATION_STATUSES = [
  "unverified",
  "verified",
  "failed",
  "skipped",
  "needs_review",
  "false_positive_likely",
] as const;
export const SEVERITIES = ["Info", "Low", "Medium", "High", "Critical"] as const;
export const ORGANIZATION_ROLES = ["owner", "admin", "member", "viewer"] as const;
export const INVITE_STATUSES = ["pending", "accepted", "rejected", "cancelled", "expired"] as const;
export const NOTIFICATION_STATUSES = ["unread", "read", "actioned"] as const;

export const NOTIFICATION_TYPES = {
  scanCompleted: "scan_completed",
  scanFailed: "scan_failed",
  findingAssigned: "finding_assigned",
  findingCommented: "finding_commented",
  teamInvite: "team_invite",
  teamInviteAccepted: "team_invite_accepted",
  teamInviteRejected: "team_invite_rejected",
  teamMemberLeft: "team_member_left",
  teamMemberRemoved: "team_member_removed",
  teamDeleted: "team_deleted",
  projectDeleted: "project_deleted",
} as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const GLOBAL_ROLES = ["user", "admin", "support_admin", "security_admin", "super_admin"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const ADMIN_AUDIT_ACTIONS = {
  USER_LOCKED: "ADMIN_USER_LOCKED",
  USER_UNLOCKED: "ADMIN_USER_UNLOCKED",
  USER_ROLE_CHANGED: "ADMIN_USER_ROLE_CHANGED",
  SCAN_CANCELLED: "ADMIN_SCAN_CANCELLED",
  PROJECT_VIEWED: "ADMIN_PROJECT_VIEWED",
  ORG_VIEWED: "ADMIN_ORG_VIEWED",
  HEALTH_VIEWED: "ADMIN_HEALTH_VIEWED",
  SETTINGS_UPDATED: "ADMIN_SETTINGS_UPDATED",
  SUPPORT_ACCESS_USED: "ADMIN_SUPPORT_ACCESS_USED",
} as const;

export function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}
