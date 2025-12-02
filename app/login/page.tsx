"use client";

import { useState } from "react";
import { login } from "@/app/actions";
import { Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setErrorMsg("");

    // FIX: Hapus ": any" agar linter tidak marah
    const result = await login(formData);

    // Cek apakah ada pesan error dari server
    if (result?.message) {
      setErrorMsg("Email atau Password salah.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-100 p-3 rounded-full">
            <Lock className="text-indigo-600 w-8 h-8" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
          Admin Login
        </h2>
        <p className="text-sm text-slate-500 text-center mb-8">
          Masuk untuk mengelola keuangan.
        </p>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full border border-slate-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="admin@kantor.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full border border-slate-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center">
              {errorMsg}
            </div>
          )}

          <button
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Masuk Dashboard"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
