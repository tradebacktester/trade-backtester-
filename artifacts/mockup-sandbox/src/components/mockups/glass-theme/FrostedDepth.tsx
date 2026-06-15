import React from 'react';
import { LineChart, BarChart2, Activity, Clock, Settings, Home, Search, Bell, Menu, TrendingUp, TrendingDown, MoreHorizontal, Zap, PieChart, ChevronUp, ChevronDown } from 'lucide-react';

export function FrostedDepth() {
  return (
    <div 
      className="text-white relative overflow-hidden"
      style={{ 
        minHeight: '100vh', 
        backgroundColor: '#0a0e1a', 
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
      }}
    >
      <style>{`
        .bg-blob-1 {
          position: absolute;
          top: -10%;
          left: -10%;
          width: 50vw;
          height: 50vw;
          background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(10,14,26,0) 70%);
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
          z-index: 0;
        }
        .bg-blob-2 {
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 60vw;
          height: 60vw;
          background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(10,14,26,0) 70%);
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .bg-blob-3 {
          position: absolute;
          top: 30%;
          left: 40%;
          width: 40vw;
          height: 40vw;
          background: radial-gradient(circle, rgba(56,189,248,0.08) 0%, rgba(10,14,26,0) 70%);
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
        }

        .glass-panel {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
          position: relative;
          overflow: hidden;
        }
        
        .glass-inner {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }

        .mono-num {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-variant-numeric: tabular-nums;
        }

        .electric-text {
          background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .glass-nav-pill {
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 100px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }

        .glass-button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s ease;
        }
        .glass-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        /* Scrollbar hiding */
        ::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
      `}</style>

      {/* Background elements */}
      <div className="bg-blob-1" />
      <div className="bg-blob-2" />
      <div className="bg-blob-3" />

      {/* Main Layout */}
      <div className="relative z-10 flex flex-col h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Top Navigation Pill */}
        <header className="glass-nav-pill flex items-center justify-between px-6 py-3 mb-8 mx-auto w-full max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Zap size={16} className="text-blue-400" />
            </div>
            <span className="font-semibold tracking-wide text-white/90">TradeLab</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/60">
            <a href="#" className="text-white">Dashboard</a>
            <a href="#" className="hover:text-white transition-colors">Backtests</a>
            <a href="#" className="hover:text-white transition-colors">Strategies</a>
            <a href="#" className="hover:text-white transition-colors">Academy</a>
          </nav>

          <div className="flex items-center gap-4">
            <button className="text-white/60 hover:text-white transition-colors">
              <Search size={18} />
            </button>
            <button className="text-white/60 hover:text-white transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full border border-[#0a0e1a]"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 border border-white/20 ml-2"></div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pb-24">
          
          <div className="mb-8">
            <h1 className="text-3xl font-light text-white/90 mb-1 tracking-tight">Overview</h1>
            <p className="text-sm text-white/50">Performance across all active algorithms.</p>
          </div>

          {/* Market Tickers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { symbol: 'BTC/USD', price: '64,230.50', change: '+2.4%', up: true },
              { symbol: 'ETH/USD', price: '3,450.20', change: '+1.8%', up: true },
              { symbol: 'SOL/USD', price: '145.80', change: '-0.5%', up: false },
              { symbol: 'NVDA', price: '1,240.10', change: '+4.2%', up: true },
            ].map((asset, i) => (
              <div key={i} className="glass-panel p-4 flex flex-col justify-between h-28">
                <div className="flex justify-between items-start text-sm">
                  <span className="font-medium text-white/70">{asset.symbol}</span>
                  <span className={`flex items-center text-xs font-medium ${asset.up ? 'text-green-400' : 'text-red-400'}`}>
                    {asset.up ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {asset.change}
                  </span>
                </div>
                <div>
                  <div className="mono-num text-xl font-semibold text-white/95">${asset.price}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Chart Area */}
          <div className="glass-panel p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-white/90">Portfolio Equity</h2>
              <div className="glass-inner flex p-1">
                {['1D', '1W', '1M', '3M', 'YTD', '1Y'].map((tf, i) => (
                  <button 
                    key={tf} 
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${i === 2 ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-64 flex items-end gap-2 mt-4 relative">
              {/* Fake chart bars */}
              {Array.from({ length: 40 }).map((_, i) => {
                const height = 20 + Math.random() * 80;
                const isPositive = Math.random() > 0.4;
                return (
                  <div 
                    key={i} 
                    className="flex-1 rounded-t-sm opacity-60 hover:opacity-100 transition-opacity"
                    style={{ 
                      height: \`\${height}%\`, 
                      background: isPositive 
                        ? 'linear-gradient(to top, rgba(59,130,246,0.2), rgba(59,130,246,0.8))' 
                        : 'linear-gradient(to top, rgba(255,255,255,0.05), rgba(255,255,255,0.2))' 
                    }}
                  />
                )
              })}
              
              {/* Chart overlay line */}
              <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path 
                  d="M0,80 Q10,70 20,75 T40,60 T60,40 T80,30 T100,10" 
                  fill="none" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: 'drop-shadow(0px 4px 8px rgba(59,130,246,0.4))' }}
                />
              </svg>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Recent Backtests */}
            <div className="glass-panel p-6 md:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-white/90">Recent Backtests</h2>
                <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">View All</button>
              </div>
              
              <div className="space-y-3">
                {[
                  { name: 'Mean Reversion v2', asset: 'ETH/USD', winRate: '68.4%', pnl: '+$4,250', status: 'Completed', time: '2h ago' },
                  { name: 'Momentum Breakout', asset: 'BTC/USD', winRate: '54.2%', pnl: '+$1,120', status: 'Completed', time: '5h ago' },
                  { name: 'Grid Scalper', asset: 'SOL/USD', winRate: '72.1%', pnl: '-$340', status: 'Completed', time: '1d ago' },
                ].map((test, i) => (
                  <div key={i} className="glass-inner p-4 flex items-center justify-between group hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Activity size={18} className="text-white/60 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white/90">{test.name}</div>
                        <div className="text-xs text-white/50 mt-1 flex items-center gap-2">
                          <span>{test.asset}</span>
                          <span className="w-1 h-1 rounded-full bg-white/20"></span>
                          <span>{test.time}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`mono-num text-sm font-medium ${test.pnl.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                        {test.pnl}
                      </div>
                      <div className="text-xs text-white/50 mt-1">WR: <span className="mono-num text-white/70">{test.winRate}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Stats */}
            <div className="glass-panel p-6 flex flex-col">
              <h2 className="text-lg font-medium text-white/90 mb-6">Key Metrics</h2>
              
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="glass-inner p-4 flex flex-col justify-center text-center">
                  <span className="text-xs text-white/50 mb-1">Total PnL</span>
                  <span className="electric-text text-xl font-bold mono-num">+$12,450</span>
                </div>
                <div className="glass-inner p-4 flex flex-col justify-center text-center">
                  <span className="text-xs text-white/50 mb-1">Win Rate</span>
                  <span className="text-white/90 text-xl font-medium mono-num">64.2%</span>
                </div>
                <div className="glass-inner p-4 flex flex-col justify-center text-center">
                  <span className="text-xs text-white/50 mb-1">Profit Factor</span>
                  <span className="text-white/90 text-xl font-medium mono-num">1.84</span>
                </div>
                <div className="glass-inner p-4 flex flex-col justify-center text-center">
                  <span className="text-xs text-white/50 mb-1">Max Drawdown</span>
                  <span className="text-red-400/90 text-xl font-medium mono-num">-12.5%</span>
                </div>
              </div>
              
              <button className="glass-button w-full mt-4 py-3 rounded-xl text-sm font-medium text-white/80 flex items-center justify-center gap-2">
                <Settings size={16} />
                Algorithm Settings
              </button>
            </div>
            
          </div>
        </main>
        
      </div>

      {/* Floating Bottom Dock (Mobile/Tablet) */}
      <div className="md:hidden fixed bottom-6 left-0 right-0 flex justify-center z-50 px-4">
        <div className="glass-nav-pill px-6 py-4 flex items-center gap-8 w-full max-w-sm justify-between">
          <button className="text-blue-400 flex flex-col items-center gap-1">
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button className="text-white/50 hover:text-white/80 transition-colors flex flex-col items-center gap-1">
            <LineChart size={20} />
            <span className="text-[10px] font-medium">Tests</span>
          </button>
          <button className="text-white/50 hover:text-white/80 transition-colors flex flex-col items-center gap-1">
            <PieChart size={20} />
            <span className="text-[10px] font-medium">Stats</span>
          </button>
          <button className="text-white/50 hover:text-white/80 transition-colors flex flex-col items-center gap-1">
            <Menu size={20} />
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </div>
      </div>
      
    </div>
  );
}
