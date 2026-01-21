// src/App.tsx
import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

import { signInAnonymously } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";

/* ================= TYPES ================= */

interface Activity {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
}

/* ================= APP ================= */

function App() {
  /* ---------- AUTH ---------- */
  const [username, setUsername] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  /* ---------- DIARY ---------- */
  const [activities, setActivities] = useState<Activity[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");

  const isRemoteUpdate = useRef(false);

  /* ================= UTIL ================= */

  const resetForm = () => {
    setDate("");
    setStartTime("");
    setEndTime("");
    setDescription("");
    setEditingId(null);
  };

  const sortActivities = (acts: Activity[]) =>
    [...acts].sort((a, b) =>
      a.date !== b.date
        ? a.date.localeCompare(b.date)
        : a.startTime.localeCompare(b.startTime)
    );

  const hasTimeConflict = (newAct: Activity, excludeId?: string) =>
    activities.some((a) => {
      if (excludeId && a.id === excludeId) return false;
      if (a.date !== newAct.date) return false;

      const ns = +newAct.startTime.replace(":", "");
      const ne = +newAct.endTime.replace(":", "");
      const es = +a.startTime.replace(":", "");
      const ee = +a.endTime.replace(":", "");

      return ns < ee && ne > es;
    });

  const groupActivitiesByDate = (acts: Activity[]) => {
    const map = new Map<string, Activity[]>();
    acts.forEach((a) => {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    });
    return map;
  };

  const getFilteredActivities = () => {
    if (selectedDateFilter === "all") {
      return activities;
    }
    return activities.filter((a) => a.date === selectedDateFilter);
  };

  const getUniqueDates = () => {
    const dates = activities.map((a) => a.date);
    return [...new Set(dates)].sort();
  };

  /* ================= CRUD ================= */

  const addOrUpdateActivity = () => {
    if (!date || !startTime || !endTime || !description)
      return alert("Please fill all fields");

    if (startTime >= endTime)
      return alert("End time must be after start time");

    const newActivity: Activity = {
      id: editingId ?? crypto.randomUUID(),
      date,
      startTime,
      endTime,
      description,
    };

    if (hasTimeConflict(newActivity, editingId ?? undefined))
      return alert("❌ Waktu bentrok!");

    setActivities((prev) =>
      sortActivities(
        editingId
          ? prev.map((a) => (a.id === editingId ? newActivity : a))
          : [...prev, newActivity]
      )
    );

    resetForm();
  };

  const editActivity = (id: string) => {
    const a = activities.find((x) => x.id === id);
    if (!a) return;
    setDate(a.date);
    setStartTime(a.startTime);
    setEndTime(a.endTime);
    setDescription(a.description);
    setEditingId(id);
  };

  const deleteActivity = (id: string) => {
    if (!confirm("Delete this activity?")) return;
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  /* ================= EXCEL ================= */

  const downloadExcel = () => {
    let dataToExport = activities;
    if (selectedDateFilter !== "all") {
      dataToExport = activities.filter((a) => a.date === selectedDateFilter);
    }

    const grouped = groupActivitiesByDate(dataToExport);
    const excelData: any[] = [];

    grouped.forEach((acts, dateKey) => {
      excelData.push({
        Date: new Date(dateKey).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        "Start Time": "",
        "End Time": "",
        Activity: "",
      });

      acts.forEach((a) =>
        excelData.push({
          Date: "",
          "Start Time": a.startTime,
          "End Time": a.endTime,
          Activity: a.description,
        })
      );

      excelData.push({ Date: "", "Start Time": "", "End Time": "", Activity: "" });
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Diary");
    XLSX.writeFile(wb, "diary.xlsx");
  };

  /* ================= LOGIN ================= */

  const login = async () => {
    if (!username.trim()) {
      alert("Username required");
      return;
    }

    try {
      await signInAnonymously(auth);
      const cleanUsername = username.trim().toLowerCase();
      setCurrentUsername(cleanUsername);
      setUsername("");
    } catch (err) {
      console.error("Login error:", err);
      alert("Failed to login. Please try again.");
    }
  };

  const logout = () => {
    setCurrentUsername(null);
    setActivities([]);
    resetForm();
  };

  /* ================= FIREBASE ================= */

  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
      console.error("Auth error:", err);
    });
  }, []);

  useEffect(() => {
    if (!currentUsername) return;

    const ref = doc(db, "users", currentUsername);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      isRemoteUpdate.current = true;
      setActivities(sortActivities(snap.data().activities || []));
    });
  }, [currentUsername]);

  useEffect(() => {
    if (!currentUsername || isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const ref = doc(db, "users", currentUsername);
    const t = setTimeout(() => {
      setDoc(ref, { activities }, { merge: true });
    }, 400);

    return () => clearTimeout(t);
  }, [activities, currentUsername]);

  /* ================= UI ================= */

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#FFF8F0] to-[#FFE8D6] flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#38B2AC] to-[#319795] text-white px-4 sm:px-6 lg:px-8 py-4 sm:py-6 shadow-lg flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">📔 My Daily Diary</h1>
            <p className="text-sm sm:text-base lg:text-lg opacity-90 mt-1">Track your daily activities</p>
          </div>
          {currentUsername && (
            <div className="text-right w-full sm:w-auto">
              <p className="text-xs sm:text-sm opacity-80">User:</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{currentUsername}</p>
              <button
                onClick={logout}
                className="mt-2 bg-red-500 hover:bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm transition-all w-full sm:w-auto"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* LOGIN */}
        {!currentUsername && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg max-w-md mx-auto mt-10 sm:mt-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#38B2AC] mb-4 sm:mb-6 text-center">
              Welcome to Nikki Diary!
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 text-center">
              Enter your username to get started
            </p>
            <input
              className="w-full border-2 border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 mb-4 focus:outline-none focus:border-[#38B2AC] text-sm sm:text-base"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && login()}
            />
            <button
              onClick={login}
              className="w-full bg-[#38B2AC] hover:bg-[#319795] text-white py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base"
            >
              ✅ Login
            </button>
          </div>
        )}

        {/* FORM */}
        {currentUsername && (
          <>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-[#38B2AC] mb-4">
                Add New Activity
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-4">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:outline-none focus:border-[#38B2AC] text-sm"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:outline-none focus:border-[#38B2AC] text-sm"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:outline-none focus:border-[#38B2AC] text-sm"
                />
                <input
                  className="sm:col-span-2 lg:col-span-2 border-2 border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:outline-none focus:border-[#38B2AC] text-sm"
                  placeholder="Activity description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <button
                  onClick={addOrUpdateActivity}
                  className="bg-[#38B2AC] hover:bg-[#319795] text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base"
                >
                  {editingId ? "✏️ Update" : "➕ Add"}
                </button>
              </div>
            </div>

            {/* DATE FILTER */}
            {activities.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg mb-4 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <label className="text-base sm:text-lg font-semibold text-[#38B2AC] whitespace-nowrap">Filter by Date:</label>
                  <select
                    value={selectedDateFilter}
                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                    className="w-full sm:w-auto border-2 border-gray-300 rounded-lg px-3 sm:px-4 py-2 focus:outline-none focus:border-[#38B2AC] font-semibold text-sm sm:text-base"
                  >
                    <option value="all">📋 All Dates</option>
                    {getUniqueDates().map((dateOption) => (
                      <option key={dateOption} value={dateOption}>
                        📅 {new Date(dateOption).toLocaleDateString("id-ID", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* LIST */}
            {getFilteredActivities().length > 0 ? (
              <>
                <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                  {Array.from(groupActivitiesByDate(getFilteredActivities())).map(
                    ([dateKey, dateActivities]) => (
                      <div key={dateKey}>
                        {/* DATE HEADER */}
                        <div className="bg-[#E8F4F3] p-3 sm:p-4 rounded-lg mb-2">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-xl sm:text-2xl">📅</span>
                            <span className="font-bold text-[#38B2AC] text-sm sm:text-base lg:text-lg">
                              {new Date(dateKey).toLocaleDateString("id-ID", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* ACTIVITIES FOR THIS DATE */}
                        {dateActivities.map((a) => (
                          <div
                            key={a.id}
                            className="bg-white p-3 sm:p-4 rounded-lg shadow hover:shadow-md transition-shadow mb-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 sm:ml-4"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-2 items-center text-xs sm:text-sm">
                                <span className="font-semibold text-gray-700">{a.startTime}</span>
                                <span className="text-gray-400">—</span>
                                <span className="text-gray-600">{a.endTime}</span>
                              </div>
                              <p className="text-gray-700 mt-2 text-sm break-words">{a.description}</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => editActivity(a.id)}
                                className="flex-1 sm:flex-none bg-yellow-400 hover:bg-yellow-500 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => deleteActivity(a.id)}
                                className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                <button
                  onClick={downloadExcel}
                  className="w-full sm:w-auto bg-[#38B2AC] hover:bg-[#319795] text-white px-6 sm:px-8 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base"
                >
                  💾 Download Excel {selectedDateFilter !== "all" ? `(${selectedDateFilter})` : ""}
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 sm:h-96">
                <div className="text-center">
                  <p className="text-4xl sm:text-6xl mb-4">
                    {activities.length === 0 ? "📭" : "🔍"}
                  </p>
                  <p className="text-gray-500 text-base sm:text-xl px-4">
                    {activities.length === 0
                      ? "No activities yet. Add one to get started!"
                      : "No activities for this date"}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
