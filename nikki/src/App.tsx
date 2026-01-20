// src/App.tsx
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

import { signInAnonymously } from "firebase/auth";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "./firebase";

interface Activity {
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const resetForm = () => {
    setDate("");
    setStartTime("");
    setEndTime("");
    setDescription("");
    setEditingIndex(null);
  };

  const hasTimeConflict = (newActivity: Activity, excludeIndex?: number): boolean => {
    return activities.some((a, index) => {
      if (excludeIndex !== undefined && index === excludeIndex) return false;
      if (a.date !== newActivity.date) return false;
      
      const newStart = parseInt(newActivity.startTime.replace(":", ""));
      const newEnd = parseInt(newActivity.endTime.replace(":", ""));
      const existStart = parseInt(a.startTime.replace(":", ""));
      const existEnd = parseInt(a.endTime.replace(":", ""));
      
      return (newStart < existEnd && newEnd > existStart);
    });
  };

  const sortActivities = (acts: Activity[]): Activity[] => {
    return [...acts].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
  };

  const addOrUpdateActivity = () => {
    if (!date || !startTime || !endTime || !description) {
      alert("Please fill all fields!");
      return;
    }

    if (startTime >= endTime) {
      alert("End time must be after start time!");
      return;
    }

    const newActivity: Activity = { date, startTime, endTime, description };

    if (editingIndex !== null) {
      if (hasTimeConflict(newActivity, editingIndex)) {
        alert("❌ Waktu bentrok! Ada kegiatan lain pada jam yang sama.");
        return;
      }
      const updated = [...activities];
      updated[editingIndex] = newActivity;
      setActivities(sortActivities(updated));
    } else {
      if (hasTimeConflict(newActivity)) {
        alert("❌ Waktu bentrok! Ada kegiatan lain pada jam yang sama.");
        return;
      }
      setActivities(sortActivities([...activities, newActivity]));
    }

    resetForm();
  };

  const editActivity = (index: number) => {
    const a = activities[index];
    setDate(a.date);
    setStartTime(a.startTime);
    setEndTime(a.endTime);
    setDescription(a.description);
    setEditingIndex(index);
  };

  const deleteActivity = (index: number) => {
    if (!confirm("Delete this activity?")) return;
    setActivities(activities.filter((_, i) => i !== index));
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(activities);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Diary");
    XLSX.writeFile(wb, "diary.xlsx");
  };

  // Anonymous sign-in + realtime listener
  useEffect(() => {
    let unsub: (() => void) | undefined;

    signInAnonymously(auth)
      .then((cred) => {
        const uid = cred.user.uid;
        const ref = doc(db, "users", uid);

        unsub = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setActivities((data as any).activities || []);
          } else {
            // jika doc belum ada, jangan set apa-apa
          }
        });
      })
      .catch((err) => {
        console.error("signInAnonymously error:", err);
      });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Auto save ke Firestore saat activities berubah
  useEffect(() => {
    const save = async () => {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;
      const ref = doc(db, "users", uid);
      try {
        await setDoc(ref, { activities }, { merge: true });
      } catch (err) {
        console.error("Error saving activities:", err);
      }
    };
    save();
  }, [activities]);

  // fungsi test untuk menulis collection "test"
  const testAdd = async () => {
    try {
      await addDoc(collection(db, "test"), {
        message: "Firestore connected!",
        createdAt: new Date(),
      });
      alert("Berhasil masuk Firestore 🚀");
    } catch (err) {
      console.error("testAdd error:", err);
      alert("Gagal menambahkan dokumen. Cek console.");
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#FFF8F0] to-[#FFE8D6] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#38B2AC] to-[#319795] text-white px-8 py-6 shadow-lg flex-shrink-0">
        <h1 className="text-5xl font-bold">📔 My Daily Diary</h1>
        <p className="text-lg mt-2 opacity-90">Track your daily activities effortlessly</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 w-full">
        {/* Test Button */}
        <div className="mb-8">
          <button
            onClick={testAdd}
            className="bg-[#38B2AC] hover:bg-[#319795] text-white px-6 py-2 rounded-lg font-semibold transition-all shadow-md"
          >
            🔌 Test Firestore
          </button>
        </div>

        {/* Input Form */}
        <div className="bg-white p-8 rounded-2xl shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-[#38B2AC] mb-6">Add New Activity</h2>
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
              type="text"
              placeholder="Activity description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#38B2AC] md:col-span-2"
            />
            <button
              onClick={addOrUpdateActivity}
              className="bg-[#38B2AC] hover:bg-[#319795] text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md"
            >
              {editingIndex !== null ? "✏️ Update" : "➕ Add"}
            </button>
            {editingIndex !== null && (
              <button
                onClick={resetForm}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md"
              >
                ❌ Cancel
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {activities.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-[#38B2AC] to-[#319795] text-white sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Date</th>
                    <th className="px-6 py-4 text-left font-semibold">Start Time</th>
                    <th className="px-6 py-4 text-left font-semibold">End Time</th>
                    <th className="px-6 py-4 text-left font-semibold">Activity</th>
                    <th className="px-6 py-4 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-700">{a.date}</td>
                      <td className="px-6 py-4 text-gray-600">{a.startTime}</td>
                      <td className="px-6 py-4 text-gray-600">{a.endTime}</td>
                      <td className="px-6 py-4 text-gray-700">{a.description}</td>
                      <td className="px-6 py-4 text-center space-x-2">
                        <button
                          onClick={() => editActivity(index)}
                          className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold transition-all inline-block"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteActivity(index)}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all inline-block"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Download Button */}
        {activities.length > 0 && (
          <button
            onClick={downloadExcel}
            className="bg-gradient-to-r from-[#38B2AC] to-[#319795] hover:from-[#319795] hover:to-[#2a8a82] text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg mb-8"
          >
            💾 Download Excel
          </button>
        )}

        {/* Empty State */}
        {activities.length === 0 && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-6xl mb-4">📭</p>
              <p className="text-gray-500 text-xl">No activities yet. Add one to get started!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
