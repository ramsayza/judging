export type MembershipRole = "judge" | "organizer" | "admin";
export type MembershipStatus = "pending" | "active" | "removed";
export type JoinPolicy = "open" | "approval";
export type EventStatus = "draft" | "published" | "completed" | "cancelled";
export type ContractStatus = "invitation" | "accepted" | "declined" | "appointed" | "cancelled" | "complete";

export interface UserRead {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
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

export interface EventRead {
  id: string;
  organization_id: string;
  name: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  status: EventStatus;
  created_by_user_id: string;
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

export interface ContractRead {
  id: string;
  event_id: string;
  judge_user_id: string;
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
