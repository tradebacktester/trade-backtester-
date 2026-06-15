import React, { useState } from 'react';
import { 
  LineChart, 
  Wallet, 
  Activity, 
  Zap, 
  Layers, 
  Settings, 
  Home, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  ArrowRight,
  MoreHorizontal
} from 'lucide-react';

export function VisionProGlass() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const glassStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: '0 4px 24px -1px rgba(0, 0, 0, 0.2)',
  };

  const getGlowStyle = (id: string, color: string) => ({
    ...glassStyle,
    boxShadow: hoveredCard === id 
      ? \`0 0 30px 0 \${color}20, inset 0 0 20px 0 \${color}10, 0 8px 32px 0 rgba(0,0,0,0.4)\` 
      : \`0 8px 32px 0 rgba(0,0,0,0.4)\`,
    borderColor: hoveredCard === id ? \`\${color}50\` : 'rgba(255, 255, 255, 0.08)',
    transform: hoveredCard === id ? 'translateY(-2px)' : 'translateY(0)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  });

  const fontMono = { fontFamily: '"JetBrains Mono", "Space Mono", monospace' };

  return (
    <div style={{ minHeight: '100vh', background: '#030303', color: 'rgba(255,255,255,0.85)', overflowX: 'hidden' }} className="pb-24 font-sans selection:bg-cyan-500/30">
      <style dangerouslySetInnerHTML={{ __html: \`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        
        body { font-family: 'Inter', sans-serif; }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        
        @keyframes pulse-glow {
          0% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
          100% { opacity: 0.3; transform: scale(1); }
        }

        .ambient-light {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          z-index: 0;
          pointer-events: none;
        }

        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      \`}} />

      {/* Ambient background lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="ambient-light" style={{ top: '-10%', left: '-10%', width: '40vw', height: '40vw', background: '#06b6d4', opacity: 0.07, animation: 'pulse-glow 8s ease-in-out infinite alternate' }} />
        <div className="ambient-light" style={{ top: '40%', right: '-5%', width: '30vw', height: '30vw', background: '#8b5cf6', opacity: 0.08, animation: 'pulse-glow 12s ease-in-out infinite alternate-reverse' }} />
        <div className="ambient-light" style={{ bottom: '-10%', left: '20%', width: '35vw', height: '35vw', background: '#3b82f6', opacity: 0.06, animation: 'pulse-glow 10s ease-in-out infinite alternate' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Top Navbar */}
        <nav 
          className="rounded-2xl px-6 py-4 flex items-center justify-between mb-12 sticky top-6 z-50 transition-all duration-300"
          style={{
            ...glassStyle,
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(40px) saturate(200%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Zap size={16} color="white" fill="white" />
            </div>
            <span className="font-semibold text-white tracking-wide text-lg">TradeLab</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#" className="text-white hover:text-cyan-400 transition-colors drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Dashboard</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors">Backtests</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors">Strategies</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors">Live Data</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
              <Settings size={18} className="text-white/70" />
            </button>
            <div className="w-10 h-10 rounded-full border border-white/20 p-0.5 overflow-hidden">
              <img src="https://i.pravatar.cc/150?img=68" alt="User" className="w-full h-full rounded-full object-cover" />
            </div>
          </div>
        </nav>

        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-2">
            Welcome back, <span className="font-medium bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-400">Alex</span>
          </h1>
          <p className="text-white/50 text-lg">Your algorithms are running smoothly.</p>
        </header>

        {/* Market Overview Row */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-white/90">Market Overview</h2>
            <button className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors flex items-center gap-1">
              View all markets <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 'btc', name: 'Bitcoin', symbol: 'BTC/USD', price: '$64,230.50', change: '+2.4%', up: true, color: '#f59e0b' },
              { id: 'eth', name: 'Ethereum', symbol: 'ETH/USD', price: '$3,450.20', change: '+1.8%', up: true, color: '#8b5cf6' },
              { id: 'sol', name: 'Solana', symbol: 'SOL/USD', price: '$145.80', change: '-0.5%', up: false, color: '#10b981' }
            ].map((asset) => (
              <div 
                key={asset.id}
                onMouseEnter={() => setHoveredCard(asset.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className="rounded-3xl p-6 relative overflow-hidden group cursor-pointer"
                style={getGlowStyle(asset.id, asset.color)}
              >
                {/* Subtle gradient wash on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500" style={{ background: \`radial-gradient(circle at top right, \${asset.color}, transparent 70%)\` }} />
                
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div>
                    <h3 className="text-white font-medium text-lg">{asset.name}</h3>
                    <p className="text-white/40 text-sm">{asset.symbol}</p>
                  </div>
                  <div className={\`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full border \${asset.up ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' : 'text-rose-400 border-rose-400/20 bg-rose-400/10'}\`}>
                    {asset.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span style={fontMono}>{asset.change}</span>
                  </div>
                </div>
                
                <div className="relative z-10">
                  <div className="text-3xl font-semibold text-white tracking-tight" style={fontMono}>
                    {asset.price}
                  </div>
                </div>

                {/* Abstract sparkline */}
                <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 group-hover:opacity-60 transition-opacity duration-500" style={{
                  background: \`linear-gradient(to top, \${asset.color}20, transparent)\`,
                  maskImage: 'linear-gradient(to bottom, black, transparent)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)'
                }}>
                  <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-full stroke-current" style={{ color: asset.color }}>
                    <path d={asset.up ? "M0 20 L20 15 L40 18 L60 8 L80 12 L100 0" : "M0 0 L20 8 L40 5 L60 15 L80 12 L100 20"} fill="none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Performance Chart */}
          <div className="lg:col-span-2">
            <div 
              className="rounded-3xl p-6 h-full flex flex-col"
              style={glassStyle}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-medium text-white/90">Portfolio Performance</h2>
                  <p className="text-white/50 text-sm mt-1">Live + Backtested Alpha</p>
                </div>
                <div className="flex gap-2">
                  {['1W', '1M', '3M', 'YTD', 'ALL'].map((tf, i) => (
                    <button key={tf} className={\`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors \${i === 2 ? 'bg-white/10 text-white border border-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}\`}>
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-[300px] relative rounded-xl border border-white/5 bg-black/20 flex flex-col items-center justify-center">
                {/* Mock Chart Area */}
                <div className="absolute inset-0 p-4">
                  {/* Grid lines */}
                  <div className="w-full h-full border-b border-l border-white/5 relative">
                    <div className="absolute top-1/4 w-full border-t border-white/5 border-dashed" />
                    <div className="absolute top-2/4 w-full border-t border-white/5 border-dashed" />
                    <div className="absolute top-3/4 w-full border-t border-white/5 border-dashed" />
                    
                    {/* Simulated SVG Chart line */}
                    <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 400">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="5" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>
                      <path d="M0,350 L100,320 L200,340 L300,280 L400,290 L500,200 L600,220 L700,150 L800,180 L900,80 L1000,50 L1000,400 L0,400 Z" fill="url(#chartGrad)" />
                      <path d="M0,350 L100,320 L200,340 L300,280 L400,290 L500,200 L600,220 L700,150 L800,180 L900,80 L1000,50" fill="none" stroke="#06b6d4" strokeWidth="3" filter="url(#glow)" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="absolute top-6 left-6 flex items-baseline gap-3">
                  <span className="text-4xl font-semibold text-white tracking-tight drop-shadow-md" style={fontMono}>$124,592.80</span>
                  <span className="text-emerald-400 font-medium flex items-center bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20" style={fontMono}>+18.4%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Backtests */}
          <div>
            <div className="rounded-3xl p-6 h-full" style={glassStyle}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-medium text-white/90">Recent Backtests</h2>
                <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                  <MoreHorizontal size={18} className="text-white/60" />
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { id: 1, name: 'Mean Reversion v4', pair: 'ETH/USD', timeframe: '1h', winRate: '68%', netProfit: '+42.1%', status: 'done', color: '#06b6d4' },
                  { id: 2, name: 'Trend Follower', pair: 'BTC/USD', timeframe: '4h', winRate: '54%', netProfit: '+112.4%', status: 'done', color: '#8b5cf6' },
                  { id: 3, name: 'Scalp Master', pair: 'SOL/USD', timeframe: '5m', winRate: '71%', netProfit: '+18.2%', status: 'running', color: '#f59e0b' },
                  { id: 4, name: 'Grid Bot Q3', pair: 'ARB/USD', timeframe: '15m', winRate: '62%', netProfit: '+24.8%', status: 'done', color: '#10b981' },
                ].map((bt) => (
                  <div key={bt.id} className="group p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: bt.color, boxShadow: \`0 0 8px \${bt.color}\` }} />
                        <h4 className="font-medium text-white/90">{bt.name}</h4>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                        {bt.pair} • {bt.timeframe}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Win Rate</p>
                          <p className="text-sm font-medium text-white/80" style={fontMono}>{bt.winRate}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Net Profit</p>
                          <p className="text-sm font-medium text-emerald-400" style={fontMono}>{bt.netProfit}</p>
                        </div>
                      </div>
                      
                      {bt.status === 'running' ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          Running
                        </div>
                      ) : (
                        <button className="text-white/40 hover:text-white transition-colors">
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <button className="w-full mt-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition-all flex items-center justify-center gap-2">
                <Zap size={16} className="text-cyan-400" /> New Backtest
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Floating Bottom Dock (Mobile & Desktop) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div 
          className="flex items-center gap-2 p-2 rounded-full border border-white/10 shadow-2xl"
          style={{
            background: 'rgba(10, 10, 10, 0.6)',
            backdropFilter: 'blur(32px) saturate(200%)',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)'
          }}
        >
          {[
            { icon: Home, label: 'Home', active: true },
            { icon: Activity, label: 'Markets', active: false },
            { icon: Layers, label: 'Strategies', active: false },
            { icon: Clock, label: 'History', active: false },
            { icon: Wallet, label: 'Portfolio', active: false },
          ].map((item, i) => (
            <button 
              key={i}
              className={\`relative p-3 rounded-full flex items-center justify-center transition-all duration-300 group \${item.active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}\`}
            >
              <item.icon size={22} strokeWidth={item.active ? 2.5 : 2} className={item.active ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : ""} />
              
              {/* Tooltip */}
              <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 origin-bottom">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
