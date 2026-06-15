import React from 'react';
import { Activity, BarChart2, Bell, ChevronRight, Home, PieChart, Plus, Settings, TrendingDown, TrendingUp, Wallet, Search, Menu } from 'lucide-react';

export function LiquidAurora() {
  return (
    <div style={{ minHeight: '100vh', overflow: 'hidden', position: 'relative', backgroundColor: '#05010d', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes aurora-1 {
          0% { transform: translate(0%, 0%) scale(1) rotate(0deg); opacity: 0.8; }
          33% { transform: translate(10%, -10%) scale(1.2) rotate(10deg); opacity: 0.6; }
          66% { transform: translate(-5%, 15%) scale(0.9) rotate(-5deg); opacity: 0.9; }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); opacity: 0.8; }
        }
        @keyframes aurora-2 {
          0% { transform: translate(0%, 0%) scale(1) rotate(0deg); opacity: 0.7; }
          33% { transform: translate(-15%, 5%) scale(0.8) rotate(-10deg); opacity: 0.9; }
          66% { transform: translate(10%, -10%) scale(1.3) rotate(5deg); opacity: 0.6; }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); opacity: 0.7; }
        }
        @keyframes aurora-3 {
          0% { transform: translate(0%, 0%) scale(1) rotate(0deg); opacity: 0.6; }
          33% { transform: translate(5%, 15%) scale(1.4) rotate(5deg); opacity: 0.8; }
          66% { transform: translate(-10%, -5%) scale(0.9) rotate(-15deg); opacity: 0.5; }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); opacity: 0.6; }
        }
        
        .bg-aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          z-index: 0;
          mix-blend-mode: screen;
        }

        .blob-1 {
          background: radial-gradient(circle, #1a0533 0%, transparent 70%);
          width: 80vw; height: 80vh;
          top: -20vh; left: -10vw;
          animation: aurora-1 20s infinite ease-in-out;
        }
        .blob-2 {
          background: radial-gradient(circle, #0d1b4b 0%, transparent 70%);
          width: 90vw; height: 90vh;
          bottom: -30vh; right: -20vw;
          animation: aurora-2 25s infinite ease-in-out;
        }
        .blob-3 {
          background: radial-gradient(circle, #003d3d 0%, transparent 70%);
          width: 70vw; height: 70vh;
          top: 20vh; right: 10vw;
          animation: aurora-3 22s infinite ease-in-out;
        }

        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          position: relative;
          z-index: 10;
        }

        .glass-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(216, 180, 254, 0.5), rgba(45, 212, 191, 0.5), rgba(244, 114, 182, 0.5));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 0.3; }
          100% { transform: translateX(100%); opacity: 0; }
        }

        .shimmer-card {
          overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
        }
        
        .shimmer-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px -10px rgba(45, 212, 191, 0.3);
        }

        .shimmer-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          transform: translateX(-100%);
        }

        .shimmer-card:hover::after {
          animation: shimmer 1.5s infinite;
        }

        .nav-glow {
          text-shadow: 2px 0 4px rgba(244, 114, 182, 0.5), -2px 0 4px rgba(45, 212, 191, 0.5);
        }

        .text-neon-green { color: #10b981; text-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
        .text-neon-red { color: #f43f5e; text-shadow: 0 0 10px rgba(244, 63, 94, 0.4); }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
      `}</style>

      {/* Background Blobs */}
      <div className="bg-aurora-blob blob-1"></div>
      <div className="bg-aurora-blob blob-2"></div>
      <div className="bg-aurora-blob blob-3"></div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen overflow-y-auto custom-scrollbar pb-24 md:pb-0">
        
        {/* Top Navbar */}
        <header className="glass-panel sticky top-0 px-6 py-4 flex items-center justify-between border-b border-white/5 rounded-b-2xl mx-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-teal-400 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.4)]">
              <Activity size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-wider nav-glow">TradeLab</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <Search size={20} className="text-white/70" />
            </button>
            <button className="p-2 rounded-full hover:bg-white/10 transition-colors relative">
              <Bell size={20} className="text-white/70" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 p-[2px] cursor-pointer hidden md:block">
              <div className="w-full h-full rounded-full bg-black/50 border border-white/10 overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Trade" alt="User" className="w-full h-full object-cover opacity-80" />
              </div>
            </div>
            <button className="md:hidden p-2">
              <Menu size={24} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-8 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Portfolio Overview */}
          <section className="flex flex-col md:flex-row gap-6">
            <div className="glass-panel shimmer-card rounded-3xl p-6 md:p-8 flex-1 flex flex-col justify-between min-h-[200px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/50 text-sm font-medium uppercase tracking-wider mb-1">Total Balance</p>
                  <h2 className="text-4xl md:text-5xl font-light tracking-tight">$124,592.45</h2>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-neon-green flex items-center gap-1 text-sm font-medium">
                  <TrendingUp size={14} />
                  <span>+12.4%</span>
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button className="flex-1 py-3 bg-white/10 hover:bg-white/15 rounded-xl font-medium transition-colors border border-white/5 backdrop-blur-md flex justify-center items-center gap-2">
                  <Plus size={18} /> Deposit
                </button>
                <button className="flex-1 py-3 bg-gradient-to-r from-purple-600/80 to-teal-500/80 hover:from-purple-500/90 hover:to-teal-400/90 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(45,212,191,0.2)] flex justify-center items-center gap-2 border border-white/10">
                  <Activity size={18} /> Trade
                </button>
              </div>
            </div>

            {/* Quick Markets */}
            <div className="grid grid-cols-2 gap-4 flex-1">
              {[
                { symbol: 'BTC', name: 'Bitcoin', price: '$64,230', change: '+2.4%', up: true, chart: 'M 0 20 Q 10 5, 20 15 T 40 10 T 60 5 T 80 15 T 100 0' },
                { symbol: 'ETH', name: 'Ethereum', price: '$3,450', change: '+4.1%', up: true, chart: 'M 0 15 Q 10 20, 20 10 T 40 15 T 60 5 T 80 10 T 100 5' },
                { symbol: 'SOL', name: 'Solana', price: '$145.20', change: '-1.2%', up: false, chart: 'M 0 5 Q 10 15, 20 10 T 40 20 T 60 15 T 80 25 T 100 20' },
                { symbol: 'LINK', name: 'Chainlink', price: '$18.40', change: '+8.4%', up: true, chart: 'M 0 25 Q 10 15, 20 20 T 40 10 T 60 15 T 80 5 T 100 0' },
              ].map((coin) => (
                <div key={coin.symbol} className="glass-panel shimmer-card rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{coin.symbol}</h3>
                      <p className="text-xs text-white/50">{coin.name}</p>
                    </div>
                    <span className={`text-xs font-medium ${coin.up ? 'text-neon-green' : 'text-neon-red'}`}>
                      {coin.change}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-lg font-medium">{coin.price}</p>
                    <svg viewBox="0 0 100 30" className="w-full h-8 mt-2 overflow-visible">
                      <path 
                        d={coin.chart} 
                        fill="none" 
                        stroke={coin.up ? '#10b981' : '#f43f5e'} 
                        strokeWidth="2" 
                        vectorEffect="non-scaling-stroke"
                        style={{ filter: `drop-shadow(0 2px 4px ${coin.up ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'})` }}
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Performance Chart Area */}
          <section className="glass-panel rounded-3xl p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Backtest Performance</h2>
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                {['1D', '1W', '1M', 'YTD', '1Y'].map((tf, i) => (
                  <button key={tf} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${i === 2 ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-64 w-full relative flex items-end">
              {/* Decorative Chart Background Grids */}
              <div className="absolute inset-0 flex flex-col justify-between border-b border-white/5 pb-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-full border-t border-white/5 h-0" />
                ))}
              </div>
              
              {/* Fake Area Chart */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0 z-0 opacity-40">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,100 L0,60 Q10,40 20,50 T40,30 T60,40 T80,20 T100,10 L100,100 Z" fill="url(#chartGrad)" />
                <path d="M0,60 Q10,40 20,50 T40,30 T60,40 T80,20 T100,10" fill="none" stroke="#2dd4bf" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{filter: 'drop-shadow(0 0 6px rgba(45,212,191,0.6))'}} />
              </svg>
              
              <div className="absolute bottom-0 w-full flex justify-between text-[10px] text-white/40 pt-2">
                <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
              </div>
            </div>
          </section>

          {/* Recent Backtests */}
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-xl font-semibold">Recent Backtests</h2>
              <button className="text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors">
                View All <ChevronRight size={14} />
              </button>
            </div>
            
            <div className="space-y-3">
              {[
                { name: 'MACD Trend Follow', pair: 'BTC/USDT', timeframe: '1h', winRate: '64.2%', profit: '+$4,230', status: 'completed' },
                { name: 'RSI Mean Reversion', pair: 'ETH/USDT', timeframe: '15m', winRate: '58.1%', profit: '+$1,120', status: 'completed' },
                { name: 'Bollinger Breakout', pair: 'SOL/USDT', timeframe: '4h', winRate: '42.5%', profit: '-$340', status: 'failed' },
              ].map((test, i) => (
                <div key={i} className="glass-panel shimmer-card rounded-2xl p-4 flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <PieChart size={18} className="text-white/70" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{test.name}</h4>
                      <p className="text-xs text-white/40">{test.pair} • {test.timeframe}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${test.profit.startsWith('+') ? 'text-neon-green' : 'text-neon-red'}`}>
                      {test.profit}
                    </p>
                    <p className="text-xs text-white/50">Win: {test.winRate}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Floating Bottom Dock (Mobile) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm glass-panel rounded-full px-6 py-3 flex justify-between items-center border border-white/10 shadow-2xl z-50">
        <button className="p-2 text-white"><Home size={22} /></button>
        <button className="p-2 text-white/40 hover:text-white transition-colors"><BarChart2 size={22} /></button>
        <button className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-teal-400 flex items-center justify-center -translate-y-4 shadow-[0_4px_20px_rgba(45,212,191,0.4)] border-2 border-[#05010d] text-white">
          <Plus size={24} />
        </button>
        <button className="p-2 text-white/40 hover:text-white transition-colors"><Wallet size={22} /></button>
        <button className="p-2 text-white/40 hover:text-white transition-colors"><Settings size={22} /></button>
      </div>
    </div>
  );
}
