"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Wallet,
  Plus,
  Trash2,
  Menu,
  X,
  Loader2,
  Search,
  Edit3,
  Clock,
  BarChart3,
  FileSpreadsheet,
  Hourglass,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Pencil, // Icon Edit baru
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  addExpense,
  deleteExpense,
  updateExpenseStatus,
  addOvertime,
  deleteOvertime,
  updateOvertimeStatus,
  updateBudget,
  logout,
  updateExpense, // Pastikan ada di actions.ts
  updateOvertime, // Pastikan ada di actions.ts
} from "@/app/actions";

// IMPORT RECHARTS
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
} from "recharts";

// IMPORT XLSX
import * as XLSX from "xlsx";

// IMPORT IMAGE
import Image from "next/image";

// --- DEFINISI TIPE DATA ---
type Expense = {
  id: string;
  date: string;
  description: string;
  requester: string;
  amount: number;
  status: string;
  note: string;
};

type Overtime = {
  id: string;
  date: string;
  employee_name: string;
  days: number;
  rate: number;
  status: string;
  note: string;
};

function isExpense(item: Expense | Overtime): item is Expense {
  return (item as Expense).description !== undefined;
}

const ITEMS_PER_PAGE = 20;
const AUTO_LOGOUT_TIME = 15 * 60 * 1000;

