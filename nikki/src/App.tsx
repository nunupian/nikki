// src/App.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";

import { signInAnonymously } from "firebase/auth";
import {
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
  const [username, setUsername] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");

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

  const groupActivitiesByDate = (acts: Activity[]): Map<string, Activity[]> => {
    const grouped = new Map<string, Activity[]>();
    acts.forEach((activity) => {
      if (!grouped.has(activity.date)) {
        grouped.set(activity.date, []);
      }
      grouped.get(activity.date)!.push(activity);
    });
    return grouped;
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
    let dataToExport: Activity[] = activities;

    if (selectedDateFilter !== "all") {
      dataToExport = activities.filter((a) => a.date === selectedDateFilter);
    }

    const grouped = groupActivitiesByDate(dataToExport);
    const excelData: any[] = [];

    Array.from(grouped).forEach(([dateKey, dateActivities]) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      excelData.push({
        Date: formattedDate,
        "Start Time": "",
        "End Time": "",
        Activity: "",
      });

      dateActivities.forEach((activity) => {
        excelData.push({
          Date: "",
          "Start Time": activity.startTime,
          "End Time": activity.endTime,
          Activity: activity.description,
        });
      });

      excelData.push({
        Date: "",
        "Start Time": "",
        "End Time": "",
        Activity: "",
      });
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Diary");
    XLSX.writeFile(wb, "diary.xlsx");
  };

  // Initialize anonymous sign-in once on mount
  useEffect(() => {
    signInAnonymously(auth)
      .then((cred) => {
        setUid(cred.user.uid);
      })
      .catch((err) => {
        console.error("signInAnonymously error:", err);
      });
  }, []);

  // Load activities for current user
  useEffect(() => {
    if (!currentUser) return;

    const ref = doc(db, "users", currentUser);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setActivities(sortActivities(data.activities || []));
      } else {
        setActivities([]);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, [currentUser]);

  // Auto save to Firestore when activities change
  useEffect(() => {
    const save = async () => {
      if (!currentUser) return;
      const ref = doc(db, "users", currentUser);
      try {
        await setDoc(
          ref,
          {
            activities,
            lastUpdated: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error("Error saving activities:", err);
      }
    };
    save();
  }, [activities, currentUser]);

  const handleSelectUser = (selectedUsername: string) => {
    if (!selectedUsername.trim()) {
      alert("Please enter a username!");
      return;
    }
    setCurrentUser(selectedUsername);
    setUsername("");
    resetForm();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    resetForm();
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

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#FFF8F0] to-[#FFE8D6] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#38B2AC] to-[#319795] text-white px-8 py-6 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold">📔 My Daily Diary</h1>
            <p className="text-lg mt-2 opacity-90">Track your daily activities effortlessly</p>
          </div>
          {currentUser && (
            <div className="text-right">
              <p className="text-sm opacity-80">Logged in as:</p>
              <p className="text-2xl font-bold">{currentUser}</p>
              <button
                onClick={handleLogout}
                className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 w-full">
        {!currentUser ? (
          // User Selection Screen
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md mx-auto mt-20">
            <h2 className="text-3xl font-bold text-[#38B2AC] mb-6 text-center">Welcome to Nikki Diary!</h2>
            <p className="text-gray-600 mb-4 text-center">Enter your username to get started</p>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSelectUser(username)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-[#38B2AC]"
            />
            <button
              onClick={() => handleSelectUser(username)}
              className="w-full bg-[#38B2AC] hover:bg-[#319795] text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md"
            >
              ✅ Login
            </button>
          </div>
        ) : (
          <>

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

            {/* Date Filter Dropdown */}
            {activities.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
                <div className="flex items-center gap-4">
                  <label className="text-lg font-semibold text-[#38B2AC]">Filter by Date:</label>
                  <select
                    value={selectedDateFilter}
                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                    className="border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-[#38B2AC] font-semibold"
                  >
                    <option value="all">📋 All Dates</option>
                    {getUniqueDates().map((dateOption) => (
                      <option key={dateOption} value={dateOption}>
                        📅 {new Date(dateOption).toLocaleDateString('id-ID', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Table */}
            {getFilteredActivities().length > 0 && (
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
                      {Array.from(groupActivitiesByDate(getFilteredActivities())).map(([dateKey, dateActivities]) => (
                        <React.Fragment key={dateKey}>
                          <tr className="bg-[#E8F4F3] hover:bg-[#E8F4F3]">
                            <td colSpan={5} className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">📅</span>
                                <span className="font-bold text-[#38B2AC] text-lg">
                                  {new Date(dateKey).toLocaleDateString('id-ID', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {dateActivities.map((a, idx) => {
                            const actualIndex = activities.findIndex(
                              (act) => act.date === a.date && act.startTime === a.startTime && act.description === a.description
                            );
                            return (
                              <tr key={`${dateKey}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-gray-600"></td>
                                <td className="px-6 py-4 font-semibold text-gray-700">{a.startTime}</td>
                                <td className="px-6 py-4 text-gray-600">{a.endTime}</td>
                                <td className="px-6 py-4 text-gray-700">{a.description}</td>
                                <td className="px-6 py-4 text-center space-x-2">
                                  <button
                                    onClick={() => editActivity(actualIndex)}
                                    className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold transition-all inline-block"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    onClick={() => deleteActivity(actualIndex)}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all inline-block"
                                  >
                                    🗑️ Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
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
                💾 Download Excel {selectedDateFilter !== "all" ? `(${selectedDateFilter})` : ""}
              </button>
            )}

            {/* Empty State */}
            {getFilteredActivities().length === 0 && activities.length > 0 && (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-6xl mb-4">🔍</p>
                  <p className="text-gray-500 text-xl">No activities for this date</p>
                </div>
              </div>
            )}

            {activities.length === 0 && (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-6xl mb-4">📭</p>
                  <p className="text-gray-500 text-xl">No activities yet. Add one to get started!</p>
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
