import React, { useEffect, useState } from "react";

// Tell TypeScript that window can have XLSX
useEffect(() => {
  if (window.XLSX) {
    setSheetJsLoaded(true);
    return;
  }
  const id = "sheetjs-script";
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
  s.onload = () => setSheetJsLoaded(true);
  s.onerror = () => setSheetJsLoaded(false);
  document.body.appendChild(s);
}, []);

// Add Tailwind CDN dynamically
const addTailwindCDN = () => {
  const script = document.createElement("script");
  script.src = "https://cdn.tailwindcss.com";
  script.async = true;
  document.head.appendChild(script);
};
addTailwindCDN();
// DiaryApp.jsx
// Single-file React component for a simple diary tracker with Excel export.
// Usage: paste into a React project (Vite/CRA) as a component and render it.

export default function DiaryApp() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [activity, setActivity] = useState("");
  const [entries, setEntries] = useState(() => {
    try {
      const raw = localStorage.getItem("diary_entries_v1");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [filterDate, setFilterDate] = useState("");
  const [sheetJsLoaded, setSheetJsLoaded] = useState(false);

  // Load SheetJS from CDN for Excel export (window.XLSX)
  useEffect(() => {
    if (window.XLSX) {
      setSheetJsLoaded(true);
      return;
    }
    const id = "sheetjs-script";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
    s.onload = () => setSheetJsLoaded(true);
    s.onerror = () => setSheetJsLoaded(false);
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    localStorage.setItem("diary_entries_v1", JSON.stringify(entries));
  }, [entries]);

  function resetForm() {
    setStartTime("09:00");
    setEndTime("10:00");
    setActivity("");
  }

  function durationMinutes(s, e) {
    const [sh, sm] = s.split(":").map(Number);
    const [eh, em] = e.split(":").map(Number);
    let start = sh * 60 + sm;
    let end = eh * 60 + em;
    // assume same day; if end < start, treat as next day
    if (end < start) end += 24 * 60;
    return end - start;
  }

  function addEntry() {
    if (!activity.trim()) {
      alert("Isi kegiatan dulu (activity cannot be empty)");
      return;
    }
    if (!startTime || !endTime) {
      alert("Pilih jam mulai dan jam selesai");
      return;
    }
    const minutes = durationMinutes(startTime, endTime);
    const newEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      date,
      start: startTime,
      end: endTime,
      duration_min: minutes,
      activity: activity.trim(),
    };
    setEntries((p) => [newEntry, ...p]);
    resetForm();
  }

  function removeEntry(id) {
    if (!confirm("Hapus entry ini?")) return;
    setEntries((p) => p.filter((x) => x.id !== id));
  }

  function editEntry(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    setDate(e.date);
    setStartTime(e.start);
    setEndTime(e.end);
    setActivity(e.activity);
    // remove the entry we are going to re-add on save
    setEntries((p) => p.filter((x) => x.id !== id));
  }

  function downloadCSV(rows, filename = "diary.csv") {
    const header = ["Date", "Start", "End", "Duration (min)", "Activity"];
    const lines = [header.join(",")];
    for (const r of rows) {
      // escape quotes and commas in activity
      const act = '"' + (r.activity || "").replace(/"/g, '""') + '"';
      lines.push(
        [r.date, r.start, r.end, String(r.duration_min), act].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportToExcel(rows, filename = "diary.xlsx") {
    if (!sheetJsLoaded || !window.XLSX) {
      // fallback to CSV
      downloadCSV(rows, filename.replace(/\.xlsx$/, ".csv"));
      return;
    }
    // prepare worksheet data (array of arrays or array of objects)
    // Use objects for nicer column ordering
    const data = rows.map((r) => ({
      Date: r.date,
      Start: r.start,
      End: r.end,
      "Duration (min)": r.duration_min,
      Activity: r.activity,
    }));
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Diary");
    window.XLSX.writeFile(wb, filename);
  }

  const filteredEntries = filterDate
    ? entries.filter((e) => e.date === filterDate)
    : entries;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Diary Harian</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <label className="block">
            <div className="text-sm text-gray-600">Tanggal</div>
            <input
              className="mt-1 w-full border rounded p-2"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600">Mulai</div>
            <input
              className="mt-1 w-full border rounded p-2"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600">Selesai</div>
            <input
              className="mt-1 w-full border rounded p-2"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>

          <div className="flex items-end">
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2"
              onClick={addEntry}
            >
              Tambah Kegiatan
            </button>
          </div>
        </div>

        <label className="block mb-4">
          <div className="text-sm text-gray-600">Deskripsi Kegiatan</div>
          <textarea
            className="mt-1 w-full border rounded p-2"
            rows={3}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Contoh: Menulis laporan, Olahraga, Belajar..."
          />
        </label>

        <div className="flex gap-2 items-center mb-4 flex-wrap">
          <label className="text-sm">
            Filter tanggal untuk export / tampilkan:
          </label>
          <input
            type="date"
            className="border rounded p-1"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <button
            className="bg-green-600 hover:bg-green-700 text-white rounded px-3 py-1"
            onClick={() =>
              exportToExcel(
                filterDate
                  ? entries.filter((e) => e.date === filterDate)
                  : entries,
                filterDate ? `diary-${filterDate}.xlsx` : `diary-all.xlsx`
              )
            }
          >
            Download Excel
          </button>
          <button
            className="bg-gray-600 hover:bg-gray-700 text-white rounded px-3 py-1"
            onClick={() =>
              downloadCSV(
                filterDate
                  ? entries.filter((e) => e.date === filterDate)
                  : entries,
                filterDate ? `diary-${filterDate}.csv` : `diary-all.csv`
              )
            }
          >
            Download CSV
          </button>
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-white rounded px-3 py-1"
            onClick={() => {
              setFilterDate("");
            }}
          >
            Clear Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border">Tanggal</th>
                <th className="p-2 border">Mulai</th>
                <th className="p-2 border">Selesai</th>
                <th className="p-2 border">Durasi (menit)</th>
                <th className="p-2 border">Kegiatan</th>
                <th className="p-2 border">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    Belum ada kegiatan.
                  </td>
                </tr>
              )}
              {filteredEntries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="p-2 border align-top">{e.date}</td>
                  <td className="p-2 border align-top">{e.start}</td>
                  <td className="p-2 border align-top">{e.end}</td>
                  <td className="p-2 border align-top">{e.duration_min}</td>
                  <td className="p-2 border align-top whitespace-pre-wrap">
                    {e.activity}
                  </td>
                  <td className="p-2 border align-top">
                    <div className="flex gap-2">
                      <button
                        className="text-sm px-2 py-1 bg-yellow-400 rounded"
                        onClick={() => editEntry(e.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm px-2 py-1 bg-red-500 text-white rounded"
                        onClick={() => removeEntry(e.id)}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Data disimpan otomatis di browser (localStorage). Gunakan tombol
          Download untuk mengekspor ke Excel/CSV.
        </div>
      </div>
    </div>
  );
}
