// src/App.tsx
import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";

interface Activity {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
}

function App() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedDateFilter] = useState("all");

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
    let data = selectedDateFilter === "all"
      ? activities
      : activities.filter((a) => a.date === selectedDateFilter);

    const grouped = groupActivitiesByDate(data);
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

  /* ================= FIREBASE ================= */

  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, setCurrentUser);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const ref = doc(db, "users", currentUser.uid);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      isRemoteUpdate.current = true;
      setActivities(sortActivities(snap.data().activities || []));
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const ref = doc(db, "users", currentUser.uid);
    const t = setTimeout(() => {
      setDoc(ref, { activities }, { merge: true });
    }, 400);

    return () => clearTimeout(t);
  }, [activities, currentUser]);

  /* ================= UI ================= */

  const getFilteredActivities = () =>
    selectedDateFilter === "all"
      ? activities
      : activities.filter((a) => a.date === selectedDateFilter);

  const getUniqueDates = () =>
    [...new Set(activities.map((a) => a.date))].sort();

  
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#FFF8F0] to-[#FFE8D6] flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#38B2AC] to-[#319795] text-white px-8 py-6 shadow-lg">
        <h1 className="text-5xl font-bold">📔 My Daily Diary</h1>
        <p className="text-lg opacity-90">Track your daily activities</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        {/* LOGIN */}
        {!currentUser && (
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md mx-auto mt-20">
            <input
              className="w-full border px-4 py-3 rounded"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setUsername("")}
            />
          </div>
        )}

        {/* FORM */}
        {currentUser && (
          <>
            <div className="bg-white p-6 rounded-xl shadow mb-6 grid grid-cols-6 gap-4">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              <input
                className="col-span-2"
                placeholder="Activity"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <button onClick={addOrUpdateActivity}>
                {editingId ? "Update" : "Add"}
              </button>
              <select>
  {getUniqueDates().map(date => (
    <option key={date}>{date}</option>
  ))}
</select>
            </div>

            {/* TABLE */}
            {getFilteredActivities().map((a) => (
              <div key={a.id} className="bg-white p-4 rounded shadow mb-2 flex justify-between">
                <div>
                  <b>{a.date}</b> {a.startTime}-{a.endTime} — {a.description}
                </div>
                <div className="space-x-2">
                  <button onClick={() => editActivity(a.id)}>Edit</button>
                  <button onClick={() => deleteActivity(a.id)}>Delete</button>
                </div>
              </div>
            ))}

            {activities.length > 0 && (
              <button
                onClick={downloadExcel}
                className="mt-6 bg-teal-500 text-white px-6 py-3 rounded"
              >
                Download Excel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
