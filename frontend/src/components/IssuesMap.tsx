'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Issue, IssueStatus } from '@/lib/types';

const STATUS_COLORS: Record<IssueStatus, string> = {
  reported: '#c89b3c',
  assigned: '#1e6091',
  in_progress: '#5a6b3a',
  resolved: '#2d5016',
  rejected: '#777',
  needs_reroute: '#b8442e',
};

function makeIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:${color};border:3px solid #f5f1e8;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

interface IssuesMapProps {
  issues: Issue[];
  height?: string;
  onIssueClick?: (id: string) => void;
}

export default function IssuesMap({ issues, height = '500px', onIssueClick }: IssuesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Default to center of India if no issues
    const defaultCenter: [number, number] =
      issues.length > 0
        ? [issues[0].location.coordinates[1], issues[0].location.coordinates[0]]
        : [20.5937, 78.9629];

    const map = L.map(mapRef.current).setView(defaultCenter, issues.length > 0 ? 13 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapInstance.current = map;
    layerRef.current = layer;

    return () => {
      map.remove();
      mapInstance.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !layerRef.current) return;
    layerRef.current.clearLayers();

    const bounds: L.LatLngTuple[] = [];
    issues.forEach((issue) => {
      const [lng, lat] = issue.location.coordinates;
      const marker = L.marker([lat, lng], { icon: makeIcon(STATUS_COLORS[issue.status]) });
      marker.bindPopup(`
        <div style="font-family:'Inter Tight',sans-serif;min-width:180px">
          <div style="font-family:'Fraunces',serif;font-size:15px;font-weight:600;margin-bottom:4px">
            ${issue.title}
          </div>
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em">
            ${issue.category} · ${issue.status.replace('_', ' ')}
          </div>
        </div>
      `);
      if (onIssueClick) {
        marker.on('click', () => onIssueClick(issue._id));
      }
      marker.addTo(layerRef.current!);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 1) {
      mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
    } else if (bounds.length === 1) {
      mapInstance.current.setView(bounds[0], 15);
    }
  }, [issues, onIssueClick]);

  return <div ref={mapRef} style={{ height }} className="border border-ink/20" />;
}
