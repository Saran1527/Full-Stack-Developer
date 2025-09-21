import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import "leaflet/dist/leaflet.css";

const palette = {
  gradientBg: "linear-gradient(120deg, #3b86d1 0%, #644fc1 75%)",
  glass: "rgba(255,255,255,0.85)",
  vivid: ["#3b86d1", "#21bf06", "#844fc1", "#2a9d8f", "#ee4962", "#f6c343"],
  axis: "#6c7293"
};

function AnimatedNumber({ value }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  useEffect(() => { animate(count, value, { duration: 1.35, ease: "circOut" }); }, [value]);
  return <motion.span>{rounded}</motion.span>;
}

export default function MapUpDashboard() {
  const [data, setData] = useState([]);
  const [selectedMake, setSelectedMake] = useState(null);
  const [yearRange, setYearRange] = useState([2018, 2024]);

  useEffect(() => {
    fetch("/data/processed_ev_data.json")
      .then(res => res.json())
      .then(json => setData(json));
  }, []);

  const filteredData = useMemo(
    () =>
      data.filter(
        d =>
          (!selectedMake || d.Make === selectedMake) &&
          d.Model_Year >= yearRange[0] &&
          d.Model_Year <= yearRange[1]
      ),
    [data, selectedMake, yearRange]
  );

  const totals = {
    total_ev: filteredData.length,
    latest_year: filteredData.length ? Math.max(...filteredData.map(d => d.Model_Year)) : 0,
    latest_year_count: filteredData.filter(
      d => d.Model_Year === Math.max(...filteredData.map(d => d.Model_Year))
    ).length,
    yoy_growth_pct: 0
  };

  const yearly = Array.from(
    filteredData.reduce((acc, d) => {
      acc.set(d.Model_Year, (acc.get(d.Model_Year) || 0) + 1);
      return acc;
    }, new Map())
  ).map(([year, count]) => ({ year, count }));

  const topMakes = Array.from(
    filteredData.reduce((acc, d) => {
      acc.set(d.Make, (acc.get(d.Make) || 0) + 1);
      return acc;
    }, new Map())
  ).map(([make, count]) => ({ make, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const batteryDist = Array.from(
    filteredData.reduce((acc, d) => {
      const cap = d.Battery_Capacity || 0;
      const range = cap <= 20 ? "0-20 kWh" : cap <= 40 ? "20-40 kWh" : cap <= 60 ? "40-60 kWh" : "60+ kWh";
      acc.set(range, (acc.get(range) || 0) + 1);
      return acc;
    }, new Map())
  ).map(([name, value]) => ({ name, value }));

  const points = filteredData.map((d, idx) => ({
    id: idx,
    city: d.City,
    state: d.State,
    lat: d.Latitude,
    lon: d.Longitude,
    count: 1,
  }));

  // --- Animation/Interaction Variants ---
  const cardVariants = {
    initial: { y: 32, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120, damping: 18 } },
    hover: { scale: 1.08, boxShadow: "0 16px 60px #2196f377", transition: { duration: .29 } }
  };
  const containerVariants = { animate: { transition: { staggerChildren: 0.2 } } };
  const fadeUp = { initial: { opacity: 0, y: 32 }, animate: { opacity: 1, y: 0, transition: { duration: 0.58 } } };

  return (
    <div style={{
      background: palette.gradientBg,
      backgroundAttachment: "fixed",
      minHeight: "100vh",
      fontFamily: "Inter, system-ui, Arial",
   
      margin: "0 auto",
      padding: 24
    }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 34 }}>
        <h1 style={{
          margin: 0,
          color: "#fff",
          letterSpacing: 0.12,
          textShadow: "0 10px 46px #3b86d1a1"
        }}>MapUp — Creative EV Dashboard</h1>

      </header>

      {/* KPIs */}
      <motion.section
        layout
        initial="initial"
        animate="animate"
        variants={containerVariants}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 22,
          marginBottom: 32
        }}>
        {[
          { label: "Total EVs", value: totals.total_ev },
          { label: "Latest Year", value: totals.latest_year, sub: `${totals.latest_year_count} regs` },
          { label: "YoY Growth", value: `${totals.yoy_growth_pct}%` },
          { label: "Top Make", value: topMakes[0]?.make, sub: `${((topMakes[0]?.count / totals.total_ev) * 100).toFixed(1)}%` }
        ].map((kpi, idx) => (
          <motion.div
            key={idx}
            variants={cardVariants}
            whileHover="hover"
            drag
            dragConstraints={{ left: 0, top: 0, right: 0, bottom: 0 }}
            style={{
              padding: 30,
              borderRadius: 28,
              backdropFilter: "blur(14px)",
              background: palette.glass,
              boxShadow: "0 16px 48px #3b86d155",
              cursor: "grab",
              border: "2px solid #e5e7ff55",
              textAlign: "center",
              color: palette.vivid[idx % palette.vivid.length]
            }}>
            <div style={{ fontSize: 13, color: palette.axis }}>{kpi.label}</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>
              <AnimatedNumber value={parseFloat(kpi.value) || 0} />
            </div>
            {kpi.sub && <div style={{ fontSize: 13, color: "#667", marginTop: 6 }}>{kpi.sub}</div>}
          </motion.div>
        ))}
      </motion.section>

      <main style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 22 }}>
        <AnimatePresence>
          <motion.div
            {...fadeUp}
            style={{
              background: palette.glass,
              borderRadius: 32,
              padding: 26,
              boxShadow: "0 4px 44px #2196f344"
            }}>
            <h3 style={{ marginTop: 0, color: "#3b86d1" }}>EV Registrations Over Time</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={yearly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fill: palette.axis }} />
                  <YAxis tick={{ fill: palette.axis }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke={palette.vivid[3]} strokeWidth={4}
                    dot={{ stroke: palette.vivid[0], strokeWidth: 2, fill: palette.vivid[1] }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ marginTop: 24, color: "#844fc1" }}>Top Makes</h3>
            <div style={{ width: "100%", height: 170 }}>
              <ResponsiveContainer>
                <BarChart layout="vertical" data={topMakes}>
                  <XAxis type="number" tick={{ fill: palette.axis }} />
                  <YAxis dataKey="make" type="category" width={100} tick={{ fill: palette.axis }} />
                  <Tooltip />
                  <Bar dataKey="count">
                    {topMakes.map((entry, idx) => (
                      <Cell key={idx} fill={palette.vivid[(idx + 1) % palette.vivid.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <h4 style={{ marginTop: 24, color: palette.vivid[1] }}>Battery Capacity Distribution</h4>
            <div style={{ width: "100%", height: 120 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={batteryDist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={30}
                    outerRadius={55}
                    label
                    fill={palette.vivid[4]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </AnimatePresence>

        <aside style={{ display: "grid", gap: 22 }}>
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.22 }}
            style={{
              background: palette.glass,
              borderRadius: 32,
              padding: 18,
              height: 380,
              boxShadow: "0 4px 26px #3b86d144"
            }}>
            <h3 style={{ marginTop: 0, color: "#3b86d1" }}>Map — Hotspots</h3>
            <div style={{
              height: 230,
              borderRadius: 19,
              overflow: "hidden"
            }}>
              <MapContainer center={[21.0, 78.0]} zoom={5} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {points.map((p) => (
                  <Marker key={p.id} position={[p.lat, p.lon]}>
                    <Popup>
                      <div style={{ fontWeight: 700 }}>{p.city}</div>
                      <div>{p.state}</div>
                      <div>{p.count.toLocaleString()} registrations</div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </motion.div>
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.37 }}
            style={{
              background: palette.glass,
              borderRadius: 28,
              boxShadow: "0 3px 18px #3b86d124",
              padding: 18
            }}>
            <h3 style={{ marginTop: 0, color: "#844fc1" }}>Sample Table</h3>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13
            }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ccd4f661" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "#466" }}>City</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: "#466" }}>State</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: "#466" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <motion.tr
                    key={p.id}
                    initial={{ background: "#fff" }}
                    whileHover={{ backgroundColor: "#f3efffdd", scale: 1.02 }}
                    style={{
                      cursor: "pointer",
                      transition: "0.18s",
                      boxShadow: "0 1px 2px #ccd6ff22"
                    }}>
                    <td style={{ padding: "8px 6px" }}>{p.city}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>{p.state}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>{p.count.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </aside>
      </main>
    </div>
  );
}
