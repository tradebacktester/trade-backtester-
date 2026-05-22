import React from "react";
import { Link } from "wouter";
import { useListStrategies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, Activity, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Strategies() {
  const { data: strategies, isLoading } = useListStrategies();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Strategies</h1>
          <p className="text-muted-foreground">Manage your trading strategies and run backtests.</p>
        </div>
        <Button asChild>
          <Link href="/strategies/new">
            <Plus className="mr-2 h-4 w-4" />
            New Strategy
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))
        ) : strategies?.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-lg">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">No strategies yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first trading strategy to start backtesting.</p>
            <Button asChild variant="outline">
              <Link href="/strategies/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Strategy
              </Link>
            </Button>
          </div>
        ) : (
          strategies?.map((strategy) => (
            <Card key={strategy.id} className="border-border bg-card hover:border-primary/50 transition-all flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold">{strategy.name}</CardTitle>
                  <Badge variant="outline" className="font-mono bg-background">
                    {strategy.symbol}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {strategy.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0 flex flex-col gap-4">
                <div className="flex gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">{strategy.type}</Badge>
                  <Badge variant="secondary" className="font-mono text-xs">{strategy.timeframe}</Badge>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button asChild variant="default" className="flex-1">
                    <Link href={`/strategies/${strategy.id}`}>
                      View Details
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="icon">
                    <Link href={`/strategies/${strategy.id}`}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}