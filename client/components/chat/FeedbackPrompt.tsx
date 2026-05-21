import { FiThumbsUp, FiThumbsDown } from "react-icons/fi";

interface Props {
  onFeedback: (rating: "good" | "bad") => void;
}

export default function FeedbackPrompt({ onFeedback }: Props) {
  return (
    <div className="feedback-prompt">
      <p>How was your experience?</p>
      <div className="feedback-buttons">
        <button
          className="feedback-btn feedback-good"
          onClick={() => onFeedback("good")}
          aria-label="Good feedback"
        >
          <FiThumbsUp size={20} />
          <span>Good</span>
        </button>
        <button
          className="feedback-btn feedback-bad"
          onClick={() => onFeedback("bad")}
          aria-label="Bad feedback"
        >
          <FiThumbsDown size={20} />
          <span>Bad</span>
        </button>
      </div>
    </div>
  );
}
