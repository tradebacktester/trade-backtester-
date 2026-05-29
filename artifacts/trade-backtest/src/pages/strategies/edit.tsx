import React from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetStrategy, 
  useUpdateStrategy,
  useDeleteStrategy,
  getGetStrategyQueryKey,
  getListStrategiesQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

export default function EditStrategy() {
  const [, params] = useRoute("/strategies/:id/edit");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: strategy, isLoading } = useGetStrategy(id, { query: { enabled: !!id } as any });
  const updateStrategy = useUpdateStrategy();
  const deleteStrategy = useDeleteStrategy();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "sma_crossover",
      symbol: "AAPL",
      timeframe: "1d",
      parameters: {},
    },
  });

  React.useEffect(() => {
    if (strategy) {
      form.reset({
        name: strategy.name,
        description: strategy.description || "",
        type: strategy.type as any,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe as any,
        parameters: strategy.parameters as any,
      });
    }
  }, [strategy, form]);

  const selectedType = form.watch("type");

  function onSubmit(data: FormValues) {
    updateStrategy.mutate(
      { id, data: data as any },
      {
        onSuccess: (updatedStrategy) => {
          queryClient.invalidateQueries({ queryKey: getGetStrategyQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          toast({
            title: "Strategy Updated",
            description: "Your strategy has been successfully updated.",
          });
          setLocation(`/strategies/${updatedStrategy.id}`);
        },
        onError: (error: { data?: { error?: string } | null }) => {
          toast({
            title: "Error",
            description: error.data?.error || "Failed to update strategy",
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleDelete() {
    deleteStrategy.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          toast({
            title: "Strategy Deleted",
            description: "The strategy has been permanently removed.",
          });
          setLocation("/strategies");
        },
        onError: (error: { data?: { error?: string } | null }) => {
          toast({
            title: "Error",
            description: error.data?.error || "Failed to delete strategy",
            variant: "destructive",
          });
        },
      }
    );
  }

  if (isLoading) {
    return <div className="space-y-6 max-w-3xl mx-auto">
      <Skeleton className="h-10 w-[200px]" />
      <Skeleton className="h-[400px] w-full" />
    </div>;
  }

  if (!strategy) {
    return <div>Strategy not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/strategies/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Strategy</h1>
          <p className="text-muted-foreground">Modify configuration for {strategy.name}.</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the strategy and all associated backtests.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
                        <Input {...field} />
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
                        <Textarea {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value}>
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

                <FormField
                  control={form.control}
                  name="timeframe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeframe</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                <Button type="submit" disabled={updateStrategy.isPending}>
                  {updateStrategy.isPending ? "Saving..." : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
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
