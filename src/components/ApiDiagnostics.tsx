import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, Cpu, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface ApiLog {
  timestamp: string;
  type: "INFO" | "SUCCESS" | "ERROR";
  endpoint: string;
  message: string;
  payload?: any;
  response?: any;
}

export default function ApiDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLogIdx, setExpandedLogIdx] = useState<number | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/yeminus/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Error fetching API diagnostics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll logs every 5 seconds when open
    let interval: any = null;
    if (isOpen) {
      interval = setInterval(fetchStatus, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Toggle Button */}
      <motion.button
        id="btn-api-console"
        onClick={toggleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-stone-900 text-white shadow-2xl border border-stone-800 text-sm font-semibold hover:bg-stone-850 cursor-pointer"
      >
        <Cpu className={`w-4 h-4 text-[#1C5275] ${isLoading ? 'animate-spin' : ''}`} />
        <span>Consola de APIs Yeminus</span>
        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
      </motion.button>

      {/* Main Drawer Console */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="yeminus-console"
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-[420px] max-w-[calc(100vw-2rem)] h-[580px] bg-stone-950 text-stone-200 rounded-3xl border border-stone-800/80 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-stone-900/50 border-b border-stone-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#1C5275]" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Real-Time ERP Console</h4>
              </div>
              <button 
                onClick={toggleOpen}
                className="text-stone-400 hover:text-white text-xs font-mono uppercase px-2.5 py-1 bg-stone-800 rounded-lg"
              >
                Cerrar
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Connection Status Section */}
              <div className="bg-stone-900/40 border border-stone-800/50 p-4 rounded-2xl space-y-3 font-mono text-[11px]">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px]">Parámetros ERP</span>
                  <button 
                    onClick={fetchStatus} 
                    className="p-1 hover:bg-stone-800 rounded-md transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#1C5275] ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                {status ? (
                  <div className="space-y-1.5 text-stone-300">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Gateway URL:</span>
                      <span className="text-stone-300 font-medium">tienda.impormax.net</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Empresa ID:</span>
                      <span className="text-white font-medium">{status.configured.id_empresa}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Caja / Canal:</span>
                      <span className="text-white font-medium">{status.configured.id_caja}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Usuario API:</span>
                      <span className="text-emerald-400 font-medium">{status.configured.username}</span>
                    </div>
                    <div className="flex justify-between border-t border-stone-800 pt-1.5 mt-1.5">
                      <span className="text-stone-500">Bearer Token:</span>
                      <span className="text-blue-400 text-[10px]">
                        {status.token ? `${status.token} (Vigente)` : 'Sin autenticar'}
                      </span>
                    </div>
                    {status.tokenExpiresIn > 0 && (
                      <div className="flex justify-between">
                        <span className="text-stone-500">Expira en:</span>
                        <span className="text-amber-400 font-medium">{status.tokenExpiresIn}s</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-stone-500 text-center py-2 flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Servidor proxy desconectado</span>
                  </div>
                )}
              </div>

              {/* Logs Stream Header */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span>●</span> Registro de Peticiones y Respuestas
                </h5>

                <div className="space-y-2.5">
                  {logs.length === 0 ? (
                    <div className="text-center py-10 bg-stone-900/10 border border-dashed border-stone-800 rounded-2xl">
                      <p className="text-xs text-stone-500 font-mono">Consola lista. Realiza acciones en la app para ver el flujo.</p>
                    </div>
                  ) : (
                    logs.map((log, idx) => (
                      <div 
                        key={idx}
                        className={`border rounded-2xl overflow-hidden transition-all text-left ${
                          log.type === "SUCCESS" ? "bg-emerald-950/20 border-emerald-900/40" :
                          log.type === "ERROR" ? "bg-rose-950/20 border-rose-900/40" :
                          "bg-stone-900/40 border-stone-800"
                        }`}
                      >
                        {/* Summary Line */}
                        <div 
                          onClick={() => setExpandedLogIdx(expandedLogIdx === idx ? null : idx)}
                          className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                log.type === "SUCCESS" ? "bg-emerald-500/20 text-emerald-400" :
                                log.type === "ERROR" ? "bg-rose-500/20 text-rose-400" :
                                "bg-blue-500/20 text-blue-400"
                              }`}>
                                {log.type}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">{log.timestamp}</span>
                            </div>
                            <h6 className="text-xs font-semibold text-white font-mono break-all">{log.endpoint}</h6>
                            <p className="text-[11px] text-stone-400 line-clamp-1">{log.message}</p>
                          </div>
                          <div>
                            {expandedLogIdx === idx ? <ChevronUp className="w-3.5 h-3.5 text-stone-500" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-500" />}
                          </div>
                        </div>

                        {/* Expanded Payload Detail */}
                        {expandedLogIdx === idx && (
                          <div className="px-4 pb-4 border-t border-stone-800/50 pt-3 space-y-3 font-mono text-[9px] bg-stone-950/80">
                            {log.payload && (
                              <div className="space-y-1">
                                <span className="text-blue-400 block font-bold">Request Payload (JSON):</span>
                                <pre className="p-2.5 bg-stone-900 rounded-lg overflow-x-auto text-stone-300">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.response && (
                              <div className="space-y-1">
                                <span className="text-emerald-400 block font-bold">Response Data (Yeminus ERP):</span>
                                <pre className="p-2.5 bg-stone-900 rounded-lg overflow-x-auto text-stone-300">
                                  {JSON.stringify(log.response, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
