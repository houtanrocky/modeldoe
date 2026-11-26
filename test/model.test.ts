import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLearning,
  cognitionDimensions,
  estimateRule,
  getCognitionModel,
  initialPeople,
  makeDecisionPrompt,
  makePrompt,
  parseDecisionReply,
  parseReply,
  reviewedModel,
  saveDecisionResult,
} from "../src/model.ts";
import type { DecisionPrediction, Observation } from "../src/model.ts";

const [person] = initialPeople();
const { hypotheses, rules } = getCognitionModel(person);
const observation = {
  id: "new",
  type: "Decision",
  text: "Chose a trial run.",
  situation: "The team was about to release a change.",
  involvement: "Alex argued for piloting the rollout.",
  date: "2026-11-27",
} satisfies Observation;
const reply = {
  version: 2,
  personId: person.id,
  updateId: observation.id,
  hypotheses,
  rules,
};
const decisionQuestion = {
  id: "q1",
  text: "Should Alex accept the role?",
  createdAt: "2026-11-27",
};
const decisionReply: DecisionPrediction = {
  version: 1,
  personId: person.id,
  questionId: decisionQuestion.id,
  prediction: "Ask for details first",
  rationale: "Past behavior supports it",
  alternatives: ["Accept immediately"],
  uncertainty: "Role details are unknown",
  dimensions: Object.fromEntries(
    cognitionDimensions.map((key) => [key, "unknown"]),
  ) as DecisionPrediction["dimensions"],
  sources: [person.evidence[0].id],
};
const savedDecision = {
  ...decisionQuestion,
  prediction: decisionReply,
  actualChoice: "",
  outcome: "",
};

test("a prompt carries the current evidence, hypotheses and exact draft", () => {
  const prompt = makePrompt(person, observation.id, observation);
  for (const item of [
    person.evidence[0].text,
    hypotheses[0].prediction,
    observation.text,
    observation.situation,
    observation.involvement,
  ])
    assert.ok(prompt.includes(item));
});
test("a complete response can retain old evidence links", () => {
  assert.deepEqual(
    parseReply(JSON.stringify(reply), person, observation.id, observation),
    { hypotheses, rules },
  );
});
test("rejects stale drafts, other people and invented evidence", () => {
  for (const change of [
    { updateId: "old" },
    { personId: "other" },
    { hypotheses: [{ ...hypotheses[0], sources: ["missing"] }] },
  ]) {
    assert.throws(() =>
      parseReply(
        JSON.stringify({ ...reply, ...change }),
        person,
        observation.id,
        observation,
      ),
    );
  }
});

test("decision prompt includes full context and all cognition dimensions", () => {
  const question = { id: "q1", text: "Should Alex accept the role?" };
  const prompt = makeDecisionPrompt(person, question);
  for (const value of [
    person.name,
    person.evidence[0].text,
    question.text,
    ...cognitionDimensions,
  ])
    assert.ok(prompt.includes(value), value);
});

test("validates decision identity, shape and evidence references", () => {
  const question = decisionQuestion;
  const valid = decisionReply;
  assert.deepEqual(
    parseDecisionReply(JSON.stringify(valid), person, question),
    valid,
  );
  assert.throws(() =>
    parseDecisionReply(
      JSON.stringify({ ...valid, questionId: "stale" }),
      person,
      question,
    ),
  );
  assert.throws(() =>
    parseDecisionReply(
      JSON.stringify({ ...valid, sources: ["invented"] }),
      person,
      question,
    ),
  );
  assert.throws(() => parseDecisionReply("not json", person, question));
  assert.throws(() =>
    parseDecisionReply(
      JSON.stringify({ ...valid, dimensions: {} }),
      person,
      question,
    ),
  );
});

test("actual decision result never changes standing cognition or evidence", () => {
  const withDecision = { ...person, decisions: [savedDecision] };
  const updated = saveDecisionResult(
    withDecision,
    "q1",
    "Declined",
    "Chose another role",
  );
  assert.ok(updated.decisions);
  assert.equal(updated.decisions[0].actualChoice, "Declined");
  assert.equal(updated.decisions[0].outcome, "Chose another role");
  assert.equal(updated.evidence, person.evidence);
  assert.equal(updated.cognitionModel, person.cognitionModel);
  assert.throws(() => saveDecisionResult(withDecision, "q1", "  ", ""));
});

test("both prompts carry structured profile details and omit decision history", () => {
  const profile = {
    job: "Human factors researcher",
    age: 42,
    height: "172 cm",
    degrees: [
      { degree: "BSc Psychology", institution: "North University" },
      { degree: "MSc Ergonomics", institution: "East University" },
    ],
    traits: ["Seeks consensus on shared decisions"],
  };
  const withProfile = {
    ...person,
    context: "Former colleague",
    ...profile,
    decisions: [{ ...savedDecision, actualChoice: "Only in the decision log" }],
  };
  const question = { id: "q2", text: "Which proposal would Alex choose?" };
  for (const prompt of [
    makePrompt(withProfile, observation.id, observation),
    makeDecisionPrompt(withProfile, question),
  ]) {
    const { person: promptPerson } = JSON.parse(prompt.split("\n\n")[3]);
    for (const [field, value] of Object.entries(profile)) {
      assert.deepEqual(promptPerson[field], value);
    }
    assert.equal(promptPerson.context, withProfile.context);
    assert.deepEqual(promptPerson.evidence, person.evidence);
    assert.equal(Object.hasOwn(promptPerson, "decisions"), false);
  }
});

