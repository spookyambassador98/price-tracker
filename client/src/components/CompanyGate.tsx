import { FormEvent, useState } from "react";
import { rememberCompanyVisit } from "../lib/visitBeacon";

export function CompanyGate({ onUnlock }: { onUnlock: () => void }) {
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const name = company.trim();
    if (!name) {
      setError("Company name is required.");
      return;
    }
    rememberCompanyVisit(name);
    onUnlock();
  }

  return (
    <div className="radar-gate">
      <form className="radar-gate__plate" onSubmit={submit}>
        <p className="radar-gate__kicker">01 / Clearance</p>
        <h1 className="radar-gate__title">
          Name the desk<span>.</span>
        </h1>
        <p className="radar-gate__hint">
          The board stays shut until a company is on the ticket. The visit is written to the floor.
        </p>
        <label className="radar-gate__field">
          <span>Company</span>
          <input
            autoFocus
            autoComplete="organization"
            value={company}
            placeholder="Company name"
            onChange={(e) => {
              setCompany(e.target.value);
              setError(null);
            }}
          />
        </label>
        {error ? <p className="radar-gate__error">{error}</p> : null}
        <button className="btn radar-gate__btn" type="submit" disabled={!company.trim()}>
          <span className="label">Open the board</span>
        </button>
      </form>
    </div>
  );
}
