import React from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCreateBacktest, 
  useListStrategies,
  getListBacktestsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Play } from "lucide-react";
import { format, subYears } from "date-fns";

const formSchema = z.object({
  strategyId: z.coerce.number().min(1, "Strategy is required"),
  symbol: z.string().min(1, "Symbol is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  initialCapital: z.coerce.number().min(100, "Minimum capital is 100"),
});

type FormValues = z.infer<typeof formSchema>;

const SYMBOLS = ["AAPL", "MSFT", "TSLA", "BTC/USD", "ETH/USD", "SPY", "QQQ", "NVDA", "AMZN", "GOOGL"];

export default function NewBacktest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStrategyId = searchParams.get("strategyId");

  const { data: strategies, isLoading: isLoadingStrategies } = useListStrategies();
  const createBacktest = useCreateBacktest();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      strategyId: initialStrategyId ? parseInt(initialStrategyId, 10) : 0,
      symbol: "AAPL",
      startDate: format(subYears(new Date(), 1), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      initialCapital: 100000,
    },
  });

  // When a strategy is selected, update the default symbol
  React.useEffect(() => {
    const sub = form.watch((value, { name }) => {
      if (name === "strategyId" && strategies) {
        const strategy = strategies.find(s => s.id === value.strategyId);
        if (strategy) {
          form.setValue("symbol", strategy.symbol);
        }
      }
    });
    return () => sub.unsubscribe();
  }, [form, strategies]);

  function onSubmit(data: FormValues) {
    createBacktest.mutate(
      { data },
      {
        onSuccess: (backtest) => {
          queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
          toast({
            title: "Backtest Started",
            description: "Your backtest is now running.",
          });
          setLocation(`/backtests/${backtest.id}`);
        },
        onError: (error: { data?: { error?: string } | null }) => {
          toast({
            title: "Error",
            description: error.data?.error || "Failed to start backtest",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/backtests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Run Backtest</h1>
          <p className="text-muted-foreground">Test a strategy against historical data.</p>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="strategyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategy</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(parseInt(val, 10))} 
                      value={field.value ? field.value.toString() : ""}
                      disabled={isLoadingStrategies}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingStrategies ? "Loading..." : "Select a strategy"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!isLoadingStrategies && (!strategies || strategies.length === 0) ? (
                          <div className="px-3 py-4 text-center space-y-1">
                            <p className="text-xs text-muted-foreground">No strategies yet.</p>
                            <Link href="/strategies/new" className="text-xs text-primary underline underline-offset-2">
                              Create a strategy first →
                            </Link>
                          </div>
                        ) : (
                          strategies?.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.name} ({s.timeframe})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="Select symbol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SYMBOLS.map((s) => (
                          <SelectItem key={s} value={s} className="font-mono">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="initialCapital"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Capital ($)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="font-mono" />
                    </FormControl>
                    <FormDescription>Starting balance for the simulation</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createBacktest.isPending || !form.watch("strategyId")}>
                  {createBacktest.isPending ? "Starting..." : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Simulation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
