import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, ShieldCheck, ArrowRight, ParkingCircle, MapPin, Clock, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white border-b border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>
        
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-bold mb-8 shadow-sm">
              <ParkingCircle className="w-4 h-4" />
              Smart Parking Solutions
            </div>
            <h1 className="text-6xl font-black text-slate-900 tracking-tight mb-6 leading-[1.1]">
              Parking Made <span className="text-emerald-600">Simple</span> & Secure.
            </h1>
            <p className="text-xl text-slate-500 mb-12 leading-relaxed">
              Experience the future of parking with real-time slot tracking, instant bookings, and seamless management across multiple locations.
            </p>
          </motion.div>

          {/* Role Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Customer Card */}
            <motion.button
              whileHover={{ y: -8, shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => navigate('/auth?role=customer')}
              className="group relative bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 text-left transition-all hover:border-emerald-500 shadow-xl shadow-slate-200/50"
            >
              <div className="bg-emerald-500 w-16 h-16 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                <Car className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900 mb-4">Customer</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Find available parking slots, book in advance, and manage your digital tickets with ease.
              </p>
              <div className="flex items-center gap-2 text-emerald-600 font-bold group-hover:gap-4 transition-all">
                Start Booking <ArrowRight className="w-5 h-5" />
              </div>
            </motion.button>

            {/* In-charger Card */}
            <motion.button
              whileHover={{ y: -8, shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              onClick={() => navigate('/auth?role=admin')}
              className="group relative bg-slate-900 p-10 rounded-[2.5rem] text-left transition-all hover:ring-4 hover:ring-emerald-500/20 shadow-2xl shadow-slate-900/20"
            >
              <div className="bg-white/10 w-16 h-16 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-md group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">In-charger</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Monitor real-time occupancy, verify customer bookings, and manage parking slots efficiently.
              </p>
              <div className="flex items-center gap-2 text-emerald-400 font-bold group-hover:gap-4 transition-all">
                Admin Portal <ArrowRight className="w-5 h-5" />
              </div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <MapPin className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Prime Locations</h4>
              <p className="text-slate-500 text-sm leading-relaxed">Available at Trichy's most popular destinations including LA Cinema and Railway Station.</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Clock className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Real-time Updates</h4>
              <p className="text-slate-500 text-sm leading-relaxed">Live slot availability tracking ensures you never waste time searching for a spot.</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Secure Bookings</h4>
              <p className="text-slate-500 text-sm leading-relaxed">Encrypted digital tickets and QR-based verification for maximum security.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
