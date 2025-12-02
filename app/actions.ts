"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// --- SUPABASE CLIENT HELPER ---
async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Abaikan error
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Abaikan error
          }
        },
      },
    }
  );
}

// --- AUTH ACTIONS ---

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// --- EXPENSES ACTIONS ---

export async function addExpense(formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    date: formData.get("date"),
    description: formData.get("description"),
    requester: formData.get("requester"),
    amount: Number(formData.get("amount")?.toString().replace(/\D/g, "")),
    status: formData.get("status") || "Default",
    note: formData.get("note"),
  };

  const { error } = await supabase.from("expenses").insert(rawData);

  if (error) return { success: false, message: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { success: false };
  revalidatePath("/");
  return { success: true };
}

export async function updateExpenseStatus(id: string, newStatus: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ status: newStatus })
    .eq("id", id);
  if (error) return { success: false };
  revalidatePath("/");
  return { success: true };
}

// --- OVERTIME ACTIONS ---

export async function addOvertime(formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    date: formData.get("date"),
    employee_name: formData.get("employee_name"),
    days: Number(formData.get("days")),
    rate: Number(formData.get("rate")?.toString().replace(/\D/g, "")),
    status: formData.get("status") || "Default",
    note: formData.get("note"),
  };

  const { error } = await supabase.from("overtimes").insert(rawData);
  if (error) return { success: false, message: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteOvertime(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("overtimes").delete().eq("id", id);
  if (error) return { success: false };
  revalidatePath("/");
  return { success: true };
}

export async function updateOvertimeStatus(id: string, newStatus: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("overtimes")
    .update({ status: newStatus })
    .eq("id", id);
  if (error) return { success: false };
  revalidatePath("/");
  return { success: true };
}

// --- BUDGET SETTINGS ---
export async function updateBudget(newAmount: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "global_budget", value: newAmount });
  if (error) return { success: false, message: error.message };
  revalidatePath("/");
  return { success: true };
}
