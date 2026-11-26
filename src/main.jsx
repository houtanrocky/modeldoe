import React, { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AudioLines,
  BookOpen,
  Boxes,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Eye,
  Fingerprint,
  GitBranch,
  Layers3,
  ListFilter,
  MessageSquareQuote,
  Network,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  applyLearning,
  estimateRule,
  getCognitionModel,
  initialPeople,
  levels,
  makeDecisionPrompt,
  makePrompt,
  parseDecisionReply,
  parseReply,
  saveDecisionResult,
  storageKey,
  types,
  uid,
} from "./model";
import "./style.css";

const evidenceIcons = {
  Quote: MessageSquareQuote,
  Behavior: Eye,
  Decision: GitBranch,
  Inference: BrainCircuit,
};
const dateLabel = (value) =>
  new Date(value.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

function Terrain() {
  const point = (i, j) => {
    const x = i / 50,
      y = j / 30;
    const peak = (cx, cy, wx, wy, h) =>
      h * Math.exp(-((x - cx) ** 2 / wx + (y - cy) ** 2 / wy));
    const z =
      peak(0.5, 0.5, 0.025, 0.07, 105) +
      peak(0.75, 0.64, 0.016, 0.055, 78) +
      peak(0.29, 0.29, 0.013, 0.046, 55) +
      6 *
        Math.sin(x * 18 + y * 8) *
        Math.sin(Math.PI * x) *
        Math.sin(Math.PI * y);
    return [
      (65 + i * 8.5 + j * 3.3).toFixed(1),
      (107 + j * 3.0 - i * 0.87 - z).toFixed(1),
    ].join(",");
  };
  const line = (n, fn) => Array.from({ length: n }, (_, k) => fn(k)).join(" ");
  return (
    <svg className="terrain" viewBox="0 0 610 215" aria-hidden="true">
      <defs>
        <linearGradient id="mesh" x2="0.2" y2="1">
          <stop stopColor="#e7ffae" />
          <stop offset=".52" stopColor="#b1d777" />
          <stop offset="1" stopColor="#48623f" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#mesh)" strokeWidth=".85">
        {Array.from({ length: 31 }, (_, j) => (
          <polyline key={"r" + j} points={line(51, (i) => point(i, j))} />
        ))}
        {Array.from({ length: 51 }, (_, i) => (
          <polyline key={"c" + i} points={line(31, (j) => point(i, j))} />
        ))}
      </g>
    </svg>
  );
}

function Modal({ title, close, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dlg = ref.current;
    dlg.showModal();
    return () => dlg.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-labelledby={titleId}>
      <div className="modalhead">
        <h2 id={titleId}>{title}</h2>
        <button className="iconbtn" aria-label="Close dialog" onClick={close}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function LearningDialog({ person, close, save, saveError, modelOnly = false }) {
  const [type, setType] = useState("Quote"),
    [text, setText] = useState(""),
    [id, setId] = useState(uid);
  const [situation, setSituation] = useState("");
  const [involvement, setInvolvement] = useState("");
  const [statedReason, setStatedReason] = useState("");
  const [revise, setRevise] = useState(modelOnly);
  const [date] = useState(() => new Date().toISOString()),
    [step, setStep] = useState("draft"),
    [raw, setRaw] = useState(""),
    [review, setReview] = useState(null),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const isDecision = type === "Decision";
  const observation = modelOnly
    ? null
    : {
        id,
        type,
        text: text.trim(),
        date,
        situation: situation.trim(),
        ...(isDecision
          ? {
              involvement: involvement.trim(),
              statedReason: statedReason.trim(),
            }
          : {}),
      };
  const ready =
    modelOnly ||
    (text.trim() && (!isDecision || (situation.trim() && involvement.trim())));
  const prompt = revise ? makePrompt(person, id, observation) : "";
  const reviewEvidence = observation
    ? [...person.evidence, observation]
    : person.evidence;
  function edit(fn, value) {
    fn(value);
    setId(uid());
    setCopied(false);
    setRaw("");
    setError("");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setError("Select and copy the live prompt below.");
    }
  }
  function check() {
    try {
      setReview(parseReply(raw, person, id, observation));
      setStep("review");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal
      title={modelOnly ? "Revise cognition model" : "Add observation"}
      close={close}
    >
      <p className="sub">
        {person.name} /{" "}
        {step === "draft"
          ? modelOnly
            ? "Generate prompt"
            : "Record what happened"
          : step === "reply"
            ? "Import response"
            : "Review model"}
      </p>
      {step === "draft" && (
        <>
          {!modelOnly && (
            <>
              <label>
                Observation type
                <select
                  value={type}
                  onChange={(e) => edit(setType, e.target.value)}
                >
                  {types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                {isDecision
                  ? "What was decided or done?"
                  : "What did you observe?"}
                <textarea
                  autoFocus
                  rows="4"
                  placeholder="Include what happened and the situation around it…"
                  value={text}
                  onChange={(e) => edit(setText, e.target.value)}
                />
              </label>
              <label>
                {isDecision ? "Situation" : "Situation (optional)"}
                <textarea
                  rows="2"
                  value={situation}
                  onChange={(e) => edit(setSituation, e.target.value)}
                  placeholder="What was happening, what options were available, and what was at stake?"
                />
              </label>
              {isDecision && (
                <>
                  <label>
                    How did the person take part or influence the decision?
                    <textarea
                      rows="2"
                      value={involvement}
                      onChange={(e) => edit(setInvolvement, e.target.value)}
                      placeholder="Describe what they said or did and who made the final choice."
                    />
                  </label>
                  <label>
                    Reason they gave (optional)
                    <textarea
                      rows="2"
                      value={statedReason}
                      onChange={(e) => edit(setStatedReason, e.target.value)}
                    />
                  </label>
                </>
              )}
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={revise}
                  onChange={(e) => edit(setRevise, e.target.checked)}
                />
                Revise cognition model with this observation
              </label>
            </>
          )}
          {revise && (
            <details open>
              <summary>Live prompt</summary>
              <pre tabIndex="0">{prompt}</pre>
            </details>
          )}
          <div className="actions">
            {!revise && (
              <button
                className="primary"
                disabled={!ready}
                onClick={() => save(applyLearning(person, { observation }))}
              >
                Save observation
              </button>
            )}
            {revise && (
              <>
                <button disabled={!ready} onClick={copy}>
                  <Clipboard size={15} />
                  {copied ? "Copied" : "Copy prompt"}
                </button>
                <button
                  className="primary"
                  disabled={!ready}
                  onClick={() => {
                    setStep("reply");
                    setError("");
                  }}
                >
                  Paste response
                </button>
              </>
            )}
          </div>
        </>
      )}
      {step === "reply" && (
        <>
          <label>
            LLM response
            <textarea
              autoFocus
              rows="10"
              value={raw}
              placeholder="Paste the JSON response here…"
              onChange={(e) => setRaw(e.target.value)}
            />
          </label>
          <div className="actions">
            <button
              onClick={() => {
                setStep("draft");
                setError("");
              }}
            >
              Back
            </button>
            <button className="primary" onClick={check}>
              Review update
            </button>
          </div>
        </>
      )}
      {step === "review" && review && (
        <>
          {observation && (
            <>
              <h3>New {type.toLowerCase()} observation</h3>
              <ObservationText item={observation} />
            </>
          )}
          <h3>Revised hypotheses ({review.hypotheses.length})</h3>
          {review.hypotheses.map((h, i) => (
            <Hypothesis key={i} h={h} index={i} evidence={reviewEvidence} />
          ))}
          <h3>Revised Bayesian rules ({review.rules.length})</h3>
          <RuleList rules={review.rules} evidence={reviewEvidence} showCases />
          <p className="sub">
            Applying this revision replaces the saved hypotheses and rules with
            the sets shown above.
          </p>
          <div className="actions">
            <button onClick={() => setStep("reply")}>Back</button>
            <button
              className="primary"
              onClick={() =>
                save(applyLearning(person, { observation, model: review }))
              }
            >
              {modelOnly
                ? "Apply model revision"
                : "Save observation and model"}
            </button>
          </div>
        </>
      )}
      {(error || saveError) && <p role="alert">{error || saveError}</p>}
    </Modal>
  );
}

function TestDecision({ person, close, save, saveError }) {
  const [text, setText] = useState(""),
    [id, setId] = useState(uid),
    [raw, setRaw] = useState("");
  const [step, setStep] = useState("draft"),
    [result, setResult] = useState(null),
    [actual, setActual] = useState(""),
    [outcome, setOutcome] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const [useModel, setUseModel] = useState(false);
  const [createdAt] = useState(() => new Date().toISOString());
  const question = { id, text: text.trim(), createdAt };
  const prompt = makeDecisionPrompt(person, question, useModel);
  function change(setValue, value) {
    setValue(value);
    setId(uid());
    setRaw("");
    setResult(null);
    setError("");
    setCopied(false);
  }
  function parse() {
    try {
      setResult(parseDecisionReply(raw, person, question));
      setStep("review");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setError("Select and copy the live prompt below.");
    }
  }
  return (
    <Modal title="Test a decision" close={close}>
      <p className="sub">
        {person.name} /{" "}
        {step === "draft"
          ? "Describe the decision"
          : step === "reply"
            ? "Import prediction"
            : step === "review"
              ? "Review prediction"
              : "Record actual result"}
      </p>
      {step === "draft" && (
        <>
          <label>
            What question or choice is this person facing?
            <textarea
              autoFocus
              rows="4"
              value={text}
              onChange={(e) => change(setText, e.target.value)}
              placeholder="Describe the decision and relevant circumstances…"
            />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={useModel}
              onChange={(e) => change(setUseModel, e.target.checked)}
            />
            Use saved cognition model
          </label>
          <details open>
            <summary>Live prompt</summary>
            <pre tabIndex="0">{prompt}</pre>
          </details>
          <div className="actions">
            <button disabled={!text.trim()} onClick={copy}>
              <Clipboard size={15} />
              {copied ? "Copied" : "Copy prompt"}
            </button>
            <button
              className="primary"
              disabled={!text.trim()}
              onClick={() => setStep("reply")}
            >
              Paste response
            </button>
          </div>
        </>
      )}
      {step === "reply" && (
        <>
          <label>
            LLM response
            <textarea
              autoFocus
              rows="10"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste the JSON prediction…"
            />
          </label>
          <div className="actions">
            <button onClick={() => setStep("draft")}>Back</button>
            <button className="primary" onClick={parse}>
              Review prediction
            </button>
          </div>
        </>
      )}
      {step === "review" && result && (
        <>
          <h3>Likely choice</h3>
          <p>{result.prediction}</p>
          <h3>Why</h3>
          <p>{result.rationale}</p>
          <h3>Alternatives</h3>
          {result.alternatives.map((v, i) => (
            <p key={i}>{v}</p>
          ))}
          <h3>Uncertainty</h3>
          <p>{result.uncertainty}</p>
          <details>
            <summary>Cognition dimensions</summary>
            {Object.entries(result.dimensions).map(([key, value]) => (
              <p key={key}>
                <b>{key}</b> · {value}
              </p>
            ))}
          </details>
          <div className="actions">
            <button onClick={() => setStep("reply")}>Back</button>
            <button
              className="primary"
              onClick={() => {
                const saved = save({
                  ...person,
                  decisions: [
                    ...(person.decisions || []),
                    {
                      ...question,
                      prediction: result,
                      actualChoice: "",
                      outcome: "",
                    },
                  ],
                });
                if (saved) setStep("saved");
              }}
            >
              Save prediction
            </button>
          </div>
        </>
      )}
      {step === "saved" && (
        <>
          <p className="sub">
            The actual choice and outcome belong to this prediction.
          </p>
          <label>
            What choice was actually made?
            <textarea
              autoFocus
              rows="3"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </label>
          <label>
            What happened afterward? (optional)
            <textarea
              rows="3"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </label>
          <div className="actions">
            <button onClick={close}>Done for now</button>
            <button
              className="primary"
              disabled={!actual.trim()}
              onClick={() => {
                if (save(saveDecisionResult(person, id, actual, outcome)))
                  close();
              }}
            >
              Record result
            </button>
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {saveError && <p role="alert">{saveError}</p>}
    </Modal>
  );
}

function ResolveDecision({ person, decisionId, close, save, saveError }) {
  const decision = (person.decisions || []).find(
    (item) => item.id === decisionId,
  );
  const [actual, setActual] = useState(""),
    [outcome, setOutcome] = useState("");
  return (
    <Modal title="Record decision result" close={close}>
      <p>{decision.text}</p>
      <p>
        <b>Prediction</b> {decision.prediction.prediction}
      </p>
      <label>
        What choice was actually made?
        <textarea
          autoFocus
          rows="3"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
      </label>
      <label>
        What happened afterward? (optional)
        <textarea
          rows="3"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        />
      </label>
      <div className="actions">
        <button
          className="primary"
          disabled={!actual.trim()}
          onClick={() =>
            save(saveDecisionResult(person, decisionId, actual, outcome))
          }
        >
          Record result
        </button>
      </div>
      {saveError && <p role="alert">{saveError}</p>}
    </Modal>
  );
}

function ObservationText({ item }) {
  return (
    <>
      <p className={item.type === "Quote" ? "quote" : undefined}>
        {item.type === "Quote" ? `“${item.text}”` : item.text}
      </p>
      {item.situation && (
        <p>
          <strong>Situation</strong> {item.situation}
        </p>
      )}
      {item.involvement && (
        <p>
          <strong>Involvement</strong> {item.involvement}
        </p>
      )}
      {item.statedReason && (
        <p>
          <strong>Stated reason</strong> {item.statedReason}
        </p>
      )}
    </>
  );
}

function RuleList({ rules, evidence, showCases = false }) {
  const records = new Map(evidence.map((item) => [item.id, item]));
  return rules.map((rule, index) => {
    const { alpha, beta, probability } = estimateRule(rule.cases);
    const count = rule.cases.length;
    return (
      <details className="hyp" key={index} open={showCases || undefined}>
        <summary>
          <div className="cardtop">
            <span className="patternicon">
              <Activity size={20} />
            </span>
            <span className="confidence">
              {Math.round(probability * 100)}% estimated chance
            </span>
          </div>
          <h3>{rule.title}</h3>
          <p>
            <strong>When</strong> {rule.situation}
          </p>
          <p>
            <strong>Action</strong> {rule.action}
          </p>
          <div className="cardfoot">
            <span>
              {alpha - 1} of {count} cited {count === 1 ? "case" : "cases"}{" "}
              showed the action
            </span>
            <span className="expand">
              Cases <ChevronDown size={14} />
            </span>
          </div>
        </summary>
        <div className="detail">
          <p>
            Posterior Beta({alpha}, {beta}) with a Beta(1, 1) prior.
          </p>
          <ul className="rule-cases">
            {rule.cases.map(({ evidenceId, occurred }) => (
              <li key={evidenceId}>
                <strong>
                  {occurred ? "Action observed" : "Counterexample"}
                </strong>
                <ObservationText item={records.get(evidenceId)} />
              </li>
            ))}
          </ul>
        </div>
      </details>
    );
  });
}

function Hypothesis({ h, index, evidence }) {
  const Icon = [Boxes, GitBranch, Activity][index % 3];
  return (
    <details className="hyp">
      <summary>
        <div className="cardtop">
          <span className="patternicon">
            <Icon size={20} />
          </span>
          <span className="mono code">
            HYP–{String(index + 1).padStart(2, "0")}
          </span>
          <span className={"confidence " + h.confidence.toLowerCase()}>
            <i />
            {h.confidence} confidence
          </span>
        </div>
        <h3>{h.title}</h3>
        <p>{h.pattern}</p>
        <div className="cardfoot">
          <span>
            <Layers3 size={14} />
            {h.sources.length} evidence{" "}
            {h.sources.length === 1 ? "link" : "links"}
          </span>
          <span className="expand">
            Details <ChevronDown size={14} />
          </span>
        </div>
      </summary>
      <div className="detail">
        <b>Situation</b>
        <p>{h.situation}</p>
        <b>Prediction</b>
        <p>{h.prediction}</p>
        <b>Supporting evidence</b>
        {h.sources.map((id) => {
          const item = evidence.find((observation) => observation.id === id);
          return (
            item && (
              <div key={id}>
                <ObservationText item={item} />
              </div>
            )
          );
        })}
      </div>
    </details>
  );
}

function PersonForm({ person, close, save, saveError }) {
  const [name, setName] = useState(person?.name ?? "");
  const [context, setContext] = useState(person?.context ?? "");
  const [job, setJob] = useState(person?.job ?? "");
  const [age, setAge] = useState(person?.age ?? "");
  const [height, setHeight] = useState(person?.height ?? "");
  const [traits, setTraits] = useState(person?.traits?.join("\n") ?? "");
  const [degrees, setDegrees] = useState(() =>
    (person?.degrees ?? []).map((degree) => ({ ...degree, key: uid() })),
  );

  function changeDegree(key, field, value) {
    setDegrees((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
  }

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    const education = degrees
      .map(({ degree, institution }) => ({
        degree: degree.trim(),
        institution: institution.trim(),
      }))
      .filter(({ degree, institution }) => degree || institution);
    save({
      ...(person ?? { id: uid(), evidence: [], decisions: [] }),
      name: name.trim(),
      context: context.trim(),
      job: job.trim(),
      age: age === "" ? null : Number(age),
      height: height.trim(),
      degrees: education,
      traits: traits
        .split("\n")
        .map((trait) => trait.trim())
        .filter(Boolean),
    });
  }

  return (
    <Modal title={person ? "Edit profile" : "New person"} close={close}>
      <form onSubmit={submit}>
        <label>
          Name
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength="100"
          />
        </label>
        <label>
          Context (optional)
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Relationship or other background"
          />
        </label>
        <label>
          Job (optional)
          <input
            value={job}
            onChange={(e) => setJob(e.target.value)}
            placeholder="Job title or line of work"
          />
        </label>
        <div className="profile-form-row">
          <label>
            Age in years (optional)
            <input
              type="number"
              min="0"
              step="1"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </label>
          <label>
            Height (optional)
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 178 cm or 5 ft 10 in"
            />
          </label>
        </div>
        <fieldset className="degree-fields">
          <legend>Education (optional)</legend>
          {degrees.map(({ key, degree, institution }, index) => (
            <div className="degree-row" key={key}>
              <div className="profile-form-row">
                <label>
                  Degree
                  <input
                    value={degree}
                    onChange={(e) =>
                      changeDegree(key, "degree", e.target.value)
                    }
                    placeholder="e.g. BSc in Computer Science"
                  />
                </label>
                <label>
                  School or institution
                  <input
                    value={institution}
                    onChange={(e) =>
                      changeDegree(key, "institution", e.target.value)
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                aria-label={`Remove education entry ${index + 1}`}
                onClick={() =>
                  setDegrees((current) =>
                    current.filter((row) => row.key !== key),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const degree = { key: uid(), degree: "", institution: "" };
              setDegrees((current) => [...current, degree]);
            }}
          >
            <Plus size={16} /> Add degree
          </button>
        </fieldset>
        <label>
          Decision-relevant personality traits (optional)
          <textarea
            rows="3"
            value={traits}
            onChange={(e) => setTraits(e.target.value)}
            aria-describedby="traits-help"
          />
          <span id="traits-help" className="field-help">
            Enter one trait per line and add context if you have it. For
            example, “seeks consensus when decisions affect the whole team.”
          </span>
        </label>
        <div className="actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={!name.trim()}>
            {person ? "Save profile" : "Create person"}
          </button>
        </div>
        {saveError && <p role="alert">{saveError}</p>}
      </form>
    </Modal>
  );
}

function ProfileDetails({ person, edit }) {
  const { job, age, height, context, degrees = [], traits = [] } = person;
  const details = [
    ["Job", job],
    ["Age", age == null ? "" : `${age} years`],
    ["Height", height],
    ["Context", context],
  ].filter(([, value]) => value);
  return (
    <section className="profile-details" aria-label="Person profile">
      <details key={person.id}>
        <summary>Profile details</summary>
        {details.length > 0 && (
          <dl className="profile-fields">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {degrees.length > 0 && (
          <div className="profile-list">
            <h3>Education</h3>
            <ul>
              {degrees.map(({ degree, institution }, index) => (
                <li key={index}>
                  {[degree, institution].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        )}
        {traits.length > 0 && (
          <div className="profile-list">
            <h3>Reported personality traits</h3>
            <ul>
              {traits.map((trait, index) => (
                <li key={index}>{trait}</li>
              ))}
            </ul>
          </div>
        )}
        {!details.length && !degrees.length && !traits.length && (
          <p className="sub">No profile details have been added.</p>
        )}
      </details>
      <button onClick={edit}>
        <Pencil size={15} /> Edit profile
      </button>
    </section>
  );
}

function App() {
  const [people, setPeople] = useState(() => {
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : initialPeople();
  });
  const [selected, S] = useState(people[0].id),
    [modal, M] = useState(""),
    [filter, F] = useState("All"),
    [filters, showFilters] = useState(false),
    [all, A] = useState(false),
    [error, E] = useState("");
  const person = people.find((p) => p.id === selected);
  const { evidence } = person;
  const { hypotheses, rules } = getCognitionModel(person);
  function persist(next) {
    try {
      const previous = localStorage.getItem(storageKey);
      if (previous && previous !== JSON.stringify(people)) {
        E(
          "Another tab updated this workspace. Reload to see its changes before saving.",
        );
        return false;
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
      setPeople(next);
      E("");
      return true;
    } catch {
      E("Browser storage could not save this update.");
      return false;
    }
  }
  function select(id) {
    S(id);
    A(false);
    F("All");
    showFilters(false);
  }
  const stream = [...evidence].sort((a, b) => b.date.localeCompare(a.date));
  const shown = all ? stream : stream.slice(0, 3);
  const visible = hypotheses.filter(
    (h) => filter === "All" || h.confidence === filter,
  );
  return (
    <>
      <header>
        <div className="top">
          <div className="brand">
            <span className="logo">
              <Layers3 size={23} />
            </span>
            Modeldoe
          </div>
          <span className="divider" />
          <span className="navcurrent">
            <Network size={16} /> Workspace
          </span>
          <button className="guide" onClick={() => M("guide")}>
            <BookOpen size={16} /> Field guide
          </button>
          <span className="local">
            <i /> Local workspace
          </span>
        </div>
      </header>
      <main>
        <div className="crumb">
          Workspace <ChevronRight size={13} /> Person models
        </div>
        <div className="heading">
          <div>
            <div className="eyebrow">
              <span className="rule" /> MODEL WORKSPACE
            </div>
            <h1>Person models</h1>
          </div>
          <button onClick={() => M("new")}>
            <Plus size={16} /> New person
          </button>
        </div>
        <section className="hero">
          <Terrain />
          <div className="heroContent">
            <div className="heroTop">
              <span className="heroTag">
                <Fingerprint size={15} /> PERSON MODEL
              </span>
              <span className="sample">
                {person.sample ? "Fictional sample" : "Personal profile"}
              </span>
            </div>
            <div className="person">
              <h2>{person.name}</h2>
              <span className="picker">
                <ChevronDown size={18} />
                <select
                  aria-label="Select person"
                  value={selected}
                  onChange={(e) => select(e.target.value)}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <div className="role">
              {person.job || person.context || "Personal model"}
            </div>
            <div className="stats">
              <span>
                <Layers3 />
                {evidence.length} observations
              </span>
              <span>
                <Network />
                {hypotheses.length} hypotheses
              </span>
            </div>
          </div>
        </section>
        <ProfileDetails
          person={person}
          edit={() => {
            E("");
            M("edit");
          }}
        />
        <div className="columns">
          <section>
            <div className="sectionhead">
              <div className="sectiontitle">
                <Network /> <h2>Cognition model</h2>
              </div>
              <button
                onClick={() => {
                  E("");
                  M("model");
                }}
              >
                Revise model
              </button>
            </div>
            <div className="sectionhead model-subhead">
              <h3>Bayesian rules</h3>
            </div>
            <RuleList rules={rules} evidence={evidence} />
            {!rules.length && (
              <p className="empty">
                Revise the model to turn comparable decisions and behaviors into
                conditional estimates.
              </p>
            )}
            <div className="sectionhead model-subhead">
              <h3>Qualitative hypotheses</h3>
              <button
                className="filter"
                onClick={() => showFilters(!filters)}
                aria-expanded={filters}
              >
                <ListFilter size={15} />
                {filter === "All" ? "Filter" : filter}
              </button>
            </div>
            {filters && (
              <label className="filterrow">
                Confidence
                <select value={filter} onChange={(e) => F(e.target.value)}>
                  {["All", ...levels].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
            )}
            {visible.map((h, i) => (
              <Hypothesis
                key={h.title + i}
                h={h}
                index={hypotheses.indexOf(h)}
                evidence={evidence}
              />
            ))}
            {!visible.length && (
              <div className="empty">
                {hypotheses.length
                  ? "No hypotheses match this confidence."
                  : "Add an observation to build the first hypothesis."}
              </div>
            )}
          </section>
          <div>
            <section>
              <div className="sectionhead">
                <div className="sectiontitle">
                  <AudioLines />
                  <h2>Observation log</h2>
                </div>
              </div>
              <div className="log">
                <button className="primary add" onClick={() => M("update")}>
                  <Plus size={17} /> Add observation
                </button>
                {shown.map((e) => {
                  const Icon = evidenceIcons[e.type];
                  return (
                    <article key={e.id}>
                      <span className={"eventicon " + e.type}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <div className="eventhead">
                          <b>{e.type}</b>
                          <time>{dateLabel(e.date)}</time>
                        </div>
                        <ObservationText item={e} />
                      </div>
                    </article>
                  );
                })}
                {!shown.length && (
                  <p className="sub">Your observations will appear here.</p>
                )}
                {stream.length > 3 && (
                  <button className="more" onClick={() => A(!all)}>
                    {all
                      ? "Show recent observations"
                      : "View all " + stream.length + " observations"}
                    <ChevronDown size={15} />
                  </button>
                )}
              </div>
            </section>
            <section className="prediction-log">
              <div className="sectionhead">
                <div className="sectiontitle">
                  <Sparkles />
                  <h2>Decision predictions</h2>
                </div>
              </div>
              <div className="log">
                <button className="add" onClick={() => M("decision")}>
                  <Sparkles size={16} /> Test a decision
                </button>
                {(person.decisions ?? []).map((decision) => (
                  <article key={decision.id}>
                    <span className="eventicon Inference">
                      <BrainCircuit size={16} />
                    </span>
                    <div>
                      <div className="eventhead">
                        <b>Decision prediction</b>
                        <time>{dateLabel(decision.createdAt)}</time>
                      </div>
                      <p>{decision.text}</p>
                      <p>
                        <strong>Predicted</strong>{" "}
                        {decision.prediction.prediction}
                      </p>
                      {decision.actualChoice ? (
                        <>
                          <p>
                            <strong>Actual choice</strong>{" "}
                            {decision.actualChoice}
                          </p>
                          {decision.outcome && (
                            <p>
                              <strong>Outcome</strong> {decision.outcome}
                            </p>
                          )}
                        </>
                      ) : (
                        <button onClick={() => M("resolve:" + decision.id)}>
                          Record actual result
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      {modal === "guide" && (
        <Modal title="Field guide" close={() => M("")}>
          <h3>Record the evidence</h3>
          <p>
            For an observed decision, record the situation, how the person took
            part, and what was chosen. Mark your own interpretations as
            inferences.
          </p>
          <h3>Update a model</h3>
          <p>
            Select the revision option when adding an observation, or use Revise
            model to work from saved evidence. Paste the AI response and review
            the hypotheses and each rule’s cited cases before applying it.
          </p>
          <h3>Check a prediction</h3>
          <p>
            Expand a hypothesis to see its situation, prediction and sources.
            When that situation occurs, record what actually happened, including
            surprises.
          </p>
          <p className="sub">
            Profiles stay in this browser. Prompts include the selected person’s
            observations and profile details.
          </p>
        </Modal>
      )}
      {(modal === "new" || modal === "edit") && (
        <PersonForm
          person={modal === "edit" ? person : undefined}
          saveError={error}
          close={() => M("")}
          save={(p) => {
            const next =
              modal === "edit"
                ? people.map((old) => (old.id === p.id ? p : old))
                : [...people, p];
            if (persist(next)) {
              if (modal === "new") select(p.id);
              M("");
            }
          }}
        />
      )}
      {(modal === "update" || modal === "model") && (
        <LearningDialog
          modelOnly={modal === "model"}
          saveError={error}
          person={person}
          close={() => M("")}
          save={(p) => {
            if (persist(people.map((old) => (old.id === p.id ? p : old))))
              M("");
          }}
        />
      )}
      {modal === "decision" && (
        <TestDecision
          person={person}
          close={() => M("")}
          save={(p) =>
            persist(people.map((old) => (old.id === p.id ? p : old)))
          }
          saveError={error}
        />
      )}
      {modal.startsWith("resolve:") && (
        <ResolveDecision
          person={person}
          decisionId={modal.slice(8)}
          close={() => M("")}
          save={(p) => {
            if (persist(people.map((old) => (old.id === p.id ? p : old))))
              M("");
          }}
          saveError={error}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