// --- KOMPONEN TOOLTIP ---
interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    name: string;
    value: number;
    color: string;
    [key: string]: unknown;
  }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
        <p className="text-sm font-bold text-slate-700 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}:{" "}
            <span className="font-bold">{formatRupiah(entry.value)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardClient({
  expenses,
  overtimes,
  initialBudget,
}: {
  expenses: Expense[];
  overtimes: Overtime[];
  initialBudget: number;
}) {
  const [activeTab, setActiveTab] = useState<"expenses" | "overtime" | "stats">(
    "expenses"
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statsSlide, setStatsSlide] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  // EDIT STATE
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- 1. LOGIKA AUTO LOGOUT ---
  const handleActivity = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    logoutTimerRef.current = setTimeout(() => {
      logout();
    }, AUTO_LOGOUT_TIME);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0);
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keypress", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);
    handleActivity();

    return () => {
      clearTimeout(timer);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keypress", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [handleActivity]);

  // --- 2. FILTER & DATA PROCESSING ---
  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((item) => item.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const currentMonthOvertimes = useMemo(() => {
    return overtimes.filter((item) => item.date.startsWith(selectedMonth));
  }, [overtimes, selectedMonth]);

  const filteredExpenses = useMemo(() => {
    return currentMonthExpenses.filter(
      (item) =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.requester.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentMonthExpenses, searchTerm]);

  const filteredOvertimes = useMemo(() => {
    return currentMonthOvertimes.filter((item) =>
      item.employee_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentMonthOvertimes, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, selectedMonth]);

  const currentDataList =
    activeTab === "expenses" ? filteredExpenses : filteredOvertimes;
  const totalPages = Math.ceil(currentDataList.length / ITEMS_PER_PAGE);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return currentDataList.slice(start, end);
  }, [currentDataList, currentPage]);

  // --- 4. CHART DATA ---
  const chartData = useMemo(() => {
    const daysInMonth = new Date(
      parseInt(selectedMonth.split("-")[0]),
      parseInt(selectedMonth.split("-")[1]),
      0
    ).getDate();
    const data = Array.from({ length: daysInMonth }, (_, i) => ({
      name: `${i + 1}`,
      Pengeluaran: 0,
      Lembur: 0,
      Total: 0,
    }));

    currentMonthExpenses.forEach((item) => {
      if (item.status !== "Rejected") {
        const day = new Date(item.date).getDate() - 1;
        if (data[day]) data[day].Pengeluaran += item.amount;
      }
    });

    currentMonthOvertimes.forEach((item) => {
      if (item.status !== "Rejected") {
        const day = new Date(item.date).getDate() - 1;
        if (data[day]) data[day].Lembur += item.days * item.rate;
      }
    });

    data.forEach((d) => (d.Total = d.Pengeluaran + d.Lembur));
    return data;
  }, [currentMonthExpenses, currentMonthOvertimes, selectedMonth]);

  // --- 5. KALKULASI STATISTIK ---
  const totalExpenseAmount = currentMonthExpenses
    .filter((item) => item.status !== "Rejected")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalOvertimeAmount = currentMonthOvertimes
    .filter((item) => item.status !== "Rejected")
    .reduce((acc, curr) => acc + curr.days * curr.rate, 0);

  const grandTotalUsed = totalExpenseAmount + totalOvertimeAmount;
  const sisaBudget = initialBudget - grandTotalUsed;

  const currentMainStat =
    activeTab === "expenses" ? totalExpenseAmount : totalOvertimeAmount;
  const currentPendingCount =
    activeTab === "expenses"
      ? filteredExpenses.filter((i) => i.status === "Pending").length
      : filteredOvertimes.filter((i) => i.status === "Pending").length;

  // --- HANDLERS ---
  const handleNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    setter(
      rawValue ? new Intl.NumberFormat("id-ID").format(Number(rawValue)) : ""
    );
  };

  const handleEditClick = (item: Expense | Overtime) => {
    setEditingId(item.id);
    if (isExpense(item)) {
      setAmountInput(new Intl.NumberFormat("id-ID").format(item.amount));
    } else {
      setAmountInput(new Intl.NumberFormat("id-ID").format(item.rate));
    }

    setIsModalOpen(true);

    setTimeout(() => {
      if (formRef.current) {
        const dateInput = formRef.current.elements.namedItem(
          "date"
        ) as HTMLInputElement;
        if (dateInput) dateInput.value = item.date;

        const noteInput = formRef.current.elements.namedItem(
          "note"
        ) as HTMLTextAreaElement;
        if (noteInput) noteInput.value = item.note || "";

        const statusInput = formRef.current.elements.namedItem(
          "status"
        ) as HTMLSelectElement;
        if (statusInput) statusInput.value = item.status || "Default";

        if (activeTab === "expenses" && isExpense(item)) {
          const descInput = formRef.current.elements.namedItem(
            "description"
          ) as HTMLInputElement;
          if (descInput) descInput.value = item.description;

          const reqInput = formRef.current.elements.namedItem(
            "requester"
          ) as HTMLInputElement;
          if (reqInput) reqInput.value = item.requester;
        } else if (activeTab === "overtime" && !isExpense(item)) {
          const empInput = formRef.current.elements.namedItem(
            "employee_name"
          ) as HTMLInputElement;
          if (empInput) empInput.value = item.employee_name;

          const daysInput = formRef.current.elements.namedItem(
            "days"
          ) as HTMLInputElement;
          if (daysInput) daysInput.value = item.days.toString();
        }
      }
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      if (editingId) {
        formData.append("id", editingId);
        if (activeTab === "expenses") await updateExpense(formData);
        else await updateOvertime(formData);
      } else {
        if (activeTab === "expenses") await addExpense(formData);
        else await addOvertime(formData);
      }
    } catch (error) {
      console.error("Error submitting form", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
      setIsModalOpen(false);
      setEditingId(null);
      setAmountInput("");
    }
  };

  const handleUpdateBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const cleanAmount = Number(
      formData.get("budget")?.toString().replace(/\D/g, "")
    );
    await updateBudget(cleanAmount);
    setIsSubmitting(false);
    setIsBudgetModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data ini?")) return;
    if (activeTab === "expenses") await deleteExpense(id);
    else await deleteOvertime(id);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (activeTab === "expenses") await updateExpenseStatus(id, newStatus);
    else await updateOvertimeStatus(id, newStatus);
  };

  const openBudgetModal = () => {
    setBudgetInput(new Intl.NumberFormat("id-ID").format(initialBudget));
    setIsBudgetModalOpen(true);
  };

  // --- EXPORT EXCEL ---
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const reportTitle = [
      ["LAPORAN KEUANGAN & OPERASIONAL - ROOTSLAB"],
      [`PERIODE: ${selectedMonth}`],
      [""],
    ];

    const summaryData = [
      ["RINGKASAN BUDGET", "", "", ""],
      ["Kategori", "Nilai (Rp)", "Status", "Keterangan"],
      ["Total Alokasi Budget", initialBudget, "Active", "Modal Awal"],
      ["Total Pengeluaran", totalExpenseAmount, "Used", "Operasional Kantor"],
      ["Total Lembur", totalOvertimeAmount, "Used", "SDM / Karyawan"],
      ["Total Terpakai (All)", grandTotalUsed, "", ""],
      [
        "SISA BUDGET AKHIR",
        sisaBudget,
        sisaBudget < 0 ? "OVERBUDGET" : "SAFE",
        "Saldo Akhir",
      ],
      ["", "", "", ""],
    ];

    const expenseHeader = [
      ["RINCIAN PENGELUARAN (EXPENSES)"],
      [
        "Tanggal",
        "Item Deskripsi",
        "Order By (Pemohon)",
        "Nominal (Rp)",
        "Status",
        "Catatan",
      ],
    ];

    const expenseRows = currentMonthExpenses.map((item) => [
      item.date,
      item.description,
      item.requester,
      item.amount,
      item.status,
      item.note || "-",
    ]);

    const overtimeHeader = [
      ["", "", "", "", "", ""],
      ["RINCIAN LEMBUR (OVERTIME)"],
      [
        "Tanggal",
        "Nama Karyawan",
        "Jumlah Hari",
        "Rate/Hari (Rp)",
        "Total (Rp)",
        "Status",
        "Catatan",
      ],
    ];

    const overtimeRows = currentMonthOvertimes.map((item) => [
      item.date,
      item.employee_name,
      item.days,
      item.rate,
      item.days * item.rate,
      item.status,
      item.note || "-",
    ]);

    const finalData = [
      ...reportTitle,
      ...summaryData,
      ...expenseHeader,
      ...expenseRows,
      ...overtimeHeader,
      ...overtimeRows,
      [""],
      ["Generated by RootsFinance System", new Date().toLocaleString()],
    ];

    const ws = XLSX.utils.aoa_to_sheet(finalData);

    ws["!cols"] = [
      { wch: 15 },
      { wch: 35 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
    ];

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Laporan Lengkap");
    XLSX.writeFile(wb, `Laporan_Keuangan_Roots_${selectedMonth}.xlsx`);
  };

  const getStatusColor = (status: string) => {
    if (!status) return "bg-slate-100 text-slate-600 border-slate-200";
    const normalized =
      status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    const styles: Record<string, string> = {
      Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Pending: "bg-slate-800 text-white border-slate-900",
      Rejected: "bg-red-100 text-red-700 border-red-200",
      Default: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return styles[normalized] || styles.Default;
  };

  if (!isMounted) return null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-sm`}
      >
        <div className="h-20 flex items-center justify-center border-b border-slate-100 p-4">
          {isSidebarOpen ? (
            <Image
              src="/logo.png"
              alt="Roots Lab"
              width={120}
              height={40}
              className="h-full w-auto object-contain"
              priority
            />
          ) : (
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-md">
              R
            </div>
          )}
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium cursor-pointer ${
              activeTab === "expenses"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Wallet size={20} /> {isSidebarOpen && "Pengeluaran"}
          </button>
          <button
            onClick={() => setActiveTab("overtime")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium cursor-pointer ${
              activeTab === "overtime"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Clock size={20} /> {isSidebarOpen && "Lembur"}
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium cursor-pointer ${
              activeTab === "stats"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <BarChart3 size={20} /> {isSidebarOpen && "Laporan"}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          {isSidebarOpen && (
            <div className="overflow-hidden text-center">
              <p className="text-xs text-slate-400">v1.2.0 Stable</p>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
            >
              <Menu size={22} />
            </button>

            <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <div className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:block">
                Periode
              </div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border-none text-slate-700 text-sm rounded-md focus:ring-0 block p-1.5 cursor-pointer hover:text-slate-900 font-medium shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg hover:shadow-emerald-200 cursor-pointer"
            >
              <FileSpreadsheet size={18} />
              <span className="hidden md:inline">Download Laporan</span>
            </button>

            <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>

            <button
              onClick={() => logout()}
              className="flex items-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium cursor-pointer"
            >
              <LogOut size={18} />
              <span className="hidden md:inline">Keluar</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "stats" ? (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* CHARTS SECTION */}
              <div className="flex justify-center mb-8">
                <div className="bg-white p-1.5 rounded-full border border-slate-200 shadow-sm inline-flex">
                  <button
                    onClick={() => setStatsSlide(0)}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                      statsSlide === 0
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Pengeluaran Harian
                  </button>
                  <button
                    onClick={() => setStatsSlide(1)}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                      statsSlide === 1
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Lembur Harian
                  </button>
                  <button
                    onClick={() => setStatsSlide(2)}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                      statsSlide === 2
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Gabungan
                  </button>
                </div>
              </div>

              {statsSlide === 0 && (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                      <Wallet size={20} />
                    </div>
                    Grafik Pengeluaran Harian ({selectedMonth})
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: "#f8fafc" }}
                        />
                        <Bar
                          dataKey="Pengeluaran"
                          fill="#6366f1"
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {statsSlide === 1 && (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                      <Clock size={20} />
                    </div>
                    Grafik Lembur Harian ({selectedMonth})
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="Lembur"
                          stroke="#f97316"
                          fill="#ffedd5"
                          strokeWidth={3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {statsSlide === 2 && (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                      <BarChart3 size={20} />
                    </div>
                    Analisis Gabungan ({selectedMonth})
                  </h3>
                  <div className="h-[400px] w-full mb-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" />
                        <Bar
                          dataKey="Pengeluaran"
                          fill="#6366f1"
                          stackId="a"
                          radius={[0, 0, 4, 4]}
                          barSize={40}
                        />
                        <Bar
                          dataKey="Lembur"
                          fill="#f97316"
                          stackId="a"
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                        <Line
                          type="monotone"
                          dataKey="Total"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            fill: "#10b981",
                            strokeWidth: 2,
                            stroke: "#fff",
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Total Terpakai
                      </p>
                      <p className="text-2xl font-bold text-slate-800">
                        {formatRupiah(grandTotalUsed)}
                      </p>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Sisa Budget Akhir
                      </p>
                      <p
                        className={`text-2xl font-bold ${
                          sisaBudget < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {formatRupiah(sisaBudget)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* STATS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      {activeTab === "expenses" ? (
                        <Wallet size={20} />
                      ) : (
                        <Clock size={20} />
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {activeTab === "expenses" ? "Pengeluaran" : "Lembur"}
                    </p>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">
                    {formatRupiah(currentMainStat)}
                  </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-800 rounded-lg text-white">
                      <Hourglass size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Pending Review
                    </p>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">
                    {currentPendingCount}{" "}
                    <span className="text-sm font-normal text-slate-400">
                      Item
                    </span>
                  </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`p-2 rounded-lg ${
                        sisaBudget < 0
                          ? "bg-red-50 text-red-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      <BarChart3 size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Sisa Budget (Global)
                    </p>
                  </div>
                  <h3
                    className={`text-2xl font-bold ${
                      sisaBudget < 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {formatRupiah(sisaBudget)}
                  </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                      <Wallet size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Budget (Global)
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <h3 className="text-2xl font-bold text-slate-800">
                      {formatRupiah(initialBudget)}
                    </h3>
                    <button
                      onClick={openBudgetModal}
                      className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 cursor-pointer"
                    >
                      <Edit3 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* TABEL DATA */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                  <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    {activeTab === "expenses"
                      ? "📋 Daftar Pengeluaran"
                      : "📋 Daftar Lembur Karyawan"}
                    <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full ml-2">
                      {selectedMonth}
                    </span>
                  </h2>

                  <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="text"
                        placeholder="Cari data..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={() => {
                        setEditingId(null);
                        setAmountInput("");
                        setIsModalOpen(true);
                      }}
                      className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md hover:shadow-slate-200 whitespace-nowrap cursor-pointer"
                    >
                      <Plus size={18} /> Tambah
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4 border-b border-slate-100">
                          Date
                        </th>
                        <th className="px-6 py-4 border-b border-slate-100">
                          {activeTab === "expenses"
                            ? "Item Desc"
                            : "Nama Karyawan"}
                        </th>
                        {activeTab === "expenses" && (
                          <th className="px-6 py-4 border-b border-slate-100">
                            Order By
                          </th>
                        )}
                        {activeTab === "overtime" && (
                          <>
                            <th className="px-6 py-4 border-b border-slate-100">
                              Hari
                            </th>
                            <th className="px-6 py-4 border-b border-slate-100">
                              Rate
                            </th>
                          </>
                        )}
                        <th className="px-6 py-4 border-b border-slate-100">
                          {activeTab === "expenses" ? "Amount" : "Total"}
                        </th>
                        <th className="px-6 py-4 border-b border-slate-100">
                          Status
                        </th>
                        <th className="px-6 py-4 border-b border-slate-100">
                          Note
                        </th>
                        <th className="px-6 py-4 border-b border-slate-100 text-center">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedData.map((item: Expense | Overtime) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                            {item.date}
                          </td>
                          {isExpense(item) ? (
                            <>
                              <td className="px-6 py-4 font-medium text-slate-800">
                                {item.description}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200">
                                    {item.requester.charAt(0)}
                                  </div>
                                  {item.requester}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-800">
                                {formatRupiah(item.amount)}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 py-4 font-medium text-slate-800">
                                {item.employee_name}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {item.days}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {formatRupiah(item.rate)}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-800">
                                {formatRupiah(item.days * item.rate)}
                              </td>
                            </>
                          )}

                          <td className="px-6 py-4">
                            <select
                              value={item.status}
                              onChange={(e) =>
                                handleStatusChange(item.id, e.target.value)
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase border cursor-pointer outline-none appearance-none hover:brightness-95 transition-all ${getStatusColor(
                                item.status
                              )}`}
                            >
                              <option value="Default">Default</option>
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs max-w-[150px] truncate">
                            {item.note || "-"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditClick(item)}
                                className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors cursor-pointer"
                                title="Edit Data"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Data"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white">
                    <div className="text-sm text-slate-500">
                      Menampilkan{" "}
                      <span className="font-bold">{paginatedData.length}</span>{" "}
                      dari{" "}
                      <span className="font-bold">
                        {currentDataList.length}
                      </span>{" "}
                      data
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className="p-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="px-4 py-2 bg-slate-50 border rounded-lg text-sm text-slate-600">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, totalPages)
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="p-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL EDIT BUDGET */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Edit Alokasi Budget</h3>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateBudget} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                  Total Budget (Rp)
                </label>
                <input
                  required
                  name="budget"
                  type="text"
                  value={budgetInput}
                  onChange={(e) => handleNumberChange(e, setBudgetInput)}
                  className="w-full border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xl text-slate-800"
                />
              </div>
              <button
                disabled={isSubmitting}
                className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 flex justify-center items-center gap-2 mt-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  "Simpan Perubahan"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH/EDIT DATA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingId
                  ? `Edit ${
                      activeTab === "expenses" ? "Pengeluaran" : "Lembur"
                    }`
                  : `Tambah ${
                      activeTab === "expenses" ? "Pengeluaran" : "Lembur"
                    }`}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Tanggal
                </label>
                <input
                  required
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {activeTab === "expenses" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                      Nominal (Rp)
                    </label>
                    <input
                      required
                      name="amount"
                      type="text"
                      placeholder="0"
                      value={amountInput}
                      onChange={(e) => handleNumberChange(e, setAmountInput)}
                      className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                      Item Description
                    </label>
                    <input
                      required
                      name="description"
                      type="text"
                      className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                      Order By
                    </label>
                    <input
                      required
                      name="requester"
                      type="text"
                      className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </>
              )}

              {activeTab === "overtime" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                      Nama Karyawan
                    </label>
                    <input
                      required
                      name="employee_name"
                      type="text"
                      className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                        Jumlah Hari
                      </label>
                      <input
                        required
                        name="days"
                        type="number"
                        placeholder="0"
                        className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                        Rate / Hari (Rp)
                      </label>
                      <input
                        required
                        name="rate"
                        type="text"
                        placeholder="0"
                        value={amountInput}
                        onChange={(e) => handleNumberChange(e, setAmountInput)}
                        className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue="Default"
                  className="w-full border border-slate-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="Default">Default (Abu-abu)</option>
                  <option value="Pending">Pending (Hitam)</option>
                  <option value="Approved">Approved (Hijau)</option>
                  <option value="Rejected">Rejected (Merah)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Note
                </label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full border border-slate-300 p-2.5 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                ></textarea>
              </div>

              <button
                disabled={isSubmitting}
                className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 flex justify-center items-center gap-2 mt-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : editingId ? (
                  "Update Data"
                ) : (
                  "Simpan Data"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
