# SE 390 MP3 course constraints (distilled)

What the SE 390 Fall 2026 course guide and the SE Capstone Handbook require of the Waterloo Goose Simulator MP3, with section pointers so every rule can be checked against the source.

Sources: [guide.txt](guide.txt) (SE 390 course guide, Fall 2026, copied here unedited) and the SE Capstone Handbook (May 29, 2023), section 14.2.5. The handbook PDF is not copied into this folder because of its size (about 4 MB); it lives at `../../se-capstone-handbook.pdf` relative to this file. Quotes below are verbatim; everything else is a summary.

## 1. Dates (all 2026, America/Toronto)

| Date | What | Guide reference |
|---|---|---|
| Thu Nov 5 | MP2 presentations; MP3 starts (runs Nov 5 to Dec 7) | Schedule table, line 166 |
| Fri Nov 6 | Peer critique assignments go out | w8 row |
| Mon Nov 9 | Revised or new abstract (`abstract.md`) for MP3 due in the MP3 team subdirectory | w8 row, abstract per section 13.9 |
| Thu Nov 12 | Guest lecture "Agile and AI", in person, MC 1085, 4:30 to 6:20 pm, not recorded | Lecture list |
| Fri Nov 13 | Written peer critiques of other teams' MP2 due (individual deliverable) | w9 row |
| Thu Nov 19 | Guest lecture "Intellectual Property (IP) 101", online, not recorded. Be ready to discuss how IP applies to the project at the MP3 review | w10 row |
| Thu Nov 26 | Mid-MP3 check-ins, by instructor invitation or on request (message the instructor in w10) | w11 row |
| Thu Dec 3 | No lecture; slide and video preparation | Schedule |
| Mon Dec 7, end of day | MP3 slides in the course GitLab and the video link (private YouTube, 5 min) in the sign-up sheet | w12 row |
| Tue Dec 8 | MP3 reviews, all day, online on MS Teams | w13 row |

Course submission repository: https://git.uwaterloo.ca/secapstone/se2028-390 (from the guide).

## 2. Weight and time budget

- MP3 is 50% of the course grade: Process 15%, Results 30%, Presentation 5% (guide grading table, lines 985 to 987). The video is mandatory for MP3.
- Time: 32 h per student, 128 h for a team of 4 (guide line 184 onward: "a nominal budget of 10 student hours per week, including class meetings", leaving 8 project hours per student per week).
- Planning consequence: 128 team-hours over roughly 4.5 weeks. Any milestone plan in [06-architecture-and-milestones.md](../06-architecture-and-milestones.md) must fit in that budget, including the time for user feedback, slides and video.

## 3. What a strong MP3 looks like (guide, "What a strong deliverable looks like at each stage")

- The question MP3 answers: "Is this the project we are taking into SE 490, and are we ready?"
- Problem definition: "Scope settled. You can state what success in SE 491 looks like and why."
- Technical artifact: "A demonstrable system or result that a stranger could understand from a five-minute demo."
- External contact: "Feedback obtained and visibly acted on."
- Process: "Everything above, sustained, plus a credible plan for SE 490."
- A-range: "Meaningful results, a team that works, and a project you're proud to carry forward."

## 4. Category: Advanced Technology

- Guide line 135: "Create an Advanced Technology that combines knowledge from multiple technical elective courses and addresses an important and difficult problem (but does not necessarily have a business case)".
- Guide line 1110: "The initial objective is to establish a scope and objective. Consider what you want the project to teach you, develop an exciting vision of what you would present at symposium, and work backwards to an initial plan. Deliverables can include technology prototypes, in-depth literature surveys, and structured learning."
- Handbook 14.2.5 rubric, A+: "Demonstrates that a problem was solved convincingly, meets two or more of the measures below with excellence, and positive mention from an industry professional." Measures: importance of the problem; (technical) difficulty and scope; novelty of the solution; applies knowledge from multiple upper-year courses. A: convincing plus two measures. B: convincing plus one measure.
- Handbook also: "It would be inappropriate to choose a project whose content is only at a second year level", and "Finding someone in industry or academia who is an expert in the domain being focused on can help a project prove the importance, novelty, or difficulty of the work involved."
- What this means for the goose game: the novelty and difficulty case should rest on (a) a reproducible, validated open-data pipeline from lidar plus OSM plus municipal GIS to a playable stylized world (graphics, GIS, data engineering), (b) a scalable NPC simulation with an optional cheap LLM decision layer and a measured deterministic fallback (AI, real-time systems), and (c) benchmarks that compare against alternatives (OSM-only heights vs lidar heights; FSM-only vs Jev-assisted NPCs). See [06-architecture-and-milestones.md](../06-architecture-and-milestones.md) for the benchmark harness. Getting a game-industry or GIS professional to look at it is the A+ lever.

