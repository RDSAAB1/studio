"use client";

import React, { useEffect, useState } from "react";
import { Minus, Square, X, Copy, Settings, RefreshCw, Code, Folder } from "lucide-react";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [showDevMenu, setShowDevMenu] = useState(false);

  useEffect(() => {
    // Check if we are in Electron
    const electron = (window as any).electron;
    if (electron && electron.minimize) {
      setIsElectron(true);
      
      const checkMaximized = async () => {
        const maximized = await electron.isMaximized();
        setIsMaximized(maximized);
      };
      
      checkMaximized();
      window.addEventListener("resize", checkMaximized);
      return () => window.removeEventListener("resize", checkMaximized);
    }
  }, []);

  if (!isElectron) return null;

  const electron = (window as any).electron;

  return (
    <>
    {/* Global styles for window controls */}
    <style jsx global>{`
      .electron-content {
        padding-top: 36px !important;
      }
      /* Ensure no standard app-region on body */
      body {
        -webkit-app-region: no-drag;
      }
    `}</style>
    
    <div className="fixed top-0 left-0 right-0 h-9 flex items-center justify-between z-[10000] select-none border-b border-white/[0.08] bg-[#0c1222] shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
      {/* Logo and Draggable area */}
      <div 
        className="flex-1 h-full flex items-center px-4 gap-3 cursor-default" 
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center p-0.5 border border-primary/30">
                <div className="w-full h-full rounded-sm bg-primary shadow-[0_0_10px_rgba(var(--primary),0.6)]" />
            </div>
            <span className="text-[11px] font-bold tracking-widest text-[#94a3b8] hover:text-white transition-colors duration-300 uppercase">JRMD Studio</span>
        </div>
      </div>

      {/* Buttons - NOT draggable */}
      <div className="flex h-full items-center mr-0.5" style={{ WebkitAppRegion: "no-drag" } as any}>
        {/* Developer / Electron Menu Trigger */}
        <button
          onClick={() => setShowDevMenu(!showDevMenu)}
          className={`flex items-center justify-center w-10 h-full transition-all duration-200 ${showDevMenu ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          title="Electron Settings"
        >
          <Settings size={15} className={showDevMenu ? 'rotate-90' : ''} />
        </button>

        <div className="w-[1px] h-4 bg-white/10 mx-1" />

        <button
          onClick={() => electron.minimize()}
          className="flex items-center justify-center w-11 h-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
          title="Minimize"
        >
          <Minus size={16} />
        </button>
        
        <button
          onClick={() => electron.maximize()}
          className="flex items-center justify-center w-11 h-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        
        <button
          onClick={() => electron.close()}
          className="flex items-center justify-center w-12 h-full text-white/50 hover:bg-red-600 hover:text-white transition-all group"
          title="Close"
        >
          <X size={18} className="group-hover:scale-110" />
        </button>
      </div>
    </div>

    {/* Developer Dropdown Menu */}
    {showDevMenu && (
        <>
        <div className="fixed inset-0 z-[10001]" onClick={() => setShowDevMenu(false)} />
        <div className="fixed top-10 right-3 w-64 bg-[#0f172a] border border-white/10 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[10002] overflow-hidden backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-3 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Electron Control Center</p>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="p-1">
                <button 
                    onClick={() => { window.location.reload(); setShowDevMenu(false); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white rounded-md transition-all group"
                >
                    <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
                    <div className="flex flex-col items-start">
                        <span className="font-medium">Force Reload</span>
                        <span className="text-[9px] text-white/20">Restart frontend (F5)</span>
                    </div>
                </button>
                <button 
                    onClick={() => { setShowDevMenu(false); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white rounded-md transition-all group"
                >
                    <Code size={14} />
                    <div className="flex flex-col items-start">
                        <span className="font-medium">Toggle DevTools</span>
                        <span className="text-[9px] text-white/20">Inspected by Chrome (F12)</span>
                    </div>
                </button>
                <div className="h-[1px] bg-white/5 my-1" />
                <button 
                    onClick={() => { (window as any).electron.sqliteGetFolder(); setShowDevMenu(false); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white rounded-md transition-all group"
                >
                    <Folder size={14} />
                    <div className="flex flex-col items-start">
                        <span className="font-medium">Internal Storage</span>
                        <span className="text-[9px] text-white/20">Open database directory</span>
                    </div>
                </button>
            </div>
            <div className="px-3 py-2 border-t border-white/5 bg-black/20 text-[9px] text-white/20 flex justify-between items-center italic">
                <span>Core Engine v2026.03</span>
                <span className="opacity-50 tracking-widest">ADVANCED</span>
            </div>
        </div>
        </>
    )}
    </>
  );
}
