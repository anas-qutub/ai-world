"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, Users, TrendingUp, Activity, Zap } from "lucide-react";

// Custom tooltip component with command center styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel panel-glow rounded-lg px-3 py-2 text-xs border border-[var(--border-dim)]">
        <p className="text-white font-body font-medium mb-1">{label || payload[0]?.name}</p>
        <div className="space-y-0.5">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-data" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(0) : entry.value}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function StatsDashboard() {
  const stats = useQuery(api.queries.getTerritoryStats);

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-3">
            <Activity className="w-8 h-8 text-[var(--cyber-cyan)] animate-pulse" />
            <div className="absolute inset-0 animate-ping opacity-30">
              <Activity className="w-8 h-8 text-[var(--cyber-cyan)]" />
            </div>
          </div>
          <p className="text-[var(--cyber-cyan)] font-display text-sm tracking-wider">
            ANALYZING<span className="loading-dots" />
          </p>
        </div>
      </div>
    );
  }

  const { totals, byTerritory } = stats;

  // Prepare data for radar chart
  const radarData = [
    { stat: "Food", ...Object.fromEntries(byTerritory.map(t => [t.name, t.food])) },
    { stat: "Wealth", ...Object.fromEntries(byTerritory.map(t => [t.name, t.wealth])) },
    { stat: "Tech", ...Object.fromEntries(byTerritory.map(t => [t.name, t.technology])) },
    { stat: "Military", ...Object.fromEntries(byTerritory.map(t => [t.name, t.military])) },
    { stat: "Happy", ...Object.fromEntries(byTerritory.map(t => [t.name, t.happiness])) },
    { stat: "Influence", ...Object.fromEntries(byTerritory.map(t => [t.name, t.influence])) },
  ];

  // Population pie data
  const populationData = byTerritory.map(t => ({
    name: t.name,
    value: t.population,
    color: t.color,
  }));

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto stagger-children">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-[var(--cyber-cyan)]/10 border border-[var(--cyber-cyan)]/30">
          <BarChart3 className="w-5 h-5 text-[var(--cyber-cyan)]" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-wide text-white">ANALYTICS</h2>
          <p className="text-[10px] text-[var(--text-muted)] font-data tracking-wider">GLOBAL METRICS</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="panel panel-glow rounded-lg p-3 text-center group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-[var(--holo-blue)]" />
            <span className="text-[9px] text-[var(--text-muted)] font-display tracking-widest">POPULATION</span>
          </div>
          <div className="text-2xl font-display font-bold text-white group-hover:text-[var(--holo-blue)] transition-colors">
            {totals.population}
          </div>
        </div>
        <div className="panel panel-glow rounded-lg p-3 text-center group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-[var(--success-green)]" />
            <span className="text-[9px] text-[var(--text-muted)] font-display tracking-widest">AVG FOOD</span>
          </div>
          <div className="text-2xl font-display font-bold text-[var(--success-green)]">
            {Math.round(totals.food)}
          </div>
        </div>
        <div className="panel panel-glow rounded-lg p-3 text-center group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-[var(--warning-amber)]" />
            <span className="text-[9px] text-[var(--text-muted)] font-display tracking-widest">MORALE</span>
          </div>
          <div className="text-2xl font-display font-bold text-[var(--warning-amber)]">
            {Math.round(totals.happiness)}
          </div>
        </div>
      </div>

      {/* Population Pie Chart */}
      <div className="panel panel-glow rounded-lg p-4 mb-4">
        <h3 className="text-xs font-display text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--plasma-purple)]" />
          Population Distribution
        </h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={populationData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
              >
                {populationData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{ filter: `drop-shadow(0 0 4px ${entry.color})` }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resource Comparison Bar Chart */}
      <div className="panel panel-glow rounded-lg p-4 mb-4">
        <h3 className="text-xs font-display text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--cyber-cyan)]" />
          Resource Comparison
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byTerritory} layout="vertical">
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={{ stroke: "var(--border-dim)" }}
                tickLine={{ stroke: "var(--border-dim)" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={85}
                tick={{ fill: "var(--text-secondary)", fontSize: 10, fontFamily: "'Exo 2', sans-serif" }}
                axisLine={{ stroke: "var(--border-dim)" }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="food" fill="var(--success-green)" name="Food" radius={[0, 2, 2, 0]} />
              <Bar dataKey="technology" fill="var(--cyber-cyan)" name="Technology" radius={[0, 2, 2, 0]} />
              <Bar dataKey="military" fill="var(--danger-red)" name="Military" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar Chart - Overall Comparison */}
      <div className="panel panel-glow rounded-lg p-4">
        <h3 className="text-xs font-display text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--warning-amber)]" />
          Overall Comparison
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border-dim)" strokeOpacity={0.6} />
              <PolarAngleAxis
                dataKey="stat"
                tick={{ fill: "var(--text-secondary)", fontSize: 10, fontFamily: "'Orbitron', monospace" }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={{ fill: "var(--text-muted)", fontSize: 8, fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={false}
              />
              {byTerritory.map((territory) => (
                <Radar
                  key={territory.name}
                  name={territory.name}
                  dataKey={territory.name}
                  stroke={territory.color}
                  fill={territory.color}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{
                  fontSize: "10px",
                  fontFamily: "'Exo 2', sans-serif",
                  paddingTop: "10px"
                }}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
