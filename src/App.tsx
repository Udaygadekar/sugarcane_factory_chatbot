import { useEffect, useMemo, useRef, useState } from "react";

interface Farmer {
  farmer_id: string;
  farmer_name: string;
  village: string;
  sugarcane_tonnes: number;
  total_payment: number;
  amount_paid: number;
  payment_pending: number;
}

interface FarmersResponse {
  farmers: Farmer[];
}

interface IconProps {
  name: "leaf" | "grid" | "users" | "chart" | "sparkle" | "search" | "arrow" | "refresh" | "send" | "trend" | "wallet" | "weight" | "money" | "check" | "close";
  size?: number;
}

function Icon({ name, size = 20 }: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  const drawings: Record<IconProps["name"], React.ReactNode> = {
    leaf: <><path d="M20.8 3.2C11.2 3.4 5 5.8 5 12.2a5.4 5.4 0 0 0 5.5 5.4c6.5 0 8.9-6.2 9.1-14.4Z" /><path d="M3.2 21c2.8-5.1 6.1-8.3 11.1-11.1" /></>,
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></>,
    users: <><path d="M16 20v-1.7a3.3 3.3 0 0 0-3.3-3.3H7.3A3.3 3.3 0 0 0 4 18.3V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M20 20v-1.7a3.3 3.3 0 0 0-2.5-3.2M16.5 4.2a3.5 3.5 0 0 1 0 6.7" /></>,
    chart: <><path d="M4 19.5h16" /><path d="M7 16v-5M12 16V5M17 16V9" /></>,
    sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4.8 9A7.5 7.5 0 0 1 18 6l2 1M4 17v-5h5" /><path d="M19.2 15A7.5 7.5 0 0 1 6 18l-2-1" /></>,
    send: <><path d="m21 3-7.2 18-3.8-7-7-3.8L21 3Z" /><path d="M10 14 21 3" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2.2" /><path d="M3 9h18M16 14h2M7 5V3h11" /></>,
    weight: <><path d="M6 7h12l2 14H4L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0M12 11v3l2 1" /></>,
    money: <><circle cx="12" cy="12" r="9" /><path d="M15.5 9a3.5 3.5 0 0 0-3.3-1.8c-1.6 0-2.7.8-2.7 2s1.1 1.8 2.7 2.2 2.8 1 2.8 2.3-1.2 2.2-2.9 2.2a4.2 4.2 0 0 1-3.6-1.8M12 5.5v13" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>
      {drawings[name]}
    </svg>
  );
}

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const tonnes = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    return "The server returned an unreadable response.";
  }
  return `The request failed (${response.status}).`;
}

