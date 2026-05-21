"use client";

import { FeedbackItem } from "@/types";
import { FiThumbsUp, FiThumbsDown } from "react-icons/fi";

interface Props {
  feedbacks: FeedbackItem[];
}

export default function FeedbackTable({ feedbacks }: Props) {
  const goodCount = feedbacks.filter((f) => f.rating === "good").length;
  const badCount = feedbacks.filter((f) => f.rating === "bad").length;

  return (
    <div className="feedback-section">
      <h3 className="section-title">Feedback Overview</h3>

      <div className="feedback-stats">
        <div className="feedback-stat feedback-stat-good">
          <FiThumbsUp size={20} />
          <span>{goodCount} Good</span>
        </div>
        <div className="feedback-stat feedback-stat-bad">
          <FiThumbsDown size={20} />
          <span>{badCount} Bad</span>
        </div>
      </div>

      <div className="feedback-table-wrapper">
        <table className="feedback-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Rating</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((f) => (
              <tr key={f.id}>
                <td>{f.staff_name}</td>
                <td>
                  <span
                    className={`rating-badge rating-${f.rating}`}
                  >
                    {f.rating === "good" ? (
                      <FiThumbsUp size={14} />
                    ) : (
                      <FiThumbsDown size={14} />
                    )}
                    {f.rating}
                  </span>
                </td>
                <td>
                  {new Date(f.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
            {feedbacks.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  No feedback yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
