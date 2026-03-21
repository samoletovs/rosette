---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

At a high level, the process of creating a skill goes like this:

- Decide what you want the skill to do and roughly how it should do it
- Write a draft of the skill
- Create a few test prompts and run claude-with-access-to-the-skill on them
- Help the user evaluate the results both qualitatively and quantitatively
- Rewrite the skill based on feedback from the user's evaluation of the results
- Repeat until you're satisfied
- Expand the test set and try again at larger scale

## Skill Structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

## Progressive Disclosure

Skills use a three-level loading system:
1. **Metadata** (name + description) - Always in context (~100 words)
2. **SKILL.md body** - In context whenever skill triggers (<500 lines ideal)
3. **Bundled resources** - As needed (unlimited, scripts can execute without loading)

## Writing Patterns

- Prefer the imperative form in instructions
- Explain the **why** behind everything — today's LLMs are smart and respond better to reasoning than rigid ALWAYS/NEVER rules
- Keep SKILL.md under 500 lines; use references/ for deep content
- Include examples of good vs bad outputs
- Define output formats with templates when the skill produces structured output

## Skill Description Best Practices

The description field is the primary triggering mechanism. Include:
- What the skill does
- Specific contexts for when to use it
- Make it slightly "pushy" — list the kinds of user requests that should trigger it
- Cover edge cases where the skill should activate even without explicit keywords

## Core Loop

1. Figure out what the skill is about
2. Draft or edit the skill
3. Test with realistic prompts
4. Evaluate outputs with the user
5. Iterate until satisfied
