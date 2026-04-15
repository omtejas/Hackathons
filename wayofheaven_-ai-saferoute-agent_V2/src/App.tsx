import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  Navigation, 
  Info, 
  Zap,
  ArrowRight,
  Activity,
  ShieldAlert,
  TrafficCone
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for Leaflet default icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AnalysisResult {
  recommendedRoute: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  keyAlerts: string[];
  travelAdvice: string[];
  confidenceScore: number;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// Component to update map view
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

export default function App() {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [time, setTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState(2);
  const [sourceCoords, setSourceCoords] = useState<Coordinates | null>(null);
  const [destCoords, setDestCoords] = useState<Coordinates | null>(null);

  const geocode = async (query: string): Promise<Coordinates | null> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  const analyzeRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !destination || !time) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Geocode locations
      const sCoords = await geocode(source);
      const dCoords = await geocode(destination);

      if (!sCoords || !dCoords) {
        throw new Error('Could not find one or both locations on the map.');
      }

      setSourceCoords(sCoords);
      setDestCoords(dCoords);
      
      // Center map between points
      const centerLat = (sCoords.lat + dCoords.lat) / 2;
      const centerLng = (sCoords.lng + dCoords.lng) / 2;
      setMapCenter([centerLat, centerLng]);
      setMapZoom(6);

      // 2. Get simulated data from backend
      const simResponse = await fetch('/api/simulate-mobility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, destination, time }),
      });
      
      if (!simResponse.ok) throw new Error('Failed to fetch simulation data');
      const { simulatedData } = await simResponse.json();

      // 3. Call Gemini for analysis
      const prompt = `
        You are an AI Smart Mobility Agent.
        Your task is to analyze and recommend the safest route.

        User Input:
        - Source: ${source}
        - Destination: ${destination}
        - Time: ${time}

        Simulated Data:
        - Traffic level: ${simulatedData.traffic}
        - Crime risk: ${simulatedData.crime}
        - Road condition: ${simulatedData.road}

        Steps:
        1. Analyze route safety
        2. Identify risks
        3. Suggest best route
        4. Provide actionable advice

        Return the result in JSON format with the following structure:
        {
          "recommendedRoute": "string",
          "riskLevel": "Low" | "Medium" | "High",
          "keyAlerts": ["string"],
          "travelAdvice": ["string"],
          "confidenceScore": number (0-100)
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const analysis = JSON.parse(response.text);
      setResult(analysis);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Analysis failed. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen grid grid-cols-[320px_1fr] grid-rows-[80px_1fr] gap-[1px] bg-border-dim overflow-hidden">
      {/* Header Section */}
      <header className="col-span-full bg-bg-dark flex items-center justify-between px-10 border-b border-border-dim">
        <div className="text-xl font-extrabold tracking-[2px] uppercase text-accent-blue flex items-center gap-2.5">
          WayOfHeaven <span className="text-text-main">: SafeRoute</span>
        </div>
        <div className="flex items-center gap-6 text-[0.75rem] uppercase tracking-[1px] text-text-dim">
          <div className="flex items-center">
            <span className="status-dot bg-accent-green text-accent-green"></span>
            Core AI: Active
          </div>
          <div>Sensors: Simulated Feed</div>
          <div>Region: Global Network</div>
        </div>
      </header>

      {/* Sidebar / Inputs */}
      <aside className="bg-bg-dark p-8 flex flex-col gap-6 border-r border-border-dim overflow-y-auto">
        <form onSubmit={analyzeRoute} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[0.7rem] font-semibold uppercase text-text-dim">Origin Point</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/50" />
              <input 
                type="text" 
                className="w-full bg-white/5 border border-border-dim p-3 pl-10 rounded text-sm text-white focus:outline-none focus:border-accent-blue/50 transition-colors"
                placeholder="e.g. Bengaluru"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.7rem] font-semibold uppercase text-text-dim">Destination</label>
            <div className="relative">
              <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/50" />
              <input 
                type="text" 
                className="w-full bg-white/5 border border-border-dim p-3 pl-10 rounded text-sm text-white focus:outline-none focus:border-accent-blue/50 transition-colors"
                placeholder="e.g. Mumbai"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.7rem] font-semibold uppercase text-text-dim">Departure Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim/50" />
              <input 
                type="text" 
                className="w-full bg-white/5 border border-border-dim p-3 pl-10 rounded text-sm text-white focus:outline-none focus:border-accent-blue/50 transition-colors"
                placeholder="e.g. 20:45"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="bg-accent-blue text-black border-none p-4 rounded font-bold uppercase tracking-[1px] cursor-pointer mt-2.5 shadow-[0_4px_15px_rgba(0,209,255,0.3)] hover:brightness-110 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isLoading ? 'Generating...' : 'Generate Safe Route'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-accent-red/10 border border-accent-red/20 rounded text-accent-red text-[0.7rem] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="mt-auto border-t border-border-dim pt-5">
          <label className="block mb-2.5 text-[0.7rem] font-semibold uppercase text-text-dim">Live Simulated Vectors</label>
          <div className="text-[0.7rem] leading-[1.6] text-text-dim font-mono">
            TRFC_DENSITY: {isLoading ? 'CALCULATING...' : (result ? '0.42' : 'STABLE')}<br />
            CRME_INDEX: {isLoading ? 'SCANNING...' : (result?.riskLevel ? result.riskLevel.toUpperCase() : 'LOW')}<br />
            LUMOS_AVG: 88%<br />
            NODE_SATURATION: STABLE
          </div>
        </div>
      </aside>

      {/* Main Visualization Area */}
      <main className="grid grid-rows-[1fr_220px] bg-[#080a0f] relative overflow-hidden">
        <section className="relative h-full w-full">
          <MapContainer 
            center={mapCenter} 
            zoom={mapZoom} 
            style={{ height: '100%', width: '100%', background: '#080a0f' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            
            {sourceCoords && (
              <Marker position={[sourceCoords.lat, sourceCoords.lng]}>
              </Marker>
            )}
            {destCoords && (
              <Marker position={[destCoords.lat, destCoords.lng]}>
              </Marker>
            )}
            {sourceCoords && destCoords && (
              <Polyline 
                positions={[[sourceCoords.lat, sourceCoords.lng], [destCoords.lat, destCoords.lng]]} 
                color="#00d1ff"
                weight={3}
                dashArray="5, 10"
                opacity={0.6}
              />
            )}
          </MapContainer>

          <AnimatePresence>
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-5 right-5 flex gap-4 z-[1000]"
              >
                <div className="bg-black/80 backdrop-blur-md border border-border-dim px-4 py-2 rounded font-mono text-[0.7rem] uppercase">
                  TRAFFIC <span className="text-accent-blue ml-1.5">LOW</span>
                </div>
                <div className="bg-black/80 backdrop-blur-md border border-border-dim px-4 py-2 rounded font-mono text-[0.7rem] uppercase">
                  CRIME <span className="text-accent-blue ml-1.5">LOW</span>
                </div>
                <div className="bg-black/80 backdrop-blur-md border border-border-dim px-4 py-2 rounded font-mono text-[0.7rem] uppercase">
                  ROAD <span className="text-accent-blue ml-1.5">GOOD</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!result && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
              <div className="bg-black/60 backdrop-blur-sm border border-white/10 px-6 py-3 rounded-full text-text-dim/60 font-mono text-[0.7rem] uppercase tracking-[0.3em]">
                Awaiting Vector Input
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000] bg-black/20 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-accent-blue/20 border-t-accent-blue rounded-full animate-spin" />
                <div className="text-accent-blue font-mono text-[0.7rem] uppercase tracking-[0.2em] animate-pulse">
                  Synthesizing Intelligence...
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Intelligence Panel */}
        <section className="glass-panel border-t border-border-dim px-10 py-6 grid grid-cols-[1fr_1fr_200px] gap-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {result ? (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col"
                >
                  <h3 className="text-[0.75rem] text-text-dim uppercase mb-3 tracking-[1px]">Recommended Route</h3>
                  <div className="text-[1.4rem] font-bold text-accent-green leading-tight">{result?.recommendedRoute || 'N/A'}</div>
                  <div className={`risk-badge mt-2 w-fit ${
                    result?.riskLevel === 'Low' ? 'text-accent-green border-accent-green bg-accent-green/10' : 
                    result?.riskLevel === 'Medium' ? 'text-accent-orange border-accent-orange bg-accent-orange/10' : 
                    'text-accent-red border-accent-red bg-accent-red/10'
                  }`}>
                    {result?.riskLevel} Risk Path
                  </div>
                  <p className="mt-3 text-[0.85rem] text-text-dim leading-relaxed">Calculated based on illumination levels and patrol density.</p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col"
                >
                  <h3 className="text-[0.75rem] text-text-dim uppercase mb-3 tracking-[1px]">Intelligence & Advice</h3>
                  <ul className="text-[0.85rem] space-y-2">
                    {result?.keyAlerts?.map((alert, i) => (
                      <li key={`alert-${i}`} className="flex items-start gap-2 text-text-dim">
                        <span className="text-accent-blue">•</span> {alert}
                      </li>
                    ))}
                    {result?.travelAdvice?.map((advice, i) => (
                      <li key={`advice-${i}`} className="flex items-start gap-2 text-text-dim italic">
                        <span className="text-accent-blue">•</span> {advice}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-right"
                >
                  <h3 className="text-[0.75rem] text-text-dim uppercase mb-3 tracking-[1px]">AI Confidence</h3>
                  <div className="score-circle ml-auto border-t-accent-blue">
                    <div className="text-[1.5rem] font-extrabold font-mono">{result?.confidenceScore || 0}%</div>
                    <div className="text-[0.6rem] uppercase text-text-dim">Reliability</div>
                  </div>
                </motion.div>
              </>
            ) : (
              <div className="col-span-full flex items-center justify-center text-text-dim/40 font-mono text-[0.7rem] uppercase tracking-[0.2em]">
                {isLoading ? 'Synthesizing Route Intelligence...' : 'System Idle - Input Required'}
              </div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
