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

  const addActivity = () => {
    if (!date || !startTime || !endTime || !description) {
      alert("Please fill all fields!");
      return;
    }
    setActivities([...activities, { date, startTime, endTime, description }]);
    setDate("");
    setStartTime("");
    setEndTime("");
    setDescription("");
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(activities);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Diary");
    XLSX.writeFile(wb, "diary.xlsx");
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center p-6">
      <h1 className="text-4xl font-bold text-[#38B2AC] mb-6">
        📔 My Daily Diary
      </h1>

      {/* Input Form */}
      <div className="flex flex-wrap gap-4 mb-6 bg-white p-6 rounded-xl shadow-md w-full max-w-3xl">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 flex-1"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-24"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-24"
        />
        <input
          type="text"
          placeholder="Activity description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 flex-1"
        />
        <button
          onClick={addActivity}
          className="bg-[#38B2AC] text-white px-4 py-2 rounded hover:bg-[#319795] transition"
        >
          Add
        </button>
      </div>

      {/* Activity Table */}
      {activities.length > 0 && (
        <div className="overflow-x-auto w-full max-w-3xl mb-6">
          <table className="min-w-full bg-white rounded-xl shadow-md overflow-hidden">
            <thead className="bg-[#38B2AC] text-white">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Start</th>
                <th className="px-4 py-2 text-left">End</th>
                <th className="px-4 py-2 text-left">Activity</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                >
                  <td className="px-4 py-2">{a.date}</td>
                  <td className="px-4 py-2">{a.startTime}</td>
                  <td className="px-4 py-2">{a.endTime}</td>
                  <td className="px-4 py-2">{a.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Download Button */}
      {activities.length > 0 && (
        <button
          onClick={downloadExcel}
          className="bg-[#38B2AC] text-white px-6 py-3 rounded-lg hover:bg-[#319795] transition"
        >
          💾 Download Excel
        </button>
      )}
    </div>
  );
}

export default App;
