
import React, { useState, useEffect } from 'react';
import { discoverLeads } from './Services/gemini';
import { BusinessLead, SearchResult } from './types';
import { 
  PhoneIcon, 
  MagnifyingGlassIcon, 
  MapPinIcon, 
  GlobeAltIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [query, setQuery] = useState('Roofing contractors in Miami, FL');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [sources, setSources] = useState<SearchResult['groundingSources']>([]);
  const [selectedLead, setSelectedLead] = useState<BusinessLead | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stats, setStats] = useState([
    { name: 'Pending', value: 0, color: '#94a3b8' },
    { name: 'Called', value: 0, color: '#6366f1' },
    { name: 'Success', value: 0, color: '#22c55e' },
  ]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Location access denied")
      );
    }
  }, []);

  useEffect(() => {
    const pending = leads.filter(l => l.status === 'pending').length;
    const completed = leads.filter(l => l.status === 'completed').length;
    const failed = leads.filter(l => l.status === 'failed').length;
    
    setStats([
      { name: 'Pending', value: pending, color: '#94a3b8' },
      { name: 'Called', value: completed + failed, color: '#6366f1' },
      { name: 'Success', value: completed, color: '#22c55e' },
    ]);
  }, [leads]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    try {
      const result = await discoverLeads(query, userLocation || undefined);
      setLeads(result.leads);
      setSources(result.groundingSources);
      if (result.leads.length > 0) setSelectedLead(result.leads[0]);
    } catch (error) {
      console.error(error);
      alert("Error finding leads. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (lead: BusinessLead) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'calling' } : l));
    // The phone number is already normalized to +1XXXXXXXXXX in discoverLeads
    const zoomUrl = `tel:${lead.phone}`;
    window.location.href = zoomUrl;
  };

  const updateStatus = (id: string, status: BusinessLead['status']) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    if (selectedLead?.id === id) {
      setSelectedLead(prev => prev ? { ...prev, status } : null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Sidebar - Control & Stats */}
      <aside className="w-full lg:w-80 bg-white border-r border-slate-200 p-6 flex-shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <PhoneIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">LeadStream AI</h1>
        </div>

        <form onSubmit={handleSearch} className="space-y-4 mb-10">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Maps Search Query</label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Italian restaurants in NYC"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
              <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 px-1 italic">Fetching up to 20 leads directly from Google Maps</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Fetch New Leads'}
          </button>
        </form>

        <div className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Daily Outreach</h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {sources.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Verified Map Sources</h2>
            <ul className="space-y-1">
              {sources.slice(0, 5).map((source, i) => (
                <li key={i}>
                  <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <GlobeAltIcon className="w-3 h-3" />
                    {source.title.length > 25 ? source.title.substring(0, 25) + '...' : source.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Main Content - Lead Table */}
      <main className="flex-grow p-4 lg:p-8 overflow-y-auto">
        <header className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Lead Dashboard</h2>
            <p className="text-slate-500 text-sm">Automated business discovery via Google Maps.</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-slate-400 uppercase">Current Batch</span>
            <div className="text-2xl font-bold text-indigo-600">{leads.length}</div>
          </div>
        </header>

        {leads.length === 0 && !loading ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl h-96 flex flex-col items-center justify-center text-slate-400">
            <MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium text-slate-600">No leads found.</p>
            <p className="text-sm">Enter a search query to pull data from Google Maps.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Business</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Contact (+1 Dial)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className={`hover:bg-indigo-50/30 transition cursor-pointer ${selectedLead?.id === lead.id ? 'bg-indigo-50/50' : ''}`}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{lead.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPinIcon className="w-3 h-3" />
                        {lead.address.length > 50 ? lead.address.substring(0, 50) + '...' : lead.address}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        lead.status === 'completed' ? 'bg-green-100 text-green-700' :
                        lead.status === 'calling' ? 'bg-indigo-100 text-indigo-700 animate-pulse' :
                        lead.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-indigo-600">{lead.phone}</div>
                      <div className="text-[10px] text-slate-400 font-medium">Auto +1 formatting applied</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCall(lead);
                        }}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-transform active:scale-95"
                      >
                        <PhoneIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Right Sidebar - Lean Lead Details */}
      {selectedLead && (
        <aside className="w-full lg:w-96 bg-white border-l border-slate-200 p-6 flex flex-col h-full sticky top-0 overflow-y-auto">
          <div className="flex justify-between items-start mb-8">
            <h3 className="text-lg font-bold text-slate-900">Lead Details</h3>
            <button 
              onClick={() => setSelectedLead(null)}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <XCircleIcon className="w-6 h-6 text-slate-300 hover:text-slate-400" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <div className="text-xs font-bold text-indigo-500 uppercase mb-1">{selectedLead.category || 'Business'}</div>
              <div className="font-bold text-slate-900 text-xl mb-4">{selectedLead.name}</div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="text-sm text-slate-600">{selectedLead.address}</div>
                </div>
                <div className="flex items-center gap-3">
                  <PhoneIcon className="w-5 h-5 text-slate-400" />
                  <div className="text-sm font-bold text-slate-900">{selectedLead.phone}</div>
                </div>
                {selectedLead.website && (
                  <div className="flex items-center gap-3">
                    <GlobeAltIcon className="w-5 h-5 text-slate-400" />
                    <a href={selectedLead.website} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                      Visit Website
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <InformationCircleIcon className="w-5 h-5 text-slate-400" />
                  <div className="text-sm text-slate-600 font-medium">Rating: <span className="text-indigo-600 font-bold">★ {selectedLead.rating || 'N/A'}</span></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleCall(selectedLead)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition active:scale-[0.98]"
              >
                <PhoneIcon className="w-5 h-5" />
                Call {selectedLead.phone}
              </button>
              <p className="text-[10px] text-center text-slate-400">This will initiate a call via your system default dialer (Zoom).</p>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-4 tracking-widest">Mark Outcome</h4>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => updateStatus(selectedLead.id, 'completed')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition ${
                    selectedLead.status === 'completed' 
                    ? 'bg-green-600 text-white border-green-600' 
                    : 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100'
                  }`}
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  Success
                </button>
                <button 
                  onClick={() => updateStatus(selectedLead.id, 'failed')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition ${
                    selectedLead.status === 'failed' 
                    ? 'bg-red-600 text-white border-red-600' 
                    : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                  }`}
                >
                  <XCircleIcon className="w-5 h-5" />
                  No Answer
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default App;