function App() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  async function loadFarmers() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/farmers");
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = (await response.json()) as FarmersResponse;
      if (!Array.isArray(data.farmers)) {
        throw new Error("The server response did not contain a farmer list.");
      }
      setFarmers(data.farmers);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load farmers."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFarmers();
  }, []);

  const totals = useMemo(
    () =>
      farmers.reduce(
        (sum, farmer) => ({
          cane: sum.cane + farmer.sugarcane_tonnes,
          payment: sum.payment + farmer.total_payment,
          paid: sum.paid + farmer.amount_paid,
          pending: sum.pending + farmer.payment_pending,
        }),
        { cane: 0, payment: 0, paid: 0, pending: 0 }
      ),
    [farmers]
  );

  const filteredFarmers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return farmers.filter(
      (farmer) =>
        farmer.farmer_name.toLocaleLowerCase().includes(term) ||
        farmer.farmer_id.toLocaleLowerCase().includes(term) ||
        farmer.village.toLocaleLowerCase().includes(term)
    );
  }, [farmers, search]);

  const topSuppliers = useMemo(
    () =>
      [...farmers]
        .sort((first, second) => second.sugarcane_tonnes - first.sugarcane_tonnes)
        .slice(0, 4),
    [farmers]
  );
  const maximumTonnage = Math.max(
    1,
    ...topSuppliers.map((farmer) => farmer.sugarcane_tonnes)
  );
  const paidPercentage =
    totals.payment > 0 ? Math.min(100, (totals.paid / totals.payment) * 100) : 0;

  async function askAssistant(submittedQuestion = question) {
    const trimmedQuestion = submittedQuestion.trim();
    if (!trimmedQuestion || asking) {
      return;
    }

    setQuestion(trimmedQuestion);
    setAnswer("");
    setAskError("");
    setAsking(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("answer" in data) ||
        typeof data.answer !== "string"
      ) {
        throw new Error("The assistant returned an unexpected response.");
      }
      setAnswer(data.answer);
    } catch (error) {
      setAskError(
        error instanceof Error
          ? error.message
          : "The assistant could not answer. Please try again."
      );
    } finally {
      setAsking(false);
    }
  }

  function focusAssistant() {
    document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth" });
    questionRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Sanjivani home">
          <span className="brand-mark"><Icon name="leaf" size={23} /></span>
          <span className="brand-copy">
            <strong>Sanjivani</strong>
            <small>FARMER MANAGEMENT</small>
          </span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#overview"><Icon name="grid" />Overview</a>
          <a className="nav-link" href="#farmers"><Icon name="users" />Farmers</a>
          <a className="nav-link" href="#insights"><Icon name="chart" />Insights</a>
          <a className="nav-link" href="#assistant"><Icon name="sparkle" />AI assistant<span className="nav-new">AI</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="season-card">
            <div className="season-icon"><Icon name="leaf" size={17} /></div>
            <div>
              <strong>Sugarcane season</strong>
              <span>Farmer records at a glance</span>
            </div>
            <span className="season-dot" aria-label="Season overview" />
          </div>
          <div className="profile">
            <div className="profile-avatar">SF</div>
            <div className="profile-copy"><strong>Sanjivani Factory</strong><span>Management</span></div>
            <span className="profile-more" aria-hidden="true">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>Overview</strong></div>
          <div className="topbar-actions">
            <div className={`connection-status${loadError ? " connection-offline" : ""}`}><span className="status-dot" />{loadError ? "Data unavailable" : loading ? "Connecting" : "Database connected"}</div>
            <div className="topbar-divider" />
            <div className="date-label">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date())}</div>
            <div className="topbar-avatar" aria-label="Sanjivani Factory">SF</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />FARM OPERATIONS</div>
              <h1>Good day, <span>team.</span></h1>
              <p className="welcome-subtitle">Here’s what’s happening across your farmer network.</p>
            </div>
            <button className="refresh-button" onClick={() => void loadFarmers()} disabled={loading}>
              <Icon name="refresh" size={17} /> Refresh data
            </button>
          </section>

          {loadError && (
            <div className="error-banner" role="alert">
              <span>{loadError}</span>
              <button onClick={() => void loadFarmers()}>Try again</button>
            </div>
          )}

          <section className="stat-grid" aria-label="Farm overview statistics">
            <article className="stat-card">
              <div className="stat-top"><span className="stat-label">Registered farmers</span><span className="stat-icon icon-green"><Icon name="users" /></span></div>
              <div className="stat-value">{loading || loadError ? "—" : farmers.length.toLocaleString("en-IN")}</div>
              <div className="stat-foot"><span className="stat-foot-muted">Farmers in your records</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-label">Sugarcane supplied</span><span className="stat-icon icon-gold"><Icon name="weight" /></span></div>
              <div className="stat-value">{loading || loadError ? "—" : tonnes.format(totals.cane)}{!loadError && <span className="stat-unit"> t</span>}</div>
              <div className="stat-foot"><span className="stat-foot-muted">Total recorded tonnage</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-label">Total payments</span><span className="stat-icon icon-blue"><Icon name="money" /></span></div>
              <div className="stat-value stat-currency">{loading || loadError ? "—" : currency.format(totals.payment)}</div>
              <div className="stat-foot"><span className="stat-foot-muted">Across all farmer records</span></div>
            </article>
            <article className="stat-card stat-card-pending">
              <div className="stat-top"><span className="stat-label">Payment outstanding</span><span className="stat-icon icon-coral"><Icon name="wallet" /></span></div>
              <div className="stat-value stat-currency">{loading || loadError ? "—" : currency.format(totals.pending)}</div>
              <div className="stat-foot"><span className="pending-indicator" /><span className="stat-foot-muted">Pending across all farmers</span></div>
            </article>
          </section>

          <section className="assistant-banner" id="assistant">
            <div className="assistant-decoration assistant-decoration-one" />
            <div className="assistant-decoration assistant-decoration-two" />
            <div className="assistant-content">
              <div className="assistant-kicker"><span className="assistant-sparkle"><Icon name="sparkle" size={15} /></span> YOUR FARM ASSISTANT</div>
              <h2>A clearer picture, <span>one question away.</span></h2>
              <p>Ask about farmer records, deliveries, or pending payments.</p>
              <form
                className="question-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void askAssistant();
                }}
              >
                <textarea
                  ref={questionRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void askAssistant();
                    }
                  }}
                  maxLength={1000}
                  rows={1}
                  placeholder="Try “Which farmer has the highest pending payment?”"
                  aria-label="Ask a question about your farmers"
                />
                <button type="submit" disabled={!question.trim() || asking} aria-label="Send question">
                  {asking ? <span className="button-spinner" /> : <Icon name="send" size={17} />}
                </button>
              </form>
              <div className="assistant-hint"><span>↵</span> to ask <span className="hint-divider">·</span> shift + ↵ for a new line</div>
              {(answer || askError || asking) && (
                <div className={`answer-card${askError ? " answer-error" : ""}`} aria-live="polite">
                  <div className="answer-icon"><Icon name={askError ? "close" : "sparkle"} size={17} /></div>
                  <div className="answer-copy">
                    <strong>{asking ? "Looking through your records…" : askError ? "Couldn’t answer that" : "Here’s what I found"}</strong>
                    <p>{asking ? "Your question is being checked against the farmer data." : askError || answer}</p>
                  </div>
                  {!asking && <button className="answer-close" onClick={() => { setAnswer(""); setAskError(""); }} aria-label="Dismiss answer"><Icon name="close" size={17} /></button>}
                </div>
              )}
              <div className="suggestion-row">
                <span>QUICK ASK</span>
                <button onClick={() => void askAssistant("Which farmer has the highest pending payment?")} disabled={asking}>Highest pending payment <Icon name="arrow" size={13} /></button>
                <button onClick={() => void askAssistant("How much sugarcane has been supplied in total?")} disabled={asking}>Total sugarcane supplied <Icon name="arrow" size={13} /></button>
              </div>
            </div>
            <div className="assistant-orbit" aria-hidden="true"><div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><span className="orbit-leaf"><Icon name="leaf" size={30} /></span><span className="orbit-dot orbit-dot-one" /><span className="orbit-dot orbit-dot-two" /></div>
          </section>

          <section className="insights-grid" id="insights">
            <article className="panel supplier-panel">
              <div className="panel-heading">
                <div><div className="panel-eyebrow">DELIVERIES</div><h2>Top suppliers</h2></div>
                <span className="panel-icon"><Icon name="trend" size={18} /></span>
              </div>
              {loading || loadError ? (
                <div className="panel-empty">{loadError || "Loading delivery records…"}</div>
              ) : topSuppliers.length === 0 ? (
                <div className="panel-empty">Supplier insights will appear when farmer records are available.</div>
              ) : (
                <div className="supplier-list">
                  {topSuppliers.map((farmer, index) => (
                    <div className="supplier-row" key={farmer.farmer_id}>
                      <span className={`supplier-rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
                      <div className="supplier-details"><div className="supplier-name">{farmer.farmer_name}</div><div className="supplier-track"><span style={{ width: `${Math.max(5, (farmer.sugarcane_tonnes / maximumTonnage) * 100)}%` }} /></div></div>
                      <strong className="supplier-tonnes">{tonnes.format(farmer.sugarcane_tonnes)} <small>t</small></strong>
                    </div>
                  ))}
                </div>
              )}
              <div className="panel-footer"><span>Ranked by recorded sugarcane supplied</span><span className="footer-spark"><Icon name="chart" size={15} /></span></div>
            </article>

            <article className="panel payment-panel">
              <div className="panel-heading">
                <div><div className="panel-eyebrow">SETTLEMENTS</div><h2>Payment overview</h2></div>
                <span className="panel-icon panel-icon-gold"><Icon name="wallet" size={18} /></span>
              </div>
              {loading || loadError ? (
                <div className="panel-empty">{loadError || "Loading payment records…"}</div>
              ) : (
                <>
                  <div className="payment-total-label">Recorded total payment</div>
                  <div className="payment-total">{currency.format(totals.payment)}</div>
                  <div className="payment-progress" role="progressbar" aria-label="Share of recorded payments paid" aria-valuenow={Math.round(paidPercentage)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${paidPercentage}%` }} /></div>
                  <div className="payment-legend">
                    <div><span className="legend-dot legend-paid" /><span>Paid</span><strong>{currency.format(totals.paid)}</strong></div>
                    <div><span className="legend-dot legend-pending" /><span>Pending</span><strong>{currency.format(totals.pending)}</strong></div>
                  </div>
                  <div className="payment-note"><span className="payment-note-icon"><Icon name="check" size={14} /></span>Calculated from the farmer payment records</div>
                </>
              )}
            </article>
          </section>

          <section className="panel farmers-panel" id="farmers">
            <div className="farmers-heading">
              <div><div className="panel-eyebrow">YOUR NETWORK</div><h2>Farmer records <span className="farmer-count">{loading ? "…" : farmers.length}</span></h2><p>A clear view of deliveries and settlement status.</p></div>
              <label className="search-box"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, village…" aria-label="Search farmer records" /></label>
            </div>
            {loading ? (
              <div className="table-state"><span className="loading-spinner" />Loading farmer records…</div>
            ) : loadError ? (
              <div className="table-state">Farmer records could not be loaded. Check your connection and try again.</div>
            ) : filteredFarmers.length === 0 ? (
              <div className="table-state">{farmers.length === 0 ? "No farmer records are available yet." : "No farmers match your search."}</div>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>FARMER</th><th>VILLAGE</th><th>SUPPLIED</th><th>TOTAL PAYMENT</th><th>PAID</th><th>OUTSTANDING</th></tr></thead>
                    <tbody>
                      {filteredFarmers.map((farmer) => (
                        <tr key={farmer.farmer_id}>
                          <td><div className="farmer-cell"><span className="farmer-avatar">{farmer.farmer_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join("")}</span><span><strong>{farmer.farmer_name}</strong><small>ID · {farmer.farmer_id}</small></span></div></td>
                          <td><span className="village-cell"><span className="village-dot" />{farmer.village}</span></td>
                          <td className="numeric-cell">{tonnes.format(farmer.sugarcane_tonnes)} <span className="unit-muted">t</span></td>
                          <td className="numeric-cell">{currency.format(farmer.total_payment)}</td>
                          <td className="numeric-cell paid-cell">{currency.format(farmer.amount_paid)}</td>
                          <td><span className={`payment-badge ${farmer.payment_pending > 0 ? "badge-pending" : "badge-settled"}`}><span />{farmer.payment_pending > 0 ? currency.format(farmer.payment_pending) : "Settled"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer"><span>Showing <strong>{filteredFarmers.length}</strong> of <strong>{farmers.length}</strong> farmer records</span><button className="table-refresh" onClick={() => void loadFarmers()} disabled={loading}><Icon name="refresh" size={15} /> Refresh</button></div>
              </>
            )}
          </section>

          <footer className="page-footer"><span><Icon name="leaf" size={15} /> Grown together, managed better.</span><span>Farmer data is retrieved from your connected MongoDB database.</span></footer>
        </div>
      </main>

      <button className="mobile-ask" onClick={focusAssistant}><Icon name="sparkle" size={18} /> Ask your assistant</button>
    </div>
  );
}

export default App;
