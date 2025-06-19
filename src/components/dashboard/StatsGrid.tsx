
import { FC } from 'react';
import { Check, Clock, Phone, AlertCircle, Clock3, DollarSign } from 'lucide-react';
import StatCard from '@/components/StatCard';

interface StatsGridProps {
  stats: {
    completed: number;
    inProgress: number;
    remaining: number;
    failed: number;
    totalDuration: number;
    totalCost: number;
  };
}

const StatsGrid: FC<StatsGridProps> = ({ stats }) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Completed Calls"
          value={stats.completed.toString()}
          description="Successfully completed"
          icon={<Check className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress.toString()}
          description="Currently active"
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          variant="info"
        />
        <StatCard
          title="Remaining Calls"
          value={stats.remaining.toString()}
          description="Waiting to be made"
          icon={<Phone className="h-5 w-5 text-gray-500" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Failed Calls"
          value={stats.failed.toString()}
          description="Failed attempts"
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          variant="error"
        />
        <StatCard
          title="Total Duration"
          value={`${stats.totalDuration.toFixed(1)} min`}
          description="Call duration"
          icon={<Clock3 className="h-5 w-5 text-purple-500" />}
          variant="purple"
        />
        <StatCard
          title="Total Cost"
          value={`$${stats.totalCost.toFixed(2)}`}
          description="@ $0.99 per minute"
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          variant="orange"
        />
      </div>
    </>
  );
};

export default StatsGrid;
