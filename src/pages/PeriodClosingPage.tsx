/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  Calendar,
  X,
  FileText,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { getIndoMonthName, MONTH_NAMES_INDO, formatDateIndo, getYmdYear, getYmdMonth } from '../lib/formatters';
import { PeriodClosing } from '../types/database';

export const PeriodClosingPage: React.FC = () => {
  const { kasList, transactions, periodClosings, closePeriod, reopenPeriod, settings, fiscalYears } = useData();
  const { currentUser, isBendaharaUmum, isAdmin } = useAuth();

  const [selectedYear, setSelectedYear] = useState<number>(settings.active_year || 2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [targetKasId, setTargetKasId] = useState<string>('all'); // 'all' or specific kasId

  const [isClosingSubmitting, setIsClosingSubmitting] = useState<boolean>(false);
  const [closingError, setClosingError] = useState<string>('');
  const [closingSuccess, setClosingSuccess] = useState<string>('');

  // Reopen modal state
  const [reopenTargetClosing, setReopenTargetClosing] = useState<PeriodClosing | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [reopenError, setReopenError] = useState<string>('');

  // 1. Completeness inspection: check for each Kas whether it has Drafts or Submitted transactions in this period
  const completenessInspection = kasList.map((k) => {
    const periodTx = transactions.filter((tx) => {
      return (
        tx.kas_id === k.id &&
        getYmdYear(tx.tanggal) === selectedYear &&
        getYmdMonth(tx.tanggal) === selectedMonth
      );
    });

    const drafts = periodTx.filter((tx) => tx.status === 'draft').length;
    const submitted = periodTx.filter((tx) => tx.status === 'submitted').length;
    const approved = periodTx.filter((tx) => tx.status === 'approved').length;
    const rejected = periodTx.filter((tx) => tx.status === 'rejected').length;

    const isComplete = drafts === 0 && submitted === 0;

    return {
      kas: k,
      drafts,
      submitted,
      approved,
      rejected,
      isComplete,
      total: periodTx.length,
    };
  });

  const totalIncompleteKas = completenessInspection.filter((c) => !c.isComplete).length;
  const targetIncompleteCount =
    targetKasId === 'all'
      ? totalIncompleteKas
      : completenessInspection.filter((c) => c.kas.id === targetKasId && !c.isComplete).length;
  const isPeriodAlreadyClosed = periodClosings.some(
    (pc) =>
      pc.is_closed &&
      pc.tahun === selectedYear &&
      pc.bulan === selectedMonth &&
      (targetKasId === 'all'
        ? pc.kas_id === null || pc.kas_id === undefined
        : pc.kas_id === targetKasId || pc.kas_id === null || pc.kas_id === undefined)
  );

  const handleClosePeriod = async () => {
    setClosingError('');
    setClosingSuccess('');
    setIsClosingSubmitting(true);

    const kasArg = targetKasId === 'all' ? null : targetKasId;
    const res = await closePeriod(selectedYear, selectedMonth, kasArg);

    setIsClosingSubmitting(false);

    if (!res.success) {
      setClosingError(res.error || 'Gagal menutup buku periode.');
    } else {
      setClosingSuccess(
        `Buku kas periode ${getIndoMonthName(selectedMonth)} ${selectedYear} berhasil ditutup dan seluruh transaksi terkunci.`
      );
      setTimeout(() => setClosingSuccess(''), 5000);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTargetClosing) return;

    if (!reopenReason.trim()) {
      setReopenError('Alasan pembukaan kembali buku kas wajib diisi untuk catatan audit.');
      return;
    }

    const res = await reopenPeriod(reopenTargetClosing.id, reopenReason);
    if (!res.success) {
      setReopenError(res.error || 'Gagal membuka kembali buku kas.');
    } else {
      setClosingSuccess(
        `Buku kas periode ${getIndoMonthName(reopenTargetClosing.bulan)} ${reopenTargetClosing.tahun} berhasil dibuka kembali.`
      );
      setReopenTargetClosing(null);
      setReopenReason('');
      setReopenError('');
      setTimeout(() => setClosingSuccess(''), 5000);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Penutupan Buku Bulanan
        </h1>
        <p className="text-xs text-slate-500">
          Kunci transaksi bulanan setelah seluruh mutasi kas disetujui
        </p>
      </div>

      {closingSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{closingSuccess}</span>
        </div>
      )}

      {closingError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{closingError}</span>
        </div>
      )}

      {/* Control & Inspection Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          {/* Selectors */}
          <div className="grid grid-cols-1 sm:flex sm:items-center gap-3 flex-wrap w-full sm:w-auto">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Bulan Buku
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full sm:w-auto text-xs p-2.5 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
              >
                {MONTH_NAMES_INDO.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tahun
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full sm:w-auto text-xs p-2.5 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
              >
                {fiscalYears && fiscalYears.length > 0 ? (
                  fiscalYears.map((fy) => (
                    <option key={fy.id} value={fy.year}>
                      {fy.year} {fy.year === settings.active_year ? '(Aktif)' : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Target Kas
              </label>
              <select
                value={targetKasId}
                onChange={(e) => setTargetKasId(e.target.value)}
                className="w-full sm:w-auto text-xs p-2.5 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
              >
                <option value="all">Semua Kas Seksi (Global)</option>
                {kasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama} ({k.kode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action button to lock */}
          <div className="w-full sm:w-auto">
            {!isAdmin && !isBendaharaUmum ? (
              <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] sm:min-h-0 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Wewenang Khusus Bendahara Umum & Admin</span>
              </div>
            ) : isPeriodAlreadyClosed ? (
              <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] sm:min-h-0 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Periode Ini Sudah Ditutup</span>
              </div>
            ) : (
              <button
                disabled={isClosingSubmitting || targetIncompleteCount > 0}
                onClick={handleClosePeriod}
                className={`w-full sm:w-auto px-5 py-2.5 min-h-[44px] sm:min-h-0 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 ${
                  targetIncompleteCount > 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark text-white'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Tutup Buku Periode Ini</span>
              </button>
            )}
          </div>
        </div>

        {/* Pre-closing Completeness Inspection Panel */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pemeriksaan Kelengkapan Catatan Kas per Seksi ({getIndoMonthName(selectedMonth)} {selectedYear})
            </h3>
            {totalIncompleteKas > 0 ? (
              <span className="text-xs text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1 self-start sm:self-auto">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{totalIncompleteKas} Seksi Belum Selesai</span>
              </span>
            ) : (
              <span className="text-xs text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1 self-start sm:self-auto">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Semua Kas Lengkap & Siap Ditutup</span>
              </span>
            )}
          </div>

          {/* Mobile Cards for Completeness Inspection */}
          <div className="md:hidden space-y-2.5">
            {completenessInspection.map((item) => (
              <div key={item.kas.id} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 block">{item.kas.nama}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.kas.kode}</span>
                  </div>
                  {item.isComplete ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 text-[11px] shrink-0">
                      <CheckCircle className="w-3 h-3" />
                      <span>Lengkap</span>
                    </span>
                  ) : (
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 text-[11px] shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Belum Selesai</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center pt-2 border-t border-slate-200/60">
                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="block text-[10px] text-slate-400">Draf</span>
                    <span className={`font-mono font-bold ${item.drafts > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {item.drafts}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="block text-[10px] text-slate-400">Diajukan</span>
                    <span className={`font-mono font-bold ${item.submitted > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                      {item.submitted}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="block text-[10px] text-slate-400">Disetujui</span>
                    <span className="font-mono font-bold text-emerald-700">{item.approved}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    <span className="block text-[10px] text-slate-400">Ditolak</span>
                    <span className="font-mono font-bold text-rose-600">{item.rejected}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Nama Kas</th>
                  <th className="py-2.5 px-3 text-center">Draft (Draf)</th>
                  <th className="py-2.5 px-3 text-center">Diajukan</th>
                  <th className="py-2.5 px-3 text-center">Disetujui</th>
                  <th className="py-2.5 px-3 text-center">Ditolak</th>
                  <th className="py-2.5 px-3 text-center">Status Kelayakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completenessInspection.map((item) => (
                  <tr key={item.kas.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-800">{item.kas.nama}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{item.kas.kode}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {item.drafts > 0 ? (
                        <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                          {item.drafts} draf
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {item.submitted > 0 ? (
                        <span className="text-blue-800 font-bold bg-blue-100 px-2 py-0.5 rounded-md">
                          {item.submitted} menunggu
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-700 font-semibold">
                      {item.approved}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-rose-600">
                      {item.rejected}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {item.isComplete ? (
                        <span className="text-emerald-700 font-semibold inline-flex items-center gap-1 text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Lengkap</span>
                        </span>
                      ) : (
                        <span className="text-amber-800 font-semibold inline-flex items-center gap-1 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Ada Draf / Menunggu</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Historical Closings Table & Mobile Cards */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Riwayat Penutupan Buku Kas (Audit Log)</h3>

        {/* Mobile Cards for Historical Closings */}
        <div className="md:hidden space-y-2.5">
          {periodClosings.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada catatan penutupan buku.
            </div>
          ) : (
            periodClosings.map((pc) => {
              const kas = kasList.find((k) => k.id === pc.kas_id);

              return (
                <div key={pc.id} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {getIndoMonthName(pc.bulan)} {pc.tahun}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {kas ? kas.nama : 'Seluruh Kas (Konsolidasi)'}
                      </span>
                    </div>
                    {pc.is_closed ? (
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-slate-800 text-white inline-flex items-center gap-1 shrink-0">
                        <Lock className="w-3 h-3" />
                        <span>Terkunci</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1 shrink-0">
                        <Unlock className="w-3 h-3" />
                        <span>Dibuka Kembali</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Ditutup Pada</span>
                    <span className="font-mono">{formatDateIndo(pc.closed_at)}</span>
                  </div>

                  {pc.reopen_reason && (
                    <div className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200/60">
                      Buka: {pc.reopen_reason}
                    </div>
                  )}

                  {pc.is_closed && (isBendaharaUmum || isAdmin) && (
                    <button
                      onClick={() => {
                        setReopenTargetClosing(pc);
                        setReopenReason('');
                        setReopenError('');
                      }}
                      className="w-full min-h-[44px] px-3 py-2 text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Buka Kembali</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-3">Periode</th>
                <th className="py-3 px-3">Cakupan Kas</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Ditutup Pada</th>
                <th className="py-3 px-3">Catatan / Alasan Buka</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periodClosings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada catatan penutupan buku.
                  </td>
                </tr>
              ) : (
                periodClosings.map((pc) => {
                  const kas = kasList.find((k) => k.id === pc.kas_id);

                  return (
                    <tr key={pc.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {getIndoMonthName(pc.bulan)} {pc.tahun}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {kas ? kas.nama : 'Seluruh Kas (Konsolidasi)'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {pc.is_closed ? (
                          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-slate-800 text-white inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Terkunci</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                            <Unlock className="w-3 h-3" />
                            <span>Dibuka Kembali</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatDateIndo(pc.closed_at)}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {pc.reopen_reason ? (
                          <span className="text-amber-800 font-medium">Buka: {pc.reopen_reason}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {pc.is_closed && (isBendaharaUmum || isAdmin) && (
                          <button
                            onClick={() => {
                              setReopenTargetClosing(pc);
                              setReopenReason('');
                              setReopenError('');
                            }}
                            className="px-3 py-1.5 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Buka Kembali</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Reopen Period */}
      {reopenTargetClosing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92dvh] overflow-y-auto shadow-2xl border border-slate-100 mobile-sheet-enter">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-amber-100 bg-amber-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <Unlock className="w-5 h-5 text-amber-700 shrink-0" />
                <span>Buka Kembali Buku Kas Terkunci</span>
              </div>
              <button
                onClick={() => setReopenTargetClosing(null)}
                className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleReopenSubmit}
              className="p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4 text-xs"
            >
              <p className="text-slate-600">
                Membuka kembali buku periode <strong>{getIndoMonthName(reopenTargetClosing.bulan)} {reopenTargetClosing.tahun}</strong>{' '}
                akan mengizinkan penginputan koreksi baru. Tindakan ini wajib menyertakan alasan yang sah dan akan dicatat dalam audit trail.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Pembukaan Kembali <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Koreksi selisih persembahan pesta pembangunan atas persetujuan Pendeta Ressort..."
                  className="w-full p-3 sm:p-2.5 rounded-xl border border-slate-200"
                  required
                />
                {reopenError && <p className="text-rose-500 mt-1">{reopenError}</p>}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReopenTargetClosing(null)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] sm:min-h-0 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl border border-slate-200 sm:border-transparent"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] sm:min-h-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-xs"
                >
                  Buka Kunci Buku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
