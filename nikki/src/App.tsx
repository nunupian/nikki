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
    const grouped = groupActivitiesByDate(activities);
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
      <div className="bg-gradient-to-r from-[#38B2AC] to-[#319795] text-white px-8 py-6 shadow-lg flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-5xl font-bold">📔 My Daily Diary</h1>
            <p className="text-lg opacity-90">Track your daily activities</p>
          </div>
          {currentUsername && (
            <div className="text-right">
              <p className="text-sm opacity-80">User:</p>
              <p className="text-2xl font-bold">{currentUsername}</p>
              <button
                onClick={logout}
                className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        {/* LOGIN */}
        {!currentUsername && (
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md mx-auto mt-20">
            <h2 className="text-3xl font-bold text-[#38B2AC] mb-6 text-center">
              Welcome to Nikki Diary!
            </h2>
            <p className="text-gray-600 mb-4 text-center">
              Enter your username to get started
            </p>
            <input
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-[#38B2AC]"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && login()}
            />
            <button
              onClick={login}
              className="w-full bg-[#38B2AC] hover:bg-[#319795] text-white py-3 rounded-lg font-semibold transition-all"
            >
              ✅ Login
            </button>
          </div>
        )}

        {/* FORM */}
        {currentUsername && (
          <>
            <div className="bg-white p-6 rounded-xl shadow mb-6">
              <h2 className="text-2xl font-bold text-[#38B2AC] mb-4">
                Add New Activity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#38B2AC]"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#38B2AC]"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#38B2AC]"
                />
                <input
                  className="md:col-span-2 border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#38B2AC]"
                  placeholder="Activity description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <button
                  onClick={addOrUpdateActivity}
                  className="bg-[#38B2AC] hover:bg-[#319795] text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  {editingId ? "✏️ Update" : "➕ Add"}
                </button>
              </div>
            </div>

            {/* LIST */}
            {activities.length > 0 ? (
              <>
                <div className="space-y-2 mb-6">
                  {activities.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow flex justify-between items-center"
                    >
                      <div>
                        <b className="text-[#38B2AC]">{a.date}</b>
                        <span className="ml-2">{a.startTime}</span>
                        <span className="mx-1">—</span>
                        <span>{a.endTime}</span>
                        <p className="text-gray-700 mt-1">{a.description}</p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => editActivity(a.id)}
                          className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteActivity(a.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={downloadExcel}
                  className="bg-[#38B2AC] hover:bg-[#319795] text-white px-8 py-3 rounded-lg font-semibold transition-all"
                >
                  💾 Download Excel
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-6xl mb-4">📭</p>
                  <p className="text-gray-500 text-xl">
                    No activities yet. Add one to get started!
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
