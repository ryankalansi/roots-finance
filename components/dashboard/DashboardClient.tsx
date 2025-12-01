"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
        <p className="text-sm font-bold text-slate-700 mb-2">{label}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
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

  // STATE BARU: PILIH BULAN (ARCHIVE & CURRENT)
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // --- 1. FILTER UTAMA BERDASARKAN BULAN ---
  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((item) => item.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const currentMonthOvertimes = useMemo(() => {
    return overtimes.filter((item) => item.date.startsWith(selectedMonth));
  }, [overtimes, selectedMonth]);

  // --- 2. FILTER PENCARIAN ---
  const filteredExpenses = currentMonthExpenses.filter(
    (item) =>
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.requester.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOvertimes = currentMonthOvertimes.filter((item) =>
    item.employee_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- 3. DATA PROCESSING CHART ---
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

  // --- 4. KALKULASI STATISTIK ---
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    if (activeTab === "expenses") await addExpense(formData);
    else await addOvertime(formData);

    setIsSubmitting(false);
    setIsModalOpen(false);
    setAmountInput("");
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

  // --- FITUR DOWNLOAD EXCEL ---
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. SUMMARY SHEET
    const summaryRows = [
      ["LAPORAN KEUANGAN BULANAN", ""],
      ["Periode", selectedMonth],
      ["", ""],
      ["KETERANGAN", "NOMINAL (Rp)"],
      ["Total Alokasi Budget", initialBudget],
      ["Total Pengeluaran Operasional", totalExpenseAmount],
      ["Total Biaya Lembur", totalOvertimeAmount],
      ["Total Terpakai (All)", grandTotalUsed],
      ["Sisa Budget Akhir", sisaBudget],
      ["", ""],
      ["Tanggal Download", new Date().toLocaleString()],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 35 }, { wch: 25 }];

    // 2. EXPENSE SHEET
    const expenseData = currentMonthExpenses.map((item) => ({
      "Tanggal": item.date,
      "Deskripsi Item": item.description,
      "Pemohon": item.requester,
      "Nominal (Rp)": item.amount,
      "Status": item.status,
      "Catatan": item.note || "-",
    }));
    const wsExpense = XLSX.utils.json_to_sheet(expenseData);
    wsExpense["!cols"] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
    ];

    // 3. OVERTIME SHEET
    const overtimeData = currentMonthOvertimes.map((item) => ({
      "Tanggal": item.date,
      "Nama Karyawan": item.employee_name,
      "Jumlah Hari": item.days,
      "Rate Harian (Rp)": item.rate,
      "Total (Rp)": item.days * item.rate,
      "Status": item.status,
      "Catatan": item.note || "-",
    }));
    const wsOvertime = XLSX.utils.json_to_sheet(overtimeData);
    wsOvertime["!cols"] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
    XLSX.utils.book_append_sheet(wb, wsExpense, "Pengeluaran");
    XLSX.utils.book_append_sheet(wb, wsOvertime, "Lembur");

    XLSX.writeFile(wb, `Laporan_Keuangan_Roots_${selectedMonth}.xlsx`);
  };

  const getStatusColor = (status: string) => {
    if (!status) return "bg-slate-100 text-slate-600 border-slate-200";
    const normalized =
      status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    const styles: Record<string, string> = {
      Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
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
        } bg-slate-900 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        <div className="h-16 flex items-center justify-center border-b border-slate-800 font-bold text-xl text-indigo-400 gap-2">
          <LayoutDashboard /> {isSidebarOpen && "ROOTS"}
        </div>
        <nav className="p-4 space-y-2">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeTab === "expenses"
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-800 text-slate-400"
            }`}
          >
            <Wallet size={20} /> {isSidebarOpen && "Pengeluaran"}
          </button>
          <button
            onClick={() => setActiveTab("overtime")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeTab === "overtime"
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-800 text-slate-400"
            }`}
          >
            <Clock size={20} /> {isSidebarOpen && "Lembur"}
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeTab === "stats"
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-800 text-slate-400"
            }`}
          >
            <BarChart3 size={20} /> {isSidebarOpen && "Laporan"}
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded"
            >
              <Menu size={20} />
            </button>

            {/* AREA JUDUL & FILTER PERIODE (ARCHIVE) */}
            <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-lg">
              <div className="px-3 text-sm font-bold text-slate-600 hidden md:block">
                Periode:
              </div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-1.5 cursor-pointer hover:bg-slate-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* TOMBOL EXPORT EXCEL (ARCHIVED) */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <FileSpreadsheet size={18} />
              <span className="hidden md:inline">Download Laporan</span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>
            <div className="text-sm font-semibold text-slate-500">Admin</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {/* KONTEN TAB STATISTIK */}
          {activeTab === "stats" ? (
            <div className="space-y-6">
              {/* Navigation Slide */}
              <div className="flex justify-center mb-4">
                <div className="bg-white p-1 rounded-full border border-slate-200 shadow-sm inline-flex">
                  <button
                    onClick={() => setStatsSlide(0)}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                      statsSlide === 0
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Pengeluaran Harian
                  </button>
                  <button
                    onClick={() => setStatsSlide(1)}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                      statsSlide === 1
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Lembur Harian
                  </button>
                  <button
                    onClick={() => setStatsSlide(2)}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                      statsSlide === 2
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Gabungan
                  </button>
                </div>
              </div>

              {/* SLIDE 1: PENGELUARAN */}
              {statsSlide === 0 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Wallet className="text-indigo-600" /> Grafik Harian Bulan{" "}
                    {selectedMonth}
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar
                          dataKey="Pengeluaran"
                          fill="#4f46e5"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* SLIDE 2: LEMBUR */}
              {statsSlide === 1 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Clock className="text-orange-500" /> Grafik Harian Bulan{" "}
                    {selectedMonth}
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="Lembur"
                          stroke="#f97316"
                          fill="#fb923c"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* SLIDE 3: MIX (GABUNGAN) */}
              {statsSlide === 2 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BarChart3 className="text-emerald-600" /> Analisis Gabungan{" "}
                    {selectedMonth}
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar
                          dataKey="Pengeluaran"
                          fill="#4f46e5"
                          stackId="a"
                          radius={[0, 0, 4, 4]}
                        />
                        <Bar
                          dataKey="Lembur"
                          fill="#f97316"
                          stackId="a"
                          radius={[4, 4, 0, 0]}
                        />
                        <Line
                          type="monotone"
                          dataKey="Total"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">
                        Total Terpakai ({selectedMonth})
                      </p>
                      <p className="text-2xl font-bold text-slate-800">
                        {formatRupiah(grandTotalUsed)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-bold uppercase">
                        Sisa Budget (Bulan Ini)
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
            // KONTEN TAB PENGELUARAN & LEMBUR
            <>
              {/* STATS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {activeTab === "expenses"
                      ? "Pengeluaran Bulan Ini"
                      : "Lembur Bulan Ini"}
                  </p>
                  <h3 className="text-2xl font-bold mt-2 text-slate-800">
                    {formatRupiah(currentMainStat)}
                  </h3>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Pending ({selectedMonth})
                  </p>
                  <h3 className="text-2xl font-bold mt-2 text-yellow-600">
                    {currentPendingCount} Item
                  </h3>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Sisa Budget
                  </p>
                  <h3
                    className={`text-2xl font-bold mt-2 ${
                      sisaBudget < 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {formatRupiah(sisaBudget)}
                  </h3>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Pagu Budget Bulanan
                  </p>
                  <div className="flex justify-between items-end">
                    <h3 className="text-2xl font-bold mt-2 text-indigo-600">
                      {formatRupiah(initialBudget)}
                    </h3>
                    <button
                      onClick={openBudgetModal}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Edit3 size={16} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* TABEL DATA */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50 rounded-t-xl">
                  <h2 className="font-bold text-lg text-slate-800">
                    {activeTab === "expenses"
                      ? `Pengeluaran ${selectedMonth}`
                      : `Lembur ${selectedMonth}`}
                  </h2>

                  <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="text"
                        placeholder="Cari..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <Plus size={16} /> Tambah Data
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                      <tr>
                        <th className="px-6 py-4 border-b">Date</th>
                        <th className="px-6 py-4 border-b">
                          {activeTab === "expenses"
                            ? "Item Desc"
                            : "Nama Karyawan"}
                        </th>

                        {activeTab === "expenses" && (
                          <th className="px-6 py-4 border-b">Order By</th>
                        )}

                        {activeTab === "overtime" && (
                          <>
                            <th className="px-6 py-4 border-b">Hari</th>
                            <th className="px-6 py-4 border-b">Rate/Hari</th>
                          </>
                        )}

                        <th className="px-6 py-4 border-b">
                          {activeTab === "expenses" ? "Amount" : "Total"}
                        </th>
                        <th className="px-6 py-4 border-b">Status</th>
                        <th className="px-6 py-4 border-b">Note</th>
                        <th className="px-6 py-4 border-b text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeTab === "expenses"
                        ? filteredExpenses.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                {item.date}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-900">
                                {item.description}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">
                                    {item.requester.charAt(0)}
                                  </div>
                                  {item.requester}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-800">
                                {formatRupiah(item.amount)}
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  value={item.status}
                                  onChange={(e) =>
                                    handleStatusChange(item.id, e.target.value)
                                  }
                                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase border cursor-pointer outline-none appearance-none hover:opacity-90 transition-all ${getStatusColor(
                                    item.status
                                  )}`}
                                >
                                  <option value="Default">Default</option>
                                  <option value="Pending">Pending</option>
                                  <option value="Approved">Approved</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              </td>
                              <td className="px-6 py-4 text-slate-400 italic text-xs max-w-[150px] truncate">
                                {item.note || "-"}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        : filteredOvertimes.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                {item.date}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-900">
                                {item.employee_name}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {item.days} Hari
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {formatRupiah(item.rate)}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-800">
                                {formatRupiah(item.days * item.rate)}
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  value={item.status}
                                  onChange={(e) =>
                                    handleStatusChange(item.id, e.target.value)
                                  }
                                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase border cursor-pointer outline-none appearance-none hover:opacity-90 transition-all ${getStatusColor(
                                    item.status
                                  )}`}
                                >
                                  <option value="Default">Default</option>
                                  <option value="Pending">Pending</option>
                                  <option value="Approved">Approved</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              </td>
                              <td className="px-6 py-4 text-slate-400 italic text-xs max-w-[150px] truncate">
                                {item.note || "-"}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}

                      {activeTab === "expenses" &&
                        filteredExpenses.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="p-10 text-center text-slate-400"
                            >
                              Belum ada data di bulan {selectedMonth}.
                            </td>
                          </tr>
                        )}
                      {activeTab === "overtime" &&
                        filteredOvertimes.length === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="p-10 text-center text-slate-400"
                            >
                              Belum ada data lembur di bulan {selectedMonth}.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL EDIT BUDGET & ADD EXPENSE (Sama seperti sebelumnya) */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">
                Edit Alokasi Budget Bulanan
              </h3>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateBudget} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Total Budget (Rp)
                </label>
                <input
                  required
                  name="budget"
                  type="text"
                  value={budgetInput}
                  onChange={(e) => handleNumberChange(e, setBudgetInput)}
                  className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
                />
              </div>
              <button
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-slate-300 flex justify-center items-center gap-2 mt-2"
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">
                {activeTab === "expenses"
                  ? "Tambah Pengeluaran"
                  : "Catat Lembur"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* TANGGAL (SHARED) - Default ke Tanggal Hari Ini tapi bisa pilih tanggal di bulan lain */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Tanggal
                </label>
                <input
                  required
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* INPUT KHUSUS EXPENSES */}
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
                      className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
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
                      className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
                      className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </>
              )}

              {/* INPUT KHUSUS OVERTIME */}
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
                      className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
                        className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
                        className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* STATUS & NOTE (SHARED) */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue="Default"
                  className="w-full border border-slate-300 p-2 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="Default">Default (Abu-abu)</option>
                  <option value="Pending">Pending (Kuning)</option>
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
                  className="w-full border border-slate-300 p-2 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                ></textarea>
              </div>

              <button
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-slate-300 flex justify-center items-center gap-2 mt-2"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
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
