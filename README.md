# Modeldoe

Modeldoe is a client-only React and Vite notebook for understanding how a person makes decisions. Keep a separate model for each person. Record their exact words, observed actions, decisions and context, or your own explicitly labeled inference.

## Person profiles

Use **New person** or **Edit profile** to record a job, age in years, height with units, and any number of degrees with their awarding institutions. Add personality traits that may affect decisions, with examples of when they apply. Both AI prompts provide these details as context and ask the AI to ground any use of traits in observed behavior.

## Cognition model

Each person has a separate, explicitly revised model. It contains qualitative hypotheses and conditional Bayesian rules. A rule specifies a situation and one observable action, such as proposing a pilot when a rollout is expensive to reverse. The AI proposes which recorded, comparable events show the action and which show a different action. The review shows those records so you can check the classifications before applying them.

Each rule starts with a uniform Beta(1, 1) prior. With `y` matching actions and `n` total comparable events, the app calculates the posterior predictive estimate `(y + 1) / (n + 2)`. The estimate assumes the cited events are comparable and independent given the rule. Sparse, selective or correlated observations can make these estimates unreliable. Rules are evaluated individually and their estimates do not sum to 100%. [Stan case study on repeated binary trials](https://mc-stan.org/users/documentation/case-studies/pool-binary-trials.html)

## Update cycle

1. Open **Add observation** and describe what happened. For a decision, enter the situation, the person's observable involvement, and what was decided or done. A stated reason can be recorded in their own words.
2. Save the record directly, or select **Revise cognition model with this observation** to generate a revision prompt. **Revise model** can also generate a prompt from existing records without adding an observation.
3. Copy the prompt into an LLM of your choice, paste its JSON response, and check the proposed hypotheses, rules and cited cases before applying the revision.

Saving an observation by itself leaves the model revision as it was. Applying a revision replaces the model with the reviewed version. When a revision includes a new observation, both are saved together. Previous profiles and hypotheses can be opened in the new view.

## One-time decision inference

Use **Test a decision** when you want a prediction for one specific question. Its live prompt includes the person's profile and evidence. Select **Use saved cognition model** to include the hypotheses, rules and calculated estimates. The AI response returns a likely choice, evidence-based rationale, alternatives, uncertainty and a structured review of the relevant cognition dimensions.

Save the prediction, then record the actual choice and outcome when known. Those results remain in a separate decision log and never alter observations or standing hypotheses. If the outcome is useful evidence about the person, add it separately as an observation and explicitly classify it.

The prediction is a hypothesis for the described situation, not access to another person's thoughts. Preserve source references and uncertainty, and review the prediction against the actual result.

## Local use

Run `npm install`, then `npm run dev`. Use `npm run build` for a static production build. Profiles are stored in this browser's local storage. Clearing site data removes them. A fictional sample profile illustrates the workflow on first use.

## GitHub Pages

Pushes to `main` run the tests and deploy the production build to [Modeldoe on GitHub Pages](https://houtanrocky.github.io/modeldoe/). The workflow builds with relative asset paths so the site can run under `/modeldoe/`.
