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
  saveDecisionResult,
} from "../src/model.js";

const [person] = initialPeople();
const { hypotheses, rules } = getCognitionModel(person);
const observation = {
  id: "new",
  type: "Decision",
  text: "Chose a trial run.",
  situation: "The team was about to release a change.",
  involvement: "Alex argued for piloting the rollout.",
  date: "2026-11-27",
};
const reply = {
  version: 2,
  personId: person.id,
  updateId: observation.id,
  hypotheses,
  rules,
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
  const question = { id: "q1", text: "Should Alex accept the role?" };
  const valid = {
    version: 1,
    personId: person.id,
    questionId: question.id,
    prediction: "Ask for details first",
    rationale: "Past behavior supports it",
    alternatives: ["Accept immediately"],
    uncertainty: "Role details are unknown",
    dimensions: Object.fromEntries(
      cognitionDimensions.map((key) => [key, "unknown"]),
    ),
    sources: [person.evidence[0].id],
  };
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
  const decision = { id: "q1", actualChoice: "", outcome: "" };
  const withDecision = { ...person, decisions: [decision] };
  const updated = saveDecisionResult(
    withDecision,
    "q1",
    "Declined",
    "Chose another role",
  );
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
    decisions: [{ actualChoice: "Only in the decision log" }],
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
  const payload = (useModel) =>
    JSON.parse(makeDecisionPrompt(person, question, useModel).split("\n\n")[3]);
  assert.equal(payload(false).cognitionModel, undefined);
  assert.deepEqual(payload(true).cognitionModel.hypotheses, hypotheses);
  assert.deepEqual(payload(true).cognitionModel.rules[0].estimate, {
    alpha: 3,
    beta: 1,
    probability: 0.75,
  });
});

test("app computes a Bayesian estimate from matches and counterexamples", () => {
  assert.deepEqual(
    estimateRule([{ occurred: true }, { occurred: true }, { occurred: false }]),
    {
      alpha: 3,
      beta: 2,
      probability: 0.6,
    },
  );
  assert.equal(estimateRule([{ occurred: false }]).probability, 1 / 3);
});

test("validates true or false rule outcomes and distinct eligible evidence", () => {
  const valid = { evidenceId: observation.id, occurred: false };
  const withCases = (cases) =>
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
