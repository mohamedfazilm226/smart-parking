import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Slot, Booking } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Clock, Calendar, CheckCircle2, QrCode, X, CreditCard, Loader2, MapPin, Trophy, Star, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

const LOCATIONS = ["Trichy LA Cinema", "Trichy Bus Stand", "Trichy Railway Station"];

const TIER_CONFIG = {
  gold: {
    label: 'Gold',
    price: 15,
    icon: Trophy,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    description: 'Priority parking, closest to entrance.'
  },
  silver: {
    label: 'Silver',
    price: 10,
    icon: Star,
    color: 'text-zinc-400',
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    description: 'Standard parking, easy access.'
  },
  bronze: {
    label: 'Bronze',
    price: 5,
    icon: Zap,
    color: 'text-orange-400',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    description: 'Economy parking, slightly further.'
  }
};

export default function CustomerDashboard() {
  const { token, user } = useAuth();
  const [view, setView] = useState<'locations' | 'slots' | 'bookings'>('locations');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState<'details' | 'payment' | 'success' | null>(null);
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    vehicleType: 'car',
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    duration: 1
  });
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLocation) {
      fetchSlots();
    }
  }, [selectedLocation]);

  useEffect(() => {
    fetchMyBookings();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'SLOT_UPDATE') {
        setSlots(prevSlots => 
          prevSlots.map(slot => slot.id === data.slot.id ? data.slot : slot)
        );
      }
    };

    return () => ws.close();
  }, []);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/slots?location=${encodeURIComponent(selectedLocation!)}`);
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    const res = await fetch('/api/bookings/my', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setBookings(data);
  };

  const handleBooking = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          slotId: selectedSlot?.id,
          ...formData
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewBookingId(data.bookingId);
        setBookingStep('success');
        fetchMyBookings();
        setError(null);
      } else {
        setError(data.error || "Booking failed");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (view === 'bookings') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 font-sans">
        <header className="mb-12 flex items-center justify-between">
          <div>
            <button 
              onClick={() => setView('locations')}
              className="text-emerald-600 font-bold text-sm mb-2 hover:underline flex items-center gap-1"
            >
              ← Back to Home
            </button>
            <h1 className="text-4xl font-bold text-zinc-900">My Bookings</h1>
          </div>
        </header>

        <div className="space-y-6">
          {bookings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100">
              <Car className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500">You haven't made any bookings yet.</p>
              <button 
                onClick={() => setView('locations')}
                className="mt-4 text-emerald-600 font-bold hover:underline"
              >
                Book a slot now
              </button>
            </div>
          ) : (
            bookings.map((booking) => (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center"
              >
                <div className="bg-zinc-50 p-4 rounded-2xl">
                  <QRCodeSVG 
                    value={booking.id} 
                    size={80}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-emerald-600 font-bold">{booking.id}</span>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                      {booking.slot_label}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900">{booking.location}</h3>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Car className="w-4 h-4" />
                      <span>{booking.vehicle_number} ({booking.vehicle_type})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Clock className="w-4 h-4" />
                      <span>{format(new Date(booking.start_time), 'MMM d, h:mm a')} ({booking.duration}h)</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase",
                    booking.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  )}>
                    {booking.status}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!selectedLocation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-start mb-12"
        >
          <div className="text-left">
            <h1 className="text-4xl font-bold text-zinc-900 mb-4">Where are you heading?</h1>
            <p className="text-zinc-500 text-lg">Select a location to view available parking slots.</p>
          </div>
          <button 
            onClick={() => setView('bookings')}
            className="bg-white px-6 py-3 rounded-xl border border-zinc-100 shadow-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all flex items-center gap-2"
          >
            <Calendar className="w-5 h-5" />
            My Bookings
          </button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {LOCATIONS.map((loc, i) => (
            <motion.button
              key={loc}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => {
                setSelectedLocation(loc);
                setView('slots');
              }}
              className="group bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all text-left"
            >
              <div className="bg-zinc-50 group-hover:bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                <MapPin className="w-8 h-8 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">{loc}</h3>
              <p className="text-zinc-500 text-sm">View real-time availability and book your spot instantly.</p>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  const displayedTiers = selectedTier ? [selectedTier] : ['gold', 'silver', 'bronze'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => {
              setSelectedLocation(null);
              setSelectedTier(null);
            }}
            className="text-emerald-600 font-bold text-sm mb-2 hover:underline flex items-center gap-1"
          >
            ← Back to Locations
          </button>
          <h1 className="text-4xl font-bold text-zinc-900 mb-2">{selectedLocation}</h1>
          <p className="text-zinc-500">Choose a tier to filter or select a slot directly.</p>
        </div>
        
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-zinc-100 shadow-sm">
          <button 
            onClick={() => setSelectedTier(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              !selectedTier ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
            )}
          >
            All Tiers
          </button>
          {['gold', 'silver', 'bronze'].map(t => (
            <button 
              key={t}
              onClick={() => setSelectedTier(t)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all",
                selectedTier === t ? "bg-emerald-600 text-white" : "text-zinc-500 hover:bg-zinc-50"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Parking Grid */}
        <div className="lg:col-span-2 space-y-8">
          {displayedTiers.map((tier) => {
            const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
            const tierSlots = slots.filter(s => s.tier === tier);
            
            return (
              <motion.div 
                layout
                key={tier} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl", config.bg)}>
                      <config.icon className={cn("w-6 h-6", config.color)} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-zinc-800">{config.label} Tier</h2>
                      <p className="text-sm text-zinc-500">{config.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-600">${config.price}</p>
                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">per hour</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {tierSlots.map((slot) => (
                    <button
                      key={slot.id}
                      disabled={slot.status !== 'available'}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setBookingStep('details');
                        setError(null);
                      }}
                      className={cn(
                        "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden",
                        slot.status === 'available' 
                          ? cn("hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer", config.bg, config.border) 
                          : "border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed",
                        selectedSlot?.id === slot.id && "border-emerald-500 ring-4 ring-emerald-500/10"
                      )}
                    >
                      {slot.status === 'booked' && (
                        <div className="absolute top-0 right-0 w-6 h-6 bg-red-500 flex items-center justify-center rounded-bl-lg">
                          <X className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        slot.status === 'available' ? "text-zinc-700" : "text-zinc-400"
                      )}>
                        {slot.label}
                      </span>
                      <Car className={cn(
                        "w-5 h-5",
                        slot.status === 'available' ? config.color : "text-zinc-300"
                      )} />
                    </button>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Info Sidebar */}
        <div className="space-y-8">
          <div className="bg-zinc-900 text-white p-8 rounded-3xl shadow-xl">
            <h2 className="text-xl font-bold mb-6">Your Recent Bookings</h2>
            {bookings.length === 0 ? (
              <p className="text-zinc-400 text-sm">No bookings yet. Select a slot to get started.</p>
            ) : (
              <div className="space-y-4">
                {bookings.slice(0, 3).map((booking) => (
                  <div key={booking.id} className="bg-white/10 p-4 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-emerald-400">{booking.id}</span>
                      <span className="bg-emerald-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                        {booking.slot_label}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-1">{booking.location}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="w-4 h-4 text-zinc-400" />
                      <span>{booking.vehicle_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{format(new Date(booking.start_time), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl border border-zinc-100">
            <h3 className="font-bold text-zinc-800 mb-4">Parking Tiers</h3>
            <div className="space-y-4">
              {Object.entries(TIER_CONFIG).map(([key, config]) => (
                <button 
                  key={key} 
                  onClick={() => setSelectedTier(key)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left",
                    selectedTier === key ? "border-emerald-500 bg-emerald-50" : "border-transparent hover:bg-zinc-50"
                  )}
                >
                  <div className={cn("p-2 rounded-lg", config.bg)}>
                    <config.icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-800">{config.label}</p>
                    <p className="text-xs text-zinc-500">${config.price}/hr</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {bookingStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              {bookingStep === 'details' && (
                <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-zinc-900">Booking Details</h2>
                    <button onClick={() => { setBookingStep(null); setError(null); }} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                      <X className="w-6 h-6 text-zinc-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="bg-emerald-500 p-2 rounded-xl">
                        <Car className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">{selectedLocation} • {selectedSlot?.tier} Slot</p>
                        <p className="text-lg font-bold text-emerald-900">{selectedSlot?.label}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700">Vehicle Number</label>
                        <input
                          type="text"
                          placeholder="ABC-1234"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          value={formData.vehicleNumber}
                          onChange={e => {
                            setFormData({...formData, vehicleNumber: e.target.value});
                            setError(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700">Vehicle Type</label>
                        <select
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          value={formData.vehicleType}
                          onChange={e => setFormData({...formData, vehicleType: e.target.value})}
                        >
                          <option value="car">Car</option>
                          <option value="bike">Bike</option>
                          <option value="truck">Truck</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700">Start Time</label>
                        <input
                          type="datetime-local"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          value={formData.startTime}
                          onChange={e => {
                            setFormData({...formData, startTime: e.target.value});
                            setError(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700">Duration (Hours)</label>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          value={formData.duration}
                          onChange={e => {
                            setFormData({...formData, duration: parseInt(e.target.value)});
                            setError(null);
                          }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setBookingStep('payment')}
                      disabled={!formData.vehicleNumber}
                      className="w-full bg-zinc-900 text-white font-bold py-4 rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                      Proceed to Payment
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 'payment' && (
                <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-zinc-900">Payment</h2>
                    <button onClick={() => { setBookingStep('details'); setError(null); }} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                      <X className="w-6 h-6 text-zinc-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                      <div className="flex justify-between mb-2">
                        <span className="text-zinc-500">Parking Fee ({selectedSlot?.tier})</span>
                        <span className="font-bold">${(formData.duration * TIER_CONFIG[selectedSlot!.tier].price).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-zinc-500">Service Tax (5%)</span>
                        <span className="font-bold">${(formData.duration * TIER_CONFIG[selectedSlot!.tier].price * 0.05).toFixed(2)}</span>
                      </div>
                      <div className="h-px bg-zinc-200 my-4"></div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Amount</span>
                        <span className="text-emerald-600">${(formData.duration * TIER_CONFIG[selectedSlot!.tier].price * 1.05).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 border-2 border-emerald-500 bg-emerald-50 rounded-2xl flex items-center gap-4">
                        <CreditCard className="w-6 h-6 text-emerald-600" />
                        <div className="flex-1">
                          <p className="font-bold text-emerald-900">Demo Card</p>
                          <p className="text-xs text-emerald-600">**** **** **** 4242</p>
                        </div>
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-2">
                        <X className="w-4 h-4" />
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handleBooking}
                      disabled={loading}
                      className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pay & Confirm Booking</>}
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 'success' && (
                <div className="p-8 text-center">
                  <div className="flex justify-center mb-6">
                    <div className="bg-emerald-100 p-4 rounded-full">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900 mb-2">Booking Confirmed!</h2>
                  <p className="text-zinc-500 mb-8">Your parking spot is reserved. Here is your digital ticket.</p>

                  <div className="bg-zinc-50 p-8 rounded-3xl border-2 border-dashed border-zinc-200 mb-8">
                    <div className="flex justify-center mb-6">
                      <div className="p-4 bg-white rounded-2xl shadow-sm">
                        <QRCodeSVG 
                          value={newBookingId || ''} 
                          size={160}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Booking ID</p>
                        <p className="font-mono font-bold text-zinc-800">{newBookingId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Slot Number</p>
                        <p className="font-bold text-zinc-800">{selectedSlot?.label}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Location</p>
                        <p className="font-bold text-zinc-800 text-xs truncate">{selectedLocation}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Duration</p>
                        <p className="font-bold text-zinc-800">{formData.duration} Hours</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setBookingStep(null);
                        setSelectedSlot(null);
                        setSelectedLocation(null);
                        setSelectedTier(null);
                        setView('locations');
                      }}
                      className="w-full max-w-xs bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