## 5. Every presentation must cover (guide, "What every presentation must cover")

Maximum 5 to 8 slides, five minutes:

1. The problem, including target audience, related past capstone projects, competition and how you differ.
2. Results of the iteration.
3. How you organized project activities (meeting cadence, task management, kanban board).
4. Your use of AI: what you used, what worked, what did not (section 11).
5. Lessons learned.

At MP3 add: "what the peer critiques told you, and what you did about it, including which suggestions you rejected and why."

At each review meeting, be ready to show: the code repository, a log of commit activity, samples of development artifacts (user stories, mock-ups, issue tracker, code), a list of team meetings, and a demo.

Delivery: every team member involved; stick to five minutes; test screen sharing; "I subtract points for technical problems that better preparation would have avoided."

## 6. Process expectations (guide section 10, "What it takes to get 100%")

- A meeting cadence "frequent enough to matter (twice a week is a reasonable target)", actually held.
- Formal task management for all activities, a kanban board with statuses (scheduled, in progress, done, backlog), tasks assigned with delivery dates, and "substantial content in in progress and done".
- Visible evidence that the team used the assigned material (Handbook sections, guest lectures).

## 7. Generative AI rules (guide section 11)

- Use AI freely, but "Do not confuse output with progress." The Results bar has moved; talking to real users is worth more than extra features.
- Accountability: "'The model wrote it' is not an explanation for a defect, a fabricated citation, or a licence violation."
- Documents: an AID Framework statement at the end (https://subjectguides.uwaterloo.ca/AIDframework) naming tool and version, what it did, and what was verified against primary sources.
- Code: do not annotate source files. Use a commit trailer in the Linux kernel format `Assisted-by: AGENT_NAME:MODEL_VERSION [TOOL1] [TOOL2]`, for example `Assisted-by: Claude:claude-opus-4-5`. Use `Assisted-by:`, not `Co-authored-by:` (implies legal authorship) or `Generated-by:` (overstates the tool's role).
- "an AI agent must never add a Signed-off-by: line".
- Repository: a short `AI-USE.md` at the root listing tools, what they are used for, and how generated code is reviewed before it lands. Keep it current; it is what you speak from at reviews.
- Peer critiques are individual and must not be AI-generated.
- Be careful with large blocks of generated content, "especially images" (copyright status unclear). For the goose game this argues for code-generated geometry and hand-made or procedurally generated art over AI-generated textures, or at least disclosing them.

## 8. Checklist derived from the above

- [ ] `abstract.md` in the MP3 team subdirectory by Mon Nov 9.
- [ ] `AI-USE.md` at the repo root from day one; every AI-assisted commit has an `Assisted-by:` trailer; no `Signed-off-by:` from agents.
- [ ] Kanban board with assigned, dated tasks; two meetings a week, logged.
- [ ] At least one round of playtests with people outside the team before Nov 26, with notes and a visible change made because of them.
- [ ] Peer critique responses (accepted and rejected, with reasons) in the MP3 slides.
- [ ] IP slide: data licences (ODbL, OGL Ontario, City and Region open data licences), code licences, and the UGG trade dress question (see [07-licences-and-prior-art.md](../07-licences-and-prior-art.md)).
- [ ] 5-minute private YouTube video and slides by end of Mon Dec 7.
- [ ] A credible SE 490 plan and a statement of what success in SE 491 looks like.

AID statement: Grok Bot drafted this distillation on Nov 2, 2026 from guide.txt and pages 175 to 176 of the handbook (information collection and writing). Every quote was copied from the source text; dates were checked against the guide's schedule table.
