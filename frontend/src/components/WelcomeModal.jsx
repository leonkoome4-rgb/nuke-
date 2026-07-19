import { ShieldCheck, Vote, Eye } from "lucide-react";

export default function WelcomeModal({ onClose }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="modal-card">
        <span className="modal-card__eyebrow">SAY IT · KENYA 2027</span>
        <h2 id="welcome-title">Before you dive in</h2>

        <p>
          Say It exists so ordinary Kenyans can report and share what they've seen from public
          officials — anonymously, safely, and without needing anyone's permission.
        </p>

        <div className="modal-card__points">
          <div className="modal-card__point">
            <Vote size={16} strokeWidth={2.25} />
            <p>
              With the <strong>2027 general election</strong> ahead, honest information matters
              more than ever. Use this space to hold leaders accountable, not to settle scores.
            </p>
          </div>
          <div className="modal-card__point">
            <ShieldCheck size={16} strokeWidth={2.25} />
            <p>
              Every report here is an <strong>unverified allegation, not proven fact</strong>.
              Report in good faith and back claims with real evidence where you can — never post
              fabricated stories.
            </p>
          </div>
          <div className="modal-card__point">
            <Eye size={16} strokeWidth={2.25} />
            <p>No accounts, no tracking of who said what. Just be honest, specific, and safe.</p>
          </div>
        </div>

        <button type="button" className="modal-card__cta" onClick={onClose}>
          I understand — Continue
        </button>
      </div>
    </div>
  );
}
