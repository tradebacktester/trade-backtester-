import React from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateStrategy, getListStrategiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import { StrategyInputType, StrategyInputTimeframe } from "@workspace/api-client-react/src/generated/api.schemas";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["sma_crossover", "ema_crossover", "rsi", "macd", "bollinger_bands"] as const),
  symbol: z.string().min(1, "Symbol is required"),
  timeframe: z.enum(["1d", "1h", "4h", "1w"] as const),
  parameters: z.record(z.any()),
});

type FormValues = z.infer<typeof formSchema>;

const SYMBOLS = ["AAPL", "MSFT", "TSLA", "BTC/USD", "ETH/USD", "SPY", "QQQ", "NVDA", "AMZN", "GOOGL"];

const defaultParameters: Record<string, any> = {
  sma_crossover: { fastPeriod: 10, slowPeriod: 50 },
  ema_crossover: { fastPeriod: 9, slowPeriod: 21 },
  rsi: { period: 14, oversold: 30, overbought: 70 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bollinger_bands: { period: 20, stdDev: 2 },
};

export default function NewStrategy() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createStrategy = useCreateStrategy();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "sma_crossover",
      symbol: "AAPL",
      timeframe: "1d",
      parameters: defaultParameters.sma_crossover,
    },
  });

  const selectedType = form.watch("type");

  React.useEffect(() => {
    form.setValue("parameters", defaultParameters[selectedType]);
  }, [selectedType, form]);

  function onSubmit(data: FormValues) {
    createStrategy.mutate(
      { data: data as any },
      {
        onSuccess: (strategy) => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          toast({
            title: "Strategy Created",
            description: "Your strategy has been successfully created.",
          });
          setLocation(`/strategies/${strategy.id}`);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.error || "Failed to create strategy",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/strategies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New Strategy</h1>
          <p className="text-muted-foreground">Configure a new systematic trading strategy.</p>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Strategy Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. BTC Daily SMA Crossover" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the rationale behind this strategy..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sma_crossover">SMA Crossover</SelectItem>
                          <SelectItem value="ema_crossover">EMA Crossover</SelectItem>
                          <SelectItem value="rsi">RSI Mean Reversion</SelectItem>
                          <SelectItem value="macd">MACD Trend</SelectItem>
                          <SelectItem value="bollinger_bands">Bollinger Bands Breakout</SelectItem>
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
                      <FormLabel>Default Symbol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                <FormField
                  control={form.control}
                  name="timeframe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeframe</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1h">1 Hour</SelectItem>
                          <SelectItem value="4h">4 Hours</SelectItem>
                          <SelectItem value="1d">Daily</SelectItem>
                          <SelectItem value="1w">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-4">Strategy Parameters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(form.watch("parameters") || {}).map(([key, value]) => (
                    <FormItem key={key}>
                      <FormLabel className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={value as number}
                          onChange={(e) => {
                            const params = { ...form.getValues("parameters"), [key]: Number(e.target.value) };
                            form.setValue("parameters", params, { shouldValidate: true });
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={createStrategy.isPending}>
                  {createStrategy.isPending ? "Saving..." : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Strategy
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
