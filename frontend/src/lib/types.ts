export type MembershipRole = "judge" | "organizer";
export type MembershipStatus = "pending" | "active" | "removed";
export type JoinPolicy = "open" | "approval";
export type EventStatus = "draft" | "published" | "completed" | "cancelled" | "archived";
export type EventRuleSet = "RKC" | "Nexus" | "IFCS" | "A4A" | "Independent";
export type ContractStatus = "invitation" | "accepted" | "declined" | "appointed" | "cancelled" | "complete";

export interface UserRead {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_platform_admin: boolean;
}

export interface OrganizationRead {
  id: string;
  name: string;
  slug: string;
  join_policy: JoinPolicy;
}

export interface OrganizationPublicRead {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationEmailTemplateRead {
  subject: string | null;
  body: string | null;
  effective_subject: string;
  effective_body: string;
  placeholders: string[];
}

export interface MembershipWithOrgRead {
  id: string;
  user_id: string;
  organization_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  organization_name: string;
  organization_slug: string;
}

export interface MembershipWithUserRead {
  id: string;
  user_id: string;
  organization_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  user_email: string;
  user_name: string;
}

export interface MeResponse {
  user: UserRead;
  memberships: MembershipWithOrgRead[];
}

export interface ClassRestriction {
  discipline: string | null;
  level: string | null;
}

export interface RuleSetQualification {
  rule_set: EventRuleSet;
  qualified_date: string;
}

export interface UserDetailsRead {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_platform_admin: boolean;
  home_postcode: string | null;
  class_restrictions: ClassRestriction[];
  rule_set_qualifications: RuleSetQualification[];
}

export interface ClassRestrictionOptions {
  disciplines: string[];
  levels: string[];
}

export interface EventRead {
  id: string;
  organization_id: string;
  name: string;
  venue: string | null;
  venue_postcode: string | null;
  rule_set: EventRuleSet | null;
  cost_per_mile: number;
  reimbursement_cap: number | null;
  contract_copy_override: string | null;
  start_date: string;
  end_date: string;
  status: EventStatus;
  created_by_user_id: string;
}

export type RequirementFieldType = "text" | "number" | "select" | "multiselect";

export interface RequirementField {
  key: string;
  label: string;
  field_type: RequirementFieldType;
  required: boolean;
  options: string[] | null;
}

export interface EventContractRequirementsRead {
  fields: RequirementField[];
}

export interface EventClassRead {
  id: string;
  event_id: string;
  name: string;
  level: string | null;
  discipline: string | null;
  scheduled_time: string | null;
  ring: string | null;
}

export interface ReimbursementEstimate {
  miles_one_way: number;
  miles_return: number;
  rate_per_mile: string;
  cap: string | null;
  capped: boolean;
  amount: string;
  judge_postcode: string;
  venue_postcode: string;
}

export interface RuleSetContractCopyRead {
  rule_set: EventRuleSet;
  body: string;
}

export interface ContractCopyRead {
  effective_body: string;
  signed_at: string | null;
  signed_body: string | null;
}

export interface ContractRead {
  id: string;
  event_id: string;
  judge_user_id: string;
  judge_name: string;
  judge_email: string;
  organization_id: string;
  status: ContractStatus;
  invited_by_user_id: string;
  invited_at: string;
  responded_at: string | null;
  appointed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  decline_reason: string | null;
  cancel_reason: string | null;
  notes: string | null;
  requirement_responses: Record<string, string | string[]> | null;
  reimbursement_estimate: ReimbursementEstimate | null;
  contract_copy_signed_at: string | null;
  contract_copy_signed_body: string | null;
}

export interface MyContractRead {
  id: string;
  event_id: string;
  event_name: string;
  venue: string | null;
  event_start_date: string;
  event_end_date: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  status: ContractStatus;
  invited_at: string;
  responded_at: string | null;
  appointed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  decline_reason: string | null;
  cancel_reason: string | null;
  requirement_responses: Record<string, string | string[]> | null;
  reimbursement_estimate: ReimbursementEstimate | null;
  contract_copy_signed_at: string | null;
  contract_copy_signed_body: string | null;
}

export interface ClassAllocationRead {
  id: string;
  contract_id: string;
  event_class_id: string;
}

export interface AllocationBoardEntry {
  allocation_id: string;
  event_class_id: string;
  event_class_name: string;
  contract_id: string;
  judge_user_id: string;
  judge_name: string;
  contract_status: string;
}
