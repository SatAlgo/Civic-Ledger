'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Issue } from '@/lib/types';
import { colorForDepartment, labelForDepartment } from '@/lib/deptColor';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deptIdOf(issue: Issue): string | null {
  const dept = issue.assignedDepartment;
  if (!dept) return null;
  if (typeof dept === 'string') return dept;
  return dept._id ?? null;
}

function deptOf(issue: Issue): { name?: string; code?: string } | null {
  const dept = issue.assignedDepartment;
  if (!dept || typeof dept === 'string') return null;
  return { name: dept.name, code: dept.code };
}

function makeIcon(color: string) {
  return L.divIcon({
    className: 'analytics-marker',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:3px solid #f5f1e8;
      box-shadow:0 2px 5px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

interface AnalyticsMapProps {
  issues: Issue[];
  height?: string;
  onIssueClick?: (id: string) => void;
}

export default function AnalyticsMap({
  issues,
  height = '600px',
  onIssueClick,
}: AnalyticsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const initial: [number, number] =
      issues.length > 0
        ? [issues[0].location.coordinates[1], issues[0].location.coordinates[0]]
        : [20.5937, 78.9629]; // India centroid

    const map = L.map(mapRef.current, { zoomControl: true }).setView(
      initial,
      issues.length > 0 ? 12 : 5
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-draw markers whenever issues change
  useEffect(() => {
    if (!mapInstance.current || !layerRef.current) return;
    layerRef.current.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    for (const issue of issues) {
      if (!issue.location?.coordinates) continue;
      const [lng, lat] = issue.location.coordinates;
      const deptId = deptIdOf(issue);
      const color = colorForDepartment(deptId);
      const deptLabel = labelForDepartment(deptOf(issue));

      const marker = L.marker([lat, lng], { icon: makeIcon(color) });

      // Build popup safely — all interpolated values are escaped
      marker.bindPopup(`
        <div style="font-family:'Inter Tight',sans-serif;min-width:200px;max-width:260px">
          <div style="font-family:'Fraunces',serif;font-size:15px;font-weight:600;line-height:1.25;margin-bottom:6px;color:#0a0a0a">
            ${escapeHtml(issue.title)}
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
            <span style="font-size:11px;color:#1a1a1a">${escapeHtml(deptLabel)}</span>
          </div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.08em;font-family:'JetBrains Mono',monospace">
            ${escapeHtml(issue.category)} · ${escapeHtml(issue.status.replace('_', ' '))}
          </div>
        </div>
      `);

      if (onIssueClick) {
        marker.on('click', () => onIssueClick(issue._id));
      }
      marker.addTo(layerRef.current!);
      bounds.push([lat, lng]);
    }

    if (bounds.length > 1) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    } else if (bounds.length === 1) {
      mapInstance.current.setView(bounds[0], 15);
    }
  }, [issues, onIssueClick]);

  return <div ref={mapRef} style={{ height }} className="border-2 border-ink/15" />;
}
