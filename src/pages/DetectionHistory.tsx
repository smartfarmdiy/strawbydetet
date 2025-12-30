import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Calendar,
} from "lucide-react";
import StrawberryIcon from "@/components/ui/StrawberryIcon";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface DetectionRecord {
  id: string;
  image_url: string | null;
  disease_name: string;
  confidence: number;
  severity: "low" | "medium" | "high" | null;
  notes: string | null;
  created_at: string;
}

interface DiseaseStats {
  name: string;
  count: number;
}

interface DailyStats {
  date: string;
  count: number;
}

const SEVERITY_COLORS = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(142, 76%, 36%)",
  "hsl(48, 96%, 53%)",
  "hsl(0, 84%, 60%)",
];

const DetectionHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [records, setRecords] = useState<DetectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [diseaseStats, setDiseaseStats] = useState<DiseaseStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("detection_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const typedRecords = (data || []) as DetectionRecord[];
      setRecords(typedRecords);
      calculateStats(typedRecords);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดประวัติการตรวจจับได้",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (data: DetectionRecord[]) => {
    // Disease distribution
    const diseaseMap = new Map<string, number>();
    data.forEach((record) => {
      const count = diseaseMap.get(record.disease_name) || 0;
      diseaseMap.set(record.disease_name, count + 1);
    });
    const diseaseData = Array.from(diseaseMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setDiseaseStats(diseaseData);

    // Daily stats for last 7 days
    const dailyMap = new Map<string, number>();
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = format(date, "MM/dd");
      dailyMap.set(dateStr, 0);
    }

    data.forEach((record) => {
      const dateStr = format(new Date(record.created_at), "MM/dd");
      if (dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
      }
    });

    const dailyData = Array.from(dailyMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
    setDailyStats(dailyData);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("detection_history")
        .delete()
        .eq("id", id);

      if (error) throw error;

      const updatedRecords = records.filter((r) => r.id !== id);
      setRecords(updatedRecords);
      calculateStats(updatedRecords);

      toast({
        title: "ลบสำเร็จ",
        description: "ลบประวัติการตรวจจับแล้ว",
      });
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบประวัติได้",
        variant: "destructive",
      });
    }
  };

  const getSeverityBadge = (severity: string | null) => {
    if (!severity) return null;
    const labels = { low: "ต่ำ", medium: "ปานกลาง", high: "สูง" };
    return (
      <Badge
        variant="outline"
        className={`${SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]} text-white border-0`}
      >
        {labels[severity as keyof typeof labels]}
      </Badge>
    );
  };

  const totalDetections = records.length;
  const healthyCount = records.filter(
    (r) => r.disease_name.toLowerCase().includes("healthy") || r.disease_name === "ปกติ"
  ).length;
  const diseaseCount = totalDetections - healthyCount;
  const avgConfidence =
    records.length > 0
      ? (records.reduce((sum, r) => sum + Number(r.confidence), 0) / records.length).toFixed(1)
      : 0;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background p-4">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "3s" }}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <StrawberryIcon className="w-8 h-8" />
            <h1 className="text-2xl font-bold">ประวัติการตรวจจับ</h1>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <History className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">การตรวจจับทั้งหมด</p>
                <p className="text-2xl font-bold">{totalDetections}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สุขภาพดี</p>
                <p className="text-2xl font-bold">{healthyCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">พบโรค</p>
                <p className="text-2xl font-bold">{diseaseCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ความแม่นยำเฉลี่ย</p>
                <p className="text-2xl font-bold">{avgConfidence}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {records.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Daily Activity Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5" />
                  การตรวจจับ 7 วันล่าสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    count: { label: "จำนวน", color: "hsl(var(--primary))" },
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyStats}>
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Disease Distribution Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="w-5 h-5" />
                  โรคที่พบบ่อย
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    count: { label: "จำนวน", color: "hsl(var(--primary))" },
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diseaseStats} layout="vertical">
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={100} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {diseaseStats.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              รายการตรวจจับทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีประวัติการตรวจจับ</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/")}
                >
                  เริ่มตรวจจับ
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>โรคที่ตรวจพบ</TableHead>
                      <TableHead>ความแม่นยำ</TableHead>
                      <TableHead>ความรุนแรง</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(record.created_at), "d MMM yyyy HH:mm", {
                            locale: th,
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.disease_name}
                        </TableCell>
                        <TableCell>{record.confidence}%</TableCell>
                        <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {record.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-sm mt-6">
          © 2025 Smart AI Solution Co., Ltd.
        </p>
      </div>
    </div>
  );
};

export default DetectionHistory;
