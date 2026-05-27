'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Issue } from '@/lib/types';
import {
  STATUS_COLORS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from '@/lib/types';

/**
 * Single-color pin — used by citizen and public views.
 * Outer ring is paper-warm; the colored dot encodes status.
 */
function makeDefaultIcon(statusColor: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:${statusColor};border:3px solid #f5f1e8;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/**
 * Two-ring pin — admin-only.
 *   Outer ring (larger)  → category (which kind of problem)
 *   Inner dot (smaller)  → status (where it is in the workflow)
 *
 * Thin paper-colored hairline between rings keeps them legible even when
 * the two colors are close in tone.
 */
function makeAdminIcon(categoryColor: string, statusColor: string) {
  return L.divIcon({
    className: 'custom-marker-admin',
    html: `<div style="
      position:relative;width:26px;height:26px;
      border-radius:50%;background:${categoryColor};
      border:2px solid #f5f1e8;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="
        width:16px;height:16px;border-radius:50%;
        background:${statusColor};
        border:1.5px solid #f5f1e8;
      "></div>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

interface IssuesMapProps {
  issues: Issue[];
  height?: string;
  onIssueClick?: (id: string) => void;
  /**
   * 'default' — single status-colored dot (citizens, public map)
   * 'admin'   — two-ring pin: outer = category, inner = status
   */
  variant?: 'default' | 'admin';
}

export default function IssuesMap({
  issues,
  height = '500px',
  onIssueClick,
  variant = 'default',
}: IssuesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const defaultCenter: [number, number] =
      issues.length > 0
        ? [issues[0].location.coordinates[1], issues[0].location.coordinates[0]]
        : [20.5937, 78.9629];

    const map = L.map(mapRef.current).setView(
      defaultCenter,
      issues.length > 0 ? 13 : 5
    );

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
      const statusColor = STATUS_COLORS[issue.status] ?? '#777';
      const categoryColor = CATEGORY_COLORS[issue.category] ?? '#6b6b6b';

      const icon =
        variant === 'admin'
          ? makeAdminIcon(categoryColor, statusColor)
          : makeDefaultIcon(statusColor);

      const marker = L.marker([lat, lng], { icon });

      // Popup — for admin we color-code the meta line so it reads like a key.
      const categoryLabel = CATEGORY_LABELS[issue.category] ?? issue.category;
      const statusLabel = STATUS_LABELS[issue.status] ?? issue.status;

      const popupHTML =
        variant === 'admin'
          ? `
        <div style="font-family:'Inter Tight',sans-serif;min-width:200px">
          <div style="font-family:'Fraunces',serif;font-size:15px;font-weight:600;margin-bottom:6px;line-height:1.2">
            ${escapeHTML(issue.title)}
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${categoryColor};"></span>
            <span style="color:#444">${categoryLabel}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
            <span style="color:#444">${statusLabel}</span>
          </div>
        </div>
      `
          : `
        <div style="font-family:'Inter Tight',sans-serif;min-width:180px">
          <div style="font-family:'Fraunces',serif;font-size:15px;font-weight:600;margin-bottom:4px">
            ${escapeHTML(issue.title)}
          </div>
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em">
            ${categoryLabel} · ${statusLabel}
          </div>
        </div>
      `;

      marker.bindPopup(popupHTML);

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
  }, [issues, onIssueClick, variant]);

  return <div ref={mapRef} style={{ height }} className="border border-ink/20" />;
}

/** Minimal HTML escape — issue titles can contain user input. */
function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}