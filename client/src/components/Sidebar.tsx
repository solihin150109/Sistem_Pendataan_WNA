import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  ShieldCheck,
  Globe,
  Briefcase,
  CalendarCheck,
  X,
  Compass
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const menuItems = [
    { name: 'Dashboard Monitoring', path: '/', icon: LayoutDashboard },
    { name: 'Data Visa on Arrival', path: '/data/voa', icon: Globe },
    { name: 'Izin Tinggal Kunjungan', path: '/data/itk', icon: CalendarCheck },
    { name: 'Izin Tinggal Terbatas', path: '/data/itas', icon: Briefcase },
    { name: 'Izin Tinggal Tetap', path: '/data/itap', icon: ShieldCheck },
    { name: 'Explorasi Geospasial', path: '/map', icon: MapIcon },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-slate-900 text-slate-100 border-r border-slate-800">
      <div className="flex items-center justify-between p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-blue text-white shadow-xl shadow-primary-blue/20">
             <Compass className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white uppercase">SI-WNA</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5">Imigrasi Jambi</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden h-10 w-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-4">
        <div className="px-4 mb-4">
           <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Main Menu</span>
        </div>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3.5 px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 rounded-2xl",
                isActive 
                  ? "bg-primary-blue text-white shadow-lg shadow-primary-blue/20" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-6 mt-auto">
         <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-3">
               <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
               <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">System Health: OK</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
               <div className="bg-primary-blue h-full w-[85%]"></div>
            </div>
         </div>
      </div>
    </div>
  );
}
