import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // 1. Ambil Data Expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .order("created_at", { ascending: false });

  // 2. Ambil Data Overtimes (BARU)
  const { data: overtimes } = await supabase
    .from("overtimes")
    .select("*")
    .order("created_at", { ascending: false });

  // 3. Ambil Data Budget
  const { data: settings } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "global_budget")
    .single();

  return (
    <DashboardClient
      expenses={expenses || []}
      overtimes={overtimes || []} // Kirim data lembur
      initialBudget={settings?.value || 0}
    />
  );
}
