import type { User as AuthUser } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, normalizePlanType } from "@/lib/plan/planLimits";
import type { PlanType, User } from "@/lib/types";

const USER_SELECT =
  "id, phone, nickname, avatar_url, plan_type, plan_room_limit, generation_count, replacement_count, replacement_daily_count, replacement_daily_reset_at, created_at, updated_at";

interface UserRow {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatar_url: string | null;
  plan_type: string | null;
  plan_room_limit: number | null;
  generation_count: number | null;
  replacement_count: number | null;
  replacement_daily_count: number | null;
  replacement_daily_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapUserRow(row: UserRow): User {
  const planType = normalizePlanType(row.plan_type);

  return {
    id: row.id,
    phone: row.phone,
    nickname: row.nickname,
    avatar_url: row.avatar_url,
    plan_type: planType,
    plan_room_limit: row.plan_room_limit ?? PLAN_LIMITS[planType].rooms,
    generation_count: row.generation_count ?? 0,
    replacement_count: row.replacement_count ?? 0,
    replacement_daily_count: row.replacement_daily_count ?? 0,
    replacement_daily_reset_at: row.replacement_daily_reset_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAppUserById(
  userId: string,
  supabase = createServiceRoleClient(),
): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("id", userId)
    .maybeSingle<UserRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapUserRow(data) : null;
}

export async function ensureAppUser(
  authUser: AuthUser,
  supabase = createServiceRoleClient(),
): Promise<User> {
  const existingUser = await getAppUserById(authUser.id, supabase);
  if (existingUser) {
    return existingUser;
  }

  const defaultPlanType: PlanType = "free";
  const nickname =
    typeof authUser.user_metadata?.nickname === "string"
      ? authUser.user_metadata.nickname
      : null;
  const avatarUrl =
    typeof authUser.user_metadata?.avatar_url === "string"
      ? authUser.user_metadata.avatar_url
      : null;

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        id: authUser.id,
        phone: authUser.phone ?? null,
        nickname,
        avatar_url: avatarUrl,
        plan_type: defaultPlanType,
        plan_room_limit: PLAN_LIMITS[defaultPlanType].rooms,
      },
      {
        onConflict: "id",
      },
    )
    .select(USER_SELECT)
    .single<UserRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to initialize app user profile.");
  }

  return mapUserRow(data);
}

export async function requireCurrentAppUser() {
  const authSupabase = await createAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required.");
  }

  const adminSupabase = createServiceRoleClient();
  const appUser = await ensureAppUser(user, adminSupabase);

  return {
    authUser: user,
    appUser,
    adminSupabase,
  };
}
