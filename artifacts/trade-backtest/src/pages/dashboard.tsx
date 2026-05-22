import React from "react";
import { useGetBacktestSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, BarChart, Percent, Hash } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetBacktestSummary();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your backtesting performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Backtests" 
          value={summary?.totalBacktests} 
          icon={<Activity className="h-4 w-4 text-muted-foreground" />} 
          isLoading={isLoading} 
        />
        <StatCard 
          title="Avg Return" 
          value={summary?.avgReturn != null ? `${summary.avgReturn.toFixed(2)}%` : null} 
          icon={<Percent className="h-4 w-4 text-muted-foreground" />} 
          isLoading={isLoading}
          valueClass={summary?.avgReturn && summary.avgReturn >= 0 ? 'text-green-500' : 'text-red-500'}
        />
        <StatCard 
          title="Best Return" 
          value={summary?.bestReturn != null ? `${summary.bestReturn.toFixed(2)}%` : null} 
          icon={<TrendingUpIcon className="h-4 w-4 text-green-500" />} 
          isLoading={isLoading}
          valueClass="text-green-500"
        />
        <StatCard 
          title="Total Trades" 
          value={summary?.totalTrades} 
          icon={<Hash className="h-4 w-4 text-muted-foreground" />} 
          isLoading={isLoading} 
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md">
              Activity chart placeholder
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrendingUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  isLoading,
  valueClass = ""
}: { 
  title: string; 
  value?: string | number | null; 
  icon: React.ReactNode; 
  isLoading: boolean;
  valueClass?: string;
}) {
  return (
    <Card className="border-border bg-card shadow-sm hover:border-primary/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-[100px] mt-1" />
        ) : (
          <div className={`text-2xl font-bold font-mono ${valueClass}`}>
            {value ?? "-"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}