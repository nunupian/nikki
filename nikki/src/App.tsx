import { useState } from "react";
import * as XLSX from "xlsx";

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

  const addOrUpdateActivity = () => {
    if (!date || !startTime || !endTime || !description) {
      alert("Please fill all fields!");
      return;
    }

    const newActivity = { date, startTime, endTime, description };

    if (editingIndex !== null) {
      const updated = [...activities];
      updated[editingIndex] = newActivity;
      setActivities(updated);
    } else {
      setActivities([...activities, newActivity]);
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

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col p-6">
      <h1 className="text-4xl font-bold text-[#38B2AC] mb-6">
        📔 My Daily Diary
      </h1>

      {/* Input Form */}
      <div className="flex flex-wrap gap-4 mb-6 bg-white p-6 rounded-xl shadow-md w-full">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Activity description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button
          onClick={addOrUpdateActivity}
          className="bg-[#38B2AC] text-white px-4 py-2 rounded hover:bg-[#319795]"
        >
          {editingIndex !== null ? "Update" : "Add"}
        </button>
        {editingIndex !== null && (
          <button
            onClick={resetForm}
            className="bg-gray-400 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Table */}
      {activities.length > 0 && (
        <div className="overflow-x-auto w-full mb-6">
          <table className="w-full bg-white rounded-xl shadow-md">
            <thead className="bg-[#38B2AC] text-white">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Start</th>
                <th className="px-4 py-2">End</th>
                <th className="px-4 py-2">Activity</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, index) => (
                <tr key={index} className="odd:bg-gray-50">
                  <td className="px-4 py-2">{a.date}</td>
                  <td className="px-4 py-2">{a.startTime}</td>
                  <td className="px-4 py-2">{a.endTime}</td>
                  <td className="px-4 py-2">{a.description}</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => editActivity(index)}
                      className="bg-yellow-400 text-white px-3 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteActivity(index)}
                      className="bg-red-500 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activities.length > 0 && (
        <button
          onClick={downloadExcel}
          className="bg-[#38B2AC] text-white px-6 py-3 rounded-lg w-fit"
        >
          💾 Download Excel
        </button>
      )}
    </div>
  );
}

export default App;
