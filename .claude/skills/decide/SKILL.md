---
name: decide
description: Apply this repo's established decision tests to a boundary question — does this earn its own component, does it belong in the kernel, boolean or enum, is this ours or the consuming project's, which element before styling. Use whenever a scope or taxonomy question comes up, BEFORE reasoning it out from first principles.
---

# Deciding a boundary question

This repo has thirteen decision tests, established by ADR and spread across twenty-five documents.
They are collected in **`docs/adr/TESTS.md`**.

**Read that file before reasoning from first principles.** That instruction is the whole point of
this skill: the tests already exist, and the failure mode is not disagreeing with them — it is not
finding them. While building the range family, "does this earn its own component?" was re-derived
from scratch and answered with a worse rule, while the canonical three-condition version sat in
ADR-0014 the entire time. The re-derived version dropped the mental-model condition, which is the
one that separates Picklist from a ButtonGroup.

## How to use it

1. **Read `docs/adr/TESTS.md`.** It is short and it names its source ADR for every test.
2. **Find the test that matches the shape of the question.** The thirteen cover: earning a component,
   earning a kernel place, selection vs action, surviving a discriminator, boolean vs enum, forbidden
   combinations, load-bearing selectors, end state vs mechanism, copied vs imported, element choice,
   semantics vs behaviour, mechanics vs taste, private vs public variables.
3. **Read the source ADR** if the test's phrasing is doing real work in the answer. The index is a
   pointer; the ADR is authoritative, and where they disagree the ADR wins.
4. **Answer with the test's own vocabulary.** "It fails all three earning conditions, so it is a
   recipe" is checkable. "It feels like layout" is not.

## When no test fits

Say so plainly, then reason it out — and if the reasoning produces a *reusable* question rather than
a one-off answer, that is a new test:

- add it to `docs/adr/TESTS.md`, and
- write the ADR that makes it a decision rather than an opinion.

Test 6 (forbidden combinations) is currently in that state: recorded in the index, not yet an ADR.

## What this skill is not for

Structure. How a component is laid out, what a contract contains, how a generator is shaped — **read
a sibling component instead.** A sibling is always current; a written description of structure drifts,
which is exactly how `DateField.md` came to document a `class="panel"` that neither the generator nor
the CSS has, and how a real port inherited the mistake.
