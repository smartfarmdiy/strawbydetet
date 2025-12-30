import DetectionCard from "./DetectionCard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DetectionStatsProps {
  percentages: Record<string, number>;
  showChart?: boolean;
}

const DETECTION_COLORS: Record<string, string> = {
  "Anthracnose Fruit Rot": "#ef4444",
  "Gray Mold": "#6b7280",
  "Powdery Mildew Fruit": "#8b5cf6",
  "Powdery Mildew Leaf": "#a855f7",
  "Ripe": "#22c55e",
  "Unripe": "#eab308",
  "Rotten": "#78350f",
};

const DETECTION_NAMES_TH: Record<string, string> = {
  "Anthracnose Fruit Rot": "โรคแอนแทรคโนส",
  "Gray Mold": "โรคราสีเทา",
  "Powdery Mildew Fruit": "โรคราแป้ง (ผล)",
  "Powdery Mildew Leaf": "โรคราแป้ง (ใบ)",
  "Ripe": "สุก",
  "Unripe": "ยังไม่สุก",
  "Rotten": "เน่าเสีย",
};

const DetectionStats = ({ percentages, showChart = true }: DetectionStatsProps) => {
  const chartData = Object.entries(percentages)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name: DETECTION_NAMES_TH[name] || name,
      value: parseFloat(value.toFixed(1)),
      color: DETECTION_COLORS[name] || "#888",
    }));

  const hasData = chartData.length > 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(percentages).map(([name, value]) => (
          <DetectionCard
            key={name}
            name={DETECTION_NAMES_TH[name] || name}
            percentage={value}
            color={DETECTION_COLORS[name] || "#888"}
            icon={<div />}
          />
        ))}
      </div>

      {showChart && hasData && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
            สัดส่วนการตรวจพบ
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "สัดส่วน"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                  formatter={(value) => (
                    <span className="text-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetectionStats;