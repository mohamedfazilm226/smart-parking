import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Booking, Slot } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Car, 
  QrCode,
  ArrowUpRight,
  TrendingUp,
  Users,
  ParkingCircle,
  Loader2,
  X,
  AlertCircle,
  Camera,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Html5Qrcode } from 'html5-qrcode';

const LOCATIONS = ["Trichy LA Cinema", "Trichy Bus Stand", "Trichy Railway Station"];

export default function AdminDashboard() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchData();

    // WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'SLOT_UPDATE') {
        setSlots(prevSlots => 
          prevSlots.map(slot => slot.id === data.slot.id ? data.slot : slot)
        );
        fetchData();
      }
    };

    return () => {
      ws.close();
      stopScanner();
    };
  }, []);

  const requestPermission = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // If successful, stop the stream immediately and start the scanner
      stream.getTracks().forEach(track => track.stop());
      startScanner();
    } catch (err: any) {
      console.error("Manual permission request error:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please click the camera icon in your browser's address bar to allow access.");
      } else {
        setCameraError("Could not access camera. Please ensure your device has a camera and it is not being used by another app.");
      }
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    setScanResult(null);
    setScanError(null);
    
    // Small delay to ensure the DOM element "reader" is rendered
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          onScanFailure
        );
      } catch (err: any) {
        console.error("Camera start error:", err);
        if (err?.toString().includes("Permission denied")) {
          setCameraError("Camera permission was denied. Please allow camera access in your browser settings.");
        } else {
          setCameraError("Could not access camera. Please ensure no other app is using it and try again.");
        }
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Stop scanner error:", err);
      }
    }
  };

  useEffect(() => {
    if (isScanning) {
      startScanner();
    } else {
      stopScanner();
    }
  }, [isScanning]);

  const onScanSuccess = async (decodedText: string) => {
    console.log("Scanned text:", decodedText);
    try {
      // Stop scanner immediately on success to prevent multiple scans
      await stopScanner();
      
      let bookingId = decodedText;
      // Try to parse if it's JSON (for backward compatibility)
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          bookingId = parsed.id;
        }
      } catch (e) {
        // Not JSON, use as is
      }
      
      verifyTicket(bookingId);
    } catch (err) {
      setScanError("An error occurred during verification");
    }
  };

  const verifyTicket = async (bookingId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/verify-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookingId: bookingId.trim().toUpperCase() })
      });

      const data = await res.json();
      if (res.ok) {
        setScanResult(data);
        setScanError(null);
        fetchData();
      } else {
        setScanError(data.error || "Invalid Ticket ID");
        setScanResult(null);
      }
    } catch (err) {
      setScanError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onScanFailure = (error: any) => {
    // Silently ignore scan failures
  };

  const [manualId, setManualId] = useState('');

  const fetchData = async () => {
    try {
      const [bookingsRes, slotsRes] = await Promise.all([
        fetch('/api/admin/bookings', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/slots')
      ]);
      const bookingsData = await bookingsRes.json();
      const slotsData = await slotsRes.json();
      setBookings(bookingsData);
      setSlots(slotsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateSlotStatus = async (slotId: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/slots/${slotId}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBookings = bookings.filter(b => 
    (b.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
     b.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
     b.slot_label.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterStatus === 'all' || b.status === filterStatus)
  );

  const stats = [
    { label: 'Total Bookings', value: bookings.length, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Slots', value: slots.filter(s => s.status !== 'available').length, icon: ParkingCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Available Slots', value: slots.filter(s => s.status === 'available').length, icon: LayoutGrid, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Revenue', value: `$${(bookings.length * 5.25).toFixed(2)}`, icon: ArrowUpRight, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-2">Admin Dashboard</h1>
          <p className="text-zinc-500">Manage parking slots, monitor bookings, and track revenue.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsScanning(true)}
            className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
          >
            <QrCode className="w-5 h-5" />
            Scan Ticket
          </button>
        </div>
      </header>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScanning(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">Scan Ticket QR</h3>
                <button 
                  onClick={() => setIsScanning(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              
              <div className="p-6">
                {!scanResult && !scanError && !cameraError && (
                  <div className="space-y-6">
                    <div id="reader" className="overflow-hidden rounded-2xl border-2 border-zinc-200 bg-zinc-900 aspect-square flex items-center justify-center relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-zinc-200"></span>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-zinc-400 font-bold">Or Enter Manually</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Enter Booking ID (e.g. BK-123456)"
                        className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-mono uppercase"
                        value={manualId}
                        onChange={e => setManualId(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && manualId && verifyTicket(manualId)}
                      />
                      <button 
                        onClick={() => manualId && verifyTicket(manualId)}
                        disabled={!manualId}
                        className="bg-zinc-900 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="space-y-6 py-4">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <Camera className="w-8 h-8 text-amber-600" />
                      </div>
                      <h4 className="text-lg font-bold text-zinc-900">Camera Access Required</h4>
                      <p className="text-sm text-zinc-500 mt-2 px-4">
                        {cameraError}
                      </p>
                    </div>
                    <button 
                      onClick={requestPermission}
                      className="w-full bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Request Permission
                    </button>
                  </div>
                )}

                {scanResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </div>
                      <h4 className="text-lg font-bold text-zinc-900">Ticket Verified</h4>
                      <p className="text-sm text-zinc-500">Booking ID: {scanResult.id}</p>
                    </div>

                    <div className="bg-zinc-50 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Vehicle</span>
                        <span className="font-bold text-zinc-900">{scanResult.vehicle_number}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Location</span>
                        <span className="font-bold text-zinc-900">{scanResult.location}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Slot</span>
                        <span className="font-bold text-zinc-900">{scanResult.slot_label} ({scanResult.tier})</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">User</span>
                        <span className="font-bold text-zinc-900">{scanResult.user_email}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setScanResult(null)}
                      className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                    >
                      Scan Another
                    </button>
                  </motion.div>
                )}

                {scanError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                      </div>
                      <h4 className="text-lg font-bold text-zinc-900">Verification Failed</h4>
                      <p className="text-sm text-red-500 mt-1">{scanError}</p>
                    </div>

                    <button 
                      onClick={() => setScanError(null)}
                      className="w-full bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                    >
                      Try Again
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Bookings Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-6 border-bottom border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-zinc-800">Recent Bookings</h2>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    className="pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Booking ID</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Slot</th>
                    <th className="px-6 py-4">Vehicle</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-emerald-600 font-bold">{booking.id}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-zinc-600">{booking.location}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="bg-zinc-100 text-zinc-700 px-2 py-1 rounded text-[10px] font-bold w-fit">
                            {booking.slot_label}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-zinc-400 mt-1">{booking.tier}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm font-medium">{booking.vehicle_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500">{booking.user_email}</td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {format(new Date(booking.start_time), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          booking.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                        )}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Slot Management */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-800 mb-6">Slot Management</h2>
            <div className="space-y-8">
              {LOCATIONS.map(loc => (
                <div key={loc}>
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">{loc}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {slots.filter(s => s.location === loc).map((slot) => (
                      <div 
                        key={slot.id}
                        className={cn(
                          "p-2 rounded-lg border flex flex-col items-center gap-1 transition-all",
                          slot.status === 'available' ? "border-emerald-100 bg-emerald-50/30" : 
                          slot.status === 'booked' ? "border-amber-100 bg-amber-50/30" : "border-red-100 bg-red-50/30"
                        )}
                      >
                        <span className="text-[9px] font-bold text-zinc-500">{slot.label}</span>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => updateSlotStatus(slot.id, 'available')}
                            className={cn(
                              "p-1 rounded-md transition-all",
                              slot.status === 'available' ? "bg-emerald-500 text-white" : "text-zinc-400 hover:bg-zinc-100"
                            )}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            onClick={() => updateSlotStatus(slot.id, 'occupied')}
                            className={cn(
                              "p-1 rounded-md transition-all",
                              slot.status === 'occupied' ? "bg-red-500 text-white" : "text-zinc-400 hover:bg-zinc-100"
                            )}
                          >
                            <XCircle className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-600 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">System Health</h3>
              <p className="text-emerald-100 text-sm mb-6">All systems are operational. Database sync is active.</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                <span className="text-xs font-bold uppercase tracking-widest">Live Monitoring</span>
              </div>
            </div>
            <ParkingCircle className="absolute -right-8 -bottom-8 w-32 h-32 text-white/10 rotate-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
