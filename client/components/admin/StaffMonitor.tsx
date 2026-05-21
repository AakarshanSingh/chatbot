"use client";

import { StaffStatus } from "@/types";

interface Props {
  staffList: StaffStatus[];
}

export default function StaffMonitor({ staffList }: Props) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "free":
        return "status-free";
      case "busy":
        return "status-busy";
      default:
        return "status-offline";
    }
  };

  return (
    <div className="staff-monitor">
      <h3 className="section-title">Staff Status</h3>
      <div className="staff-grid">
        {staffList.map((s) => (
          <div key={s.id} className="staff-card">
            <div className="staff-card-header">
              <div className={`staff-status-dot ${getStatusColor(s.status)}`} />
              <span className="staff-card-name">{s.name}</span>
            </div>
            <span className="staff-card-email">{s.email}</span>
            <span className={`staff-card-badge ${getStatusColor(s.status)}`}>
              {s.status}
            </span>
          </div>
        ))}
        {staffList.length === 0 && (
          <p className="empty-state">No staff registered yet</p>
        )}
      </div>
    </div>
  );
}