test("prediction prompts include the model and computed estimates only when selected", () => {
  const question = { id: "q2", text: "What rollout plan will Alex propose?" };
  const payload = (useModel: boolean) =>
    JSON.parse(makeDecisionPrompt(person, question, useModel).split("\n\n")[3]);
  assert.equal(payload(false).cognitionModel, undefined);
  assert.deepEqual(payload(true).cognitionModel.hypotheses, hypotheses);
  assert.deepEqual(
    payload(true).cognitionModel.rules[0].estimate,
    estimateRule(rules[0].cases),
  );
});

test("app computes a Bayesian estimate from matches and counterexamples", () => {
  const { interval95, ...estimate } = estimateRule([
    { occurred: true },
    { occurred: true },
    { occurred: false },
  ]);
  assert.deepEqual(estimate, { alpha: 3, beta: 2, probability: 0.6 });
  const beta32Cdf = (x: number) => 4 * x ** 3 - 3 * x ** 4;
  assert.ok(Math.abs(beta32Cdf(interval95[0]) - 0.025) < 1e-10);
  assert.ok(Math.abs(beta32Cdf(interval95[1]) - 0.975) < 1e-10);
  assert.equal(estimateRule([{ occurred: false }]).probability, 1 / 3);
});

test("credible intervals agree with analytic bounds for sparse and extreme counts", () => {
  const prior = estimateRule([]);
  assert.ok(Math.abs(prior.interval95[0] - 0.025) < 1e-10);
  assert.ok(Math.abs(prior.interval95[1] - 0.975) < 1e-10);
  for (const n of [2, 10_000]) {
    const observed = estimateRule(Array(n).fill({ occurred: true })).interval95;
    const absent = estimateRule(Array(n).fill({ occurred: false })).interval95;
    for (const [i, quantile] of [0.025, 0.975].entries()) {
      assert.ok(Math.abs(observed[i] - quantile ** (1 / (n + 1))) < 1e-10);
      assert.ok(
        Math.abs(absent[i] - (1 - (1 - quantile) ** (1 / (n + 1)))) < 1e-10,
      );
    }
  }
});

test("review removes excluded cases and empty rules without changing the original model", () => {
  const draft = {
    hypotheses,
    rules: [
      {
        ...rules[0],
        cases: [
          { evidenceId: "e3", occurred: false },
          { evidenceId: "e6", occurred: null },
        ],
      },
      { ...rules[0], cases: [{ evidenceId: "e3", occurred: null }] },
    ],
  };
  const model = reviewedModel(draft);
  assert.equal(model.rules.length, 1);
  assert.deepEqual(model.rules[0].cases, [
    { evidenceId: "e3", occurred: false },
  ]);
  assert.equal(estimateRule(model.rules[0].cases).probability, 1 / 3);
  assert.equal(draft.rules[0].cases.length, 2);
  assert.equal(rules[0].cases[0].occurred, true);
});

test("validates true or false rule outcomes and distinct eligible evidence", () => {
  const valid = { evidenceId: observation.id, occurred: false };
  const withCases = (cases: unknown[]) =>
    JSON.stringify({ ...reply, rules: [{ ...rules[0], cases }] });
  assert.deepEqual(
    parseReply(withCases([valid]), person, observation.id, observation).rules[0]
      .cases,
    [valid],
  );
  for (const cases of [
    [],
    [valid, { ...valid, occurred: true }],
    [{ ...valid, occurred: "false" }],
    [{ ...valid, evidenceId: "invented" }],
    [{ ...valid, evidenceId: "e1" }],
  ]) {
    assert.throws(() =>
      parseReply(withCases(cases), person, observation.id, observation),
    );
  }
});

test("standalone revisions reject references to a draft and preserve saved observations", () => {
  const updateId = "model-only";
  const nextReply = { ...reply, updateId, rules: [] };
  const revised = parseReply(JSON.stringify(nextReply), person, updateId);
  assert.equal(
    applyLearning(person, { model: revised }).evidence,
    person.evidence,
  );
  assert.throws(() =>
    parseReply(
      JSON.stringify({
        ...nextReply,
        rules: [
          {
            ...rules[0],
            cases: [{ evidenceId: observation.id, occurred: true }],
          },
        ],
      }),
      person,
      updateId,
    ),
  );
});

test("record-only saves preserve an existing or legacy model", () => {
  const legacy = { ...person, cognitionModel: undefined, hypotheses };
  for (const savedPerson of [person, legacy]) {
    const logged = applyLearning(savedPerson, { observation });
    assert.deepEqual(logged.evidence.at(-1), observation);
    assert.deepEqual(getCognitionModel(logged), getCognitionModel(savedPerson));
    assert.equal(logged.decisions, savedPerson.decisions);
  }
  const revised = { hypotheses, rules };
  const result = applyLearning(legacy, { observation, model: revised });
  assert.equal(result.cognitionModel, revised);
  assert.equal(result.hypotheses, undefined);
  assert.deepEqual(result.evidence.at(-1), observation);
});
