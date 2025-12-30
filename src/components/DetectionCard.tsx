import { cn } from "@/lib/utils";

interface DetectionCardProps {
  name: string;
  percentage: number;
  color: string;
  icon?: React.ReactNode;
}

const DetectionCard = ({ name, percentage, color, icon }: DetectionCardProps) => {
  return (
    <div className="glass-card rounded-xl p-4 hover-lift">
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{name}</p>
          <p className="text-2xl font-bold text-foreground">{percentage.toFixed(1)}%</p>
        </div>
      </div>
      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};

export default DetectionCard;